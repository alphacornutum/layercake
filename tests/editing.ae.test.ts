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
import { listFolders } from "../src/inventory/list-folders.js";
import { listProjectContext } from "../src/inventory/list-project-context.js";
import { listSources } from "../src/inventory/list-sources.js";
import type { InventoryComposition, InventoryLayer } from "../src/inventory/types.js";
import { applyProjectPatch } from "../src/patch/apply.js";
import { saveProject } from "../src/patch/save.js";
import type {
  CreateFolderTargetResult,
  DeleteProjectItemTargetResult,
  MoveProjectItemTargetResult,
  TextStyleTargetResult,
} from "../src/patch/types.js";

/**
 * hello-world.aep includes a text layer in composition `main` ("Hello World").
 * Mutating e2e work runs against a temp copy so the committed fixture stays clean.
 * Sibling `1x1.png` must travel with every relocated .aep — relative file footage
 * resolves next to the project (see fixtures/README.md).
 */

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const committedFixtureAep = join(fixturesDir, "hello-world.aep");
const committedFixturePng = join(fixturesDir, "1x1.png");
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

/** Copy .aep + linked fixture media into destDir; return absolute path to the .aep. */
function materializeFixtureTree(destDir: string, aepBasename: string): string {
  const destAep = join(destDir, aepBasename);
  copyFileSync(committedFixtureAep, destAep);
  copyFileSync(committedFixturePng, join(destDir, "1x1.png"));
  return destAep;
}

const hasHost = isHostConfigured();
const hasFixture = existsSync(committedFixtureAep) && existsSync(committedFixturePng);

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
    materializeFixtureTree(workDir, "hello-world-work.aep");
  }
  await host.openProject(workAep);
  // AE often marks a project dirty on open (footage resolve, fonts, etc.).
  // create_backup requires a clean on-disk file — persist the temp work copy only.
  const saved = await host.evalScript(
    "if (!app.project) throw new Error('no project'); app.project.save(); return app.project.dirty ? 1 : 0;",
    config.scriptTimeoutMs,
  );
  if (!saved.ok) {
    throw new Error(`Failed to save work copy after open: ${saved.error}`);
  }
}

/** hello-world fixture: composition `main` and its text layer. */
async function mainTextLayer(
  host: AeHost,
): Promise<{ main: InventoryComposition; textLayer: InventoryLayer }> {
  const inventory = await listComps(host, {}, config.scriptTimeoutMs);
  const main = inventory.compositions.find((c) => c.name === "main");
  expect(main).toBeTruthy();
  const textLayer = main!.layers.find((l) => l.type === "text");
  expect(textLayer).toBeTruthy();
  return { main: main!, textLayer: textLayer! };
}

describe.skipIf(!hasHost || !hasFixture)("project editing API (host e2e)", () => {
  const host = hasHost ? createAeHost(config) : (null as unknown as AeHost);

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), "lc-ae-edit-work-"));
    workAep = materializeFixtureTree(workDir, "hello-world-work.aep");
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
      const { main, textLayer } = await mainTextLayer(host);

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
                layers: [{ compId: main.id, layerId: textLayer.id }],
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
      // Save As relocates the active project; keep relative footage resolvable.
      copyFileSync(committedFixturePng, join(artifactDir, "1x1.png"));
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

  it("panel ops: create folder → move items → delete with impact; no implicit save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    expect(before.projectPath).toBeTruthy();

    const folders = await listFolders(host, config.scriptTimeoutMs);
    const rootId = folders.root.id;
    expect(typeof rootId).toBe("number");

    const comps = await listComps(host, {}, config.scriptTimeoutMs);
    const main = comps.compositions.find((c) => c.name === "main");
    expect(main).toBeTruthy();

    const sources = await listSources(host, config.scriptTimeoutMs);
    const footage = sources.sources.find((s) => s.name === "1x1.png" || s.file?.includes("1x1"));
    // Prefer a real footage id when present; otherwise move the main comp only.
    const moveIds = footage ? [main!.id, footage.id] : [main!.id];

    const create = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [{ op: "create_folder", name: "LC_PanelProbe", parentFolderId: rootId }],
      },
      config.scriptTimeoutMs,
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;
    expect(create.dirty).toBe(true);
    expect(create.revision).toBeGreaterThan(before.revision);
    expect(create.fingerprint).not.toBe(before.fingerprint);

    const createdTarget = create.results[0]?.targets[0] as CreateFolderTargetResult | undefined;
    expect(createdTarget?.status).toBe("changed");
    expect(createdTarget?.created?.parentFolderId).toBe(rootId);
    const folderId = createdTarget?.created?.id ?? createdTarget?.itemId;
    expect(typeof folderId).toBe("number");

    // Patch must not persist — path stays the work copy.
    const midCtx = await listProjectContext(host, config.scriptTimeoutMs);
    expect(midCtx.projectPath).toBe(before.projectPath);
    expect(midCtx.fingerprint).toBe(create.fingerprint);

    const move = await applyProjectPatch(
      host,
      {
        project: { path: midCtx.projectPath!, fingerprint: midCtx.fingerprint },
        operations: [
          {
            op: "move_project_item",
            selector: { kind: "items", itemIds: moveIds },
            destinationFolderId: folderId!,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    for (const t of move.results[0]?.targets ?? []) {
      const panel = t as MoveProjectItemTargetResult;
      expect(panel.status).toBe("changed");
      expect(panel.after?.parentFolderId).toBe(folderId);
      expect(panel.before?.parentFolderId).not.toBe(folderId);
    }

    const afterMove = await listProjectContext(host, config.scriptTimeoutMs);
    expect(afterMove.fingerprint).toBe(move.fingerprint);

    // Idempotent move
    const moveAgain = await applyProjectPatch(
      host,
      {
        project: { path: afterMove.projectPath!, fingerprint: afterMove.fingerprint },
        operations: [
          {
            op: "move_project_item",
            selector: { kind: "items", itemIds: [moveIds[0]!] },
            destinationFolderId: folderId!,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(moveAgain.ok).toBe(true);
    if (!moveAgain.ok) return;
    expect(moveAgain.results[0]?.targets[0]?.status).toBe("already_satisfied");

    // Move items back to root so folder delete nested count is predictable, then
    // create a nested leaf folder and delete the parent (AE recursive remove).
    const bind = await listProjectContext(host, config.scriptTimeoutMs);
    const restore = await applyProjectPatch(
      host,
      {
        project: { path: bind.projectPath!, fingerprint: bind.fingerprint },
        operations: [
          {
            op: "move_project_item",
            selector: { kind: "items", itemIds: moveIds },
            destinationFolderId: rootId,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(restore.ok).toBe(true);
    if (!restore.ok) return;

    const afterRestore = await listProjectContext(host, config.scriptTimeoutMs);
    const nestedCreate = await applyProjectPatch(
      host,
      {
        project: { path: afterRestore.projectPath!, fingerprint: afterRestore.fingerprint },
        operations: [{ op: "create_folder", name: "LC_NestedLeaf", parentFolderId: folderId! }],
      },
      config.scriptTimeoutMs,
    );
    expect(nestedCreate.ok).toBe(true);
    if (!nestedCreate.ok) return;

    const afterNested = await listProjectContext(host, config.scriptTimeoutMs);
    const del = await applyProjectPatch(
      host,
      {
        project: { path: afterNested.projectPath!, fingerprint: afterNested.fingerprint },
        operations: [
          {
            op: "delete_project_item",
            selector: { kind: "items", itemIds: [folderId!] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(del.ok).toBe(true);
    if (!del.ok) return;
    const delTarget = del.results[0]?.targets[0] as DeleteProjectItemTargetResult | undefined;
    expect(delTarget?.status).toBe("changed");
    expect(delTarget?.itemType).toBe("folder");
    expect(delTarget?.nestedItemCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(delTarget?.usedInCompIds)).toBe(true);
    expect(delTarget?.usedInCompCount).toBe(delTarget?.usedInCompIds?.length);

    // Root delete refused
    const afterDel = await listProjectContext(host, config.scriptTimeoutMs);
    const rootRefuse = await applyProjectPatch(
      host,
      {
        project: { path: afterDel.projectPath!, fingerprint: afterDel.fingerprint },
        operations: [
          {
            op: "delete_project_item",
            selector: { kind: "items", itemIds: [rootId] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(rootRefuse.ok).toBe(false);
    if (!rootRefuse.ok) expect(rootRefuse.code).toBe("validation");

    // AVItem delete with non-empty usedInCompIds (footage used by main).
    const sourcesAfter = await listSources(host, config.scriptTimeoutMs);
    const usedFootage = sourcesAfter.sources.find(
      (s) => s.name === "1x1.png" || s.file?.includes("1x1"),
    );
    expect(usedFootage).toBeTruthy();
    const afterRootRefuse = await listProjectContext(host, config.scriptTimeoutMs);
    const delFootage = await applyProjectPatch(
      host,
      {
        project: {
          path: afterRootRefuse.projectPath!,
          fingerprint: afterRootRefuse.fingerprint,
        },
        operations: [
          {
            op: "delete_project_item",
            selector: { kind: "items", itemIds: [usedFootage!.id] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(delFootage.ok).toBe(true);
    if (!delFootage.ok) return;
    const footageTarget = delFootage.results[0]?.targets[0] as
      | DeleteProjectItemTargetResult
      | undefined;
    expect(footageTarget?.status).toBe("changed");
    expect(footageTarget?.usedInCompIds?.length).toBeGreaterThanOrEqual(1);
    expect(footageTarget?.usedInCompCount).toBe(footageTarget?.usedInCompIds?.length);
    for (const compId of footageTarget?.usedInCompIds ?? []) {
      expect(typeof compId).toBe("number");
    }

    // Still on the same work-copy path — no implicit save/relocate.
    const finalCtx = await listProjectContext(host, config.scriptTimeoutMs);
    expect(finalCtx.projectPath).toBe(before.projectPath);
    expect(finalCtx.fingerprint).not.toBe(before.fingerprint);
  });

  it("repeat patch reports already_satisfied", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const ctxBind = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);

    const first = await applyProjectPatch(
      host,
      {
        project: { path: ctxBind.projectPath!, fingerprint: ctxBind.fingerprint },
        operations: [
          {
            op: "set_text_style",
            selector: {
              kind: "layers",
              layers: [{ compId: main.id, layerId: textLayer.id }],
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
              layers: [{ compId: main.id, layerId: textLayer.id }],
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

  it("set_text_style via unique compName/layerName and compNames", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);

    const byLayerNames = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "set_text_style",
            selector: {
              kind: "layers",
              layers: [{ compName: "main", layerName: "Hello World" }],
            },
            style: { font: "ArialMT" },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(byLayerNames.ok).toBe(true);
    if (!byLayerNames.ok) return;
    const layerTarget = byLayerNames.results[0]?.targets[0] as TextStyleTargetResult | undefined;
    expect(layerTarget?.status).toMatch(/^(changed|already_satisfied)$/);
    expect(layerTarget?.after?.fonts).toBeTruthy();

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    const byCompNames = await applyProjectPatch(
      host,
      {
        project: { path: mid.projectPath!, fingerprint: mid.fingerprint },
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "comps", compNames: ["main"] },
            style: { font: "ArialMT" },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(byCompNames.ok).toBe(true);
    if (!byCompNames.ok) return;
    expect(byCompNames.results[0]?.targets[0]?.status).toBe("already_satisfied");
  });

  it("rename_layer by id and unique name; opaque mustache; no implicit save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);
    const originalName = textLayer.name;

    const byId = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "rename_layer",
            target: { compId: main.id, layerId: textLayer.id },
            layerName: "{BrandURL}",
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(byId.ok).toBe(true);
    if (!byId.ok) return;
    expect(byId.results[0]?.op).toBe("rename_layer");
    expect(byId.results[0]?.targets[0]).toMatchObject({
      status: "changed",
      before: { name: originalName },
      after: { name: "{BrandURL}" },
      compId: main.id,
      layerId: textLayer.id,
    });

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    expect(mid.projectPath).toBe(before.projectPath);
    expect(mid.fingerprint).not.toBe(before.fingerprint);

    const byName = await applyProjectPatch(
      host,
      {
        project: { path: mid.projectPath!, fingerprint: mid.fingerprint },
        operations: [
          {
            op: "rename_layer",
            target: { compName: "main", layerName: "{BrandURL}" },
            layerName: "{message_10}",
          },
          {
            op: "rename_layer",
            target: { compId: main.id, layerId: textLayer.id },
            layerName: "{message_10}",
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(byName.ok).toBe(true);
    if (!byName.ok) return;
    expect(byName.results[0]?.targets[0]).toMatchObject({
      status: "changed",
      after: { name: "{message_10}" },
    });
    expect(byName.results[1]?.targets[0]).toMatchObject({
      status: "already_satisfied",
      after: { name: "{message_10}" },
    });

    const after = await listProjectContext(host, config.scriptTimeoutMs);
    expect(after.projectPath).toBe(before.projectPath);
  });

  it("compose rename_layer → save_copy; names persist on saved artifact", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);

    const patch = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "rename_layer",
            target: { compId: main.id, layerId: textLayer.id },
            layerName: "{brand_url}",
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;

    const artifactDir = mkdtempSync(join(tmpdir(), "lc-ae-rename-save-"));
    try {
      const dest = join(artifactDir, "renamed-copy.aep");
      copyFileSync(committedFixturePng, join(artifactDir, "1x1.png"));
      const saved = await saveProject(
        host,
        {
          mode: "save_copy",
          expectedFingerprint: patch.fingerprint,
          path: dest,
          projectPath: before.projectPath ?? undefined,
        },
        { artifactDir, timeoutMs: config.scriptTimeoutMs },
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      expect(existsSync(saved.writtenPath)).toBe(true);

      await closeDiscard(host);
      await host.openProject(saved.writtenPath);
      const reopened = await listComps(host, {}, config.scriptTimeoutMs);
      const reMain = reopened.compositions.find((c) => c.name === "main");
      const reLayer = reMain?.layers.find((l) => l.id === textLayer.id);
      expect(reLayer?.name).toBe("{brand_url}");
    } finally {
      await closeDiscard(host);
      rmSync(artifactDir, { recursive: true, force: true });
    }
  });

  it("refuses ambiguous layer name for rename_layer (disposable duplicate)", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    // hello-world has one text layer; duplicate its name via eval so ambiguity is expressible.
    const dup = await host.evalScript(
      `
      var items = app.project.items;
      var comp = null;
      for (var i = 1; i <= items.length; i++) {
        if (items[i] instanceof CompItem && items[i].name === "main") { comp = items[i]; break; }
      }
      if (!comp) throw new Error("main missing");
      var text = null;
      for (var j = 1; j <= comp.numLayers; j++) {
        if (comp.layer(j) instanceof TextLayer) { text = comp.layer(j); break; }
      }
      if (!text) throw new Error("text missing");
      var solid = comp.layers.addSolid([1,1,1], text.name, 8, 8, 1);
      return JSON.stringify({ layerName: text.name, solidId: solid.id });
      `,
      config.scriptTimeoutMs,
    );
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    const dupInfo = JSON.parse(dup.result) as { layerName: string; solidId: number };

    const bind = await listProjectContext(host, config.scriptTimeoutMs);
    const refused = await applyProjectPatch(
      host,
      {
        project: { path: bind.projectPath!, fingerprint: bind.fingerprint },
        operations: [
          {
            op: "rename_layer",
            target: { compName: "main", layerName: dupInfo.layerName },
            layerName: "unique_after",
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("validation");
      expect(refused.error).toMatch(/Ambiguous layer name/i);
      expect(refused.error).toMatch(/"id"/);
      expect(refused.error).toMatch(/"index"/);
    }
  });

  it("refuses different-path open; close discard; stale fingerprint on patch/save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const projectCtx = await listProjectContext(host, config.scriptTimeoutMs);

    const otherDir = mkdtempSync(join(tmpdir(), "lc-ae-other-"));
    const otherAep = materializeFixtureTree(otherDir, "other.aep");
    try {
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
