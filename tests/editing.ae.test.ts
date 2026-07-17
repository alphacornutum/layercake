import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertHostConfigured, loadConfig } from "../src/config.js";
import { createAeHost } from "../src/host/create-host.js";
import { closeProject, openProjectGuarded, SessionError } from "../src/host/session.js";
import type { AeHost } from "../src/host/types.js";
import { listComps } from "../src/inventory/list-comps.js";
import { listProjectContext } from "../src/inventory/list-project-context.js";
import { applyProjectPatch } from "../src/patch/apply.js";
import { saveProject } from "../src/patch/save.js";

/**
 * hello-world.aep includes a text layer in composition `main` ("Hello World").
 * Mutating e2e work runs against a temp copy so the committed fixture stays clean.
 */

const committedFixtureAep = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/hello-world.aep",
);
const config = loadConfig();
const hostPlatformSupported = process.platform === "darwin" || process.platform === "win32";

function isHostConfigured(): boolean {
  if (!hostPlatformSupported) return false;
  try {
    assertHostConfigured(config);
    return true;
  } catch {
    return false;
  }
}

const hasHost = isHostConfigured();
const hasFixture = existsSync(committedFixtureAep);

let workDir = "";
let workAep = "";
/** False when AE will not evaluate scripts (e.g. recovery dialog after crash). */
let aeReady = false;

async function closeDiscard(host: AeHost): Promise<void> {
  try {
    await closeProject(host, { policy: "discard", timeoutMs: config.scriptTimeoutMs });
  } catch {
    // vacant or already closed
  }
}

async function openWorkCopy(host: AeHost, resetFromCommitted: boolean): Promise<void> {
  await closeDiscard(host);
  if (resetFromCommitted) {
    copyFileSync(committedFixtureAep, workAep);
  }
  await host.openProject(workAep);
}

describe.skipIf(!hasHost || !hasFixture)("project editing API (host e2e)", () => {
  const host = hasHost ? createAeHost(config) : (null as unknown as AeHost);

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), "lc-ae-edit-work-"));
    workAep = join(workDir, "hello-world-work.aep");
    copyFileSync(committedFixtureAep, workAep);
    await host.ensureSession();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const warm = await host.evalScript(
        'return "ready";',
        Math.min(config.scriptTimeoutMs, 30_000),
      );
      if (warm.ok) {
        aeReady = true;
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.warn(
      "[editing.ae] Skipping tests: After Effects did not accept ExtendScript (dismiss recovery/save dialogs and retry).",
    );
  }, 120_000);

  afterAll(async () => {
    if (hasHost && aeReady) {
      await closeDiscard(host);
    }
    if (workDir) {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("context → backup → set_text_style → fingerprint change → save_copy; no implicit save on patch", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    expect(before.projectPath).toBeTruthy();
    expect(before.fingerprint).toMatch(/^rev:\d+\|dirty:[01]\|path:/);

    const artifactDir = mkdtempSync(join(tmpdir(), "lc-ae-artifacts-"));
    try {
      const backup = await saveProject(
        host,
        {
          mode: "create_backup",
          expectedFingerprint: before.fingerprint,
          projectPath: before.projectPath ?? undefined,
        },
        { artifactDir, timeoutMs: config.scriptTimeoutMs },
      );
      expect(backup.ok).toBe(true);
      if (!backup.ok) return;
      expect(backup.activePathChanged).toBe(false);
      expect(existsSync(backup.writtenPath)).toBe(true);

      const afterBackup = await listProjectContext(host, config.scriptTimeoutMs);
      const inventory = await listComps(host, {}, config.scriptTimeoutMs);
      const main = inventory.compositions.find((c) => c.name === "main");
      expect(main).toBeTruthy();
      const textLayer = main!.layers.find((l) => l.type === "text");
      expect(textLayer).toBeTruthy();

      const patch = await applyProjectPatch(
        host,
        {
          project: {
            path: afterBackup.projectPath!,
            fingerprint: afterBackup.fingerprint,
          },
          operations: [
            {
              op: "set_text_style",
              selector: {
                kind: "layers",
                layers: [{ compId: main!.id, layerId: textLayer!.id }],
              },
              style: { font: "ArialMT" },
            },
          ],
        },
        config.scriptTimeoutMs,
      );
      expect(patch.ok).toBe(true);
      if (!patch.ok) return;
      expect(patch.results[0]?.targets[0]?.status).toMatch(/^(changed|already_satisfied)$/);

      const afterPatch = await listProjectContext(host, config.scriptTimeoutMs);
      expect(afterPatch.projectPath).toBe(afterBackup.projectPath);
      if (patch.results[0]?.targets[0]?.status === "changed") {
        expect(afterPatch.dirty).toBe(true);
        expect(afterPatch.revision).toBeGreaterThan(afterBackup.revision);
      }

      const dest = join(artifactDir, "hello-world-copy.aep");
      const saved = await saveProject(
        host,
        {
          mode: "save_copy",
          expectedFingerprint: afterPatch.fingerprint,
          path: dest,
          projectPath: afterPatch.projectPath ?? undefined,
        },
        { artifactDir, timeoutMs: config.scriptTimeoutMs },
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      expect(existsSync(saved.writtenPath)).toBe(true);
    } finally {
      await closeDiscard(host);
      rmSync(artifactDir, { recursive: true, force: true });
    }
  });

  it("repeat patch reports already_satisfied", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const ctxBind = await listProjectContext(host, config.scriptTimeoutMs);
    const inventory = await listComps(host, {}, config.scriptTimeoutMs);
    const main = inventory.compositions.find((c) => c.name === "main");
    const textLayer = main?.layers.find((l) => l.type === "text");
    expect(textLayer).toBeTruthy();

    const first = await applyProjectPatch(
      host,
      {
        project: { path: ctxBind.projectPath!, fingerprint: ctxBind.fingerprint },
        operations: [
          {
            op: "set_text_style",
            selector: {
              kind: "layers",
              layers: [{ compId: main!.id, layerId: textLayer!.id }],
            },
            style: { font: "ArialMT" },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    const second = await applyProjectPatch(
      host,
      {
        project: { path: mid.projectPath!, fingerprint: mid.fingerprint },
        operations: [
          {
            op: "set_text_style",
            selector: {
              kind: "layers",
              layers: [{ compId: main!.id, layerId: textLayer!.id }],
            },
            style: { font: "ArialMT" },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.results[0]?.targets[0]?.status).toBe("already_satisfied");
  });

  it("refuses different-path open; close discard; stale fingerprint on patch/save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const projectCtx = await listProjectContext(host, config.scriptTimeoutMs);

    const otherDir = mkdtempSync(join(tmpdir(), "lc-ae-other-"));
    const otherAep = join(otherDir, "other.aep");
    try {
      copyFileSync(committedFixtureAep, otherAep);

      await expect(
        openProjectGuarded(host, otherAep, config.scriptTimeoutMs),
      ).rejects.toBeInstanceOf(SessionError);

      await expect(
        openProjectGuarded(host, otherAep, config.scriptTimeoutMs),
      ).rejects.toMatchObject({ code: "project_already_open" });

      const stalePatch = await applyProjectPatch(
        host,
        {
          project: {
            path: projectCtx.projectPath!,
            fingerprint: "rev:0|dirty:0|path:/not/the/real/path.aep",
          },
          operations: [
            {
              op: "set_text_style",
              selector: { kind: "all_text_layers" },
              style: { font: "ArialMT" },
            },
          ],
        },
        config.scriptTimeoutMs,
      );
      expect(stalePatch.ok).toBe(false);
      if (!stalePatch.ok) {
        expect(["stale_fingerprint", "path_mismatch"]).toContain(stalePatch.code);
      }

      const staleSave = await saveProject(
        host,
        {
          mode: "save_copy",
          expectedFingerprint: "rev:0|dirty:0|path:/not/the/real/path.aep",
          path: join(otherDir, "out.aep"),
        },
        { artifactDir: otherDir, timeoutMs: config.scriptTimeoutMs },
      );
      expect(staleSave.ok).toBe(false);
      if (!staleSave.ok) expect(staleSave.code).toBe("stale_fingerprint");

      const closed = await closeProject(host, {
        policy: "discard",
        expectedFingerprint: (await listProjectContext(host, config.scriptTimeoutMs)).fingerprint,
        timeoutMs: config.scriptTimeoutMs,
      });
      expect(closed.closed).toBe(true);

      const openedOther = await openProjectGuarded(host, otherAep, config.scriptTimeoutMs);
      expect(openedOther.opened).toBe(true);
    } finally {
      await closeDiscard(host);
      rmSync(otherDir, { recursive: true, force: true });
    }
  });
});
