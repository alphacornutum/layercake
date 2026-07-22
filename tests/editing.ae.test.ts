import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertHostConfigured, loadConfig } from "../src/config.js";
import { createAeHost } from "../src/host/create-host.js";
import { closeProject, openProjectGuarded, SessionError } from "../src/host/session.js";
import type { AeHost } from "../src/host/types.js";
import { getItemRefs } from "../src/inventory/get-item-refs.js";
import { getLayer } from "../src/inventory/get-layer.js";
import { listComps } from "../src/inventory/list-comps.js";
import { listFolders } from "../src/inventory/list-folders.js";
import { listProjectContext } from "../src/inventory/list-project-context.js";
import { listSources } from "../src/inventory/list-sources.js";
import type { InventoryComposition, InventoryLayer } from "../src/inventory/types.js";
import { applyProjectPatch } from "../src/patch/apply.js";
import type { PatchProjectInput } from "../src/patch/schema.js";
import { saveProject } from "../src/patch/save.js";
import type {
  CreateFolderTargetResult,
  CreateSolidTargetResult,
  CreateTextTargetResult,
  DeleteProjectItemTargetResult,
  MoveProjectItemTargetResult,
  ReplaceLayerSourceTargetResult,
  ResetLayerSurfaceTargetResult,
  SetCompSettingsTargetResult,
  SetLayerSwitchesTargetResult,
  SetLayerTimingTargetResult,
  SetLayerTransformTargetResult,
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

type SetTextStyleBag = Extract<
  PatchProjectInput["operations"][number],
  { op: "set_text_style" }
>["style"];

/** Apply set_text_style to the fixture main text layer; returns patch + typed target. */
async function patchMainTextStyle(
  host: AeHost,
  projectPath: string,
  fingerprint: string,
  main: InventoryComposition,
  textLayer: InventoryLayer,
  style: SetTextStyleBag,
) {
  const patch = await applyProjectPatch(
    host,
    {
      project: { path: projectPath, fingerprint },
      operations: [
        {
          op: "set_text_style",
          selector: {
            kind: "layers",
            layers: [{ compId: main.id, layerId: textLayer.id }],
          },
          style,
        },
      ],
    },
    config.scriptTimeoutMs,
  );
  const target = patch.ok
    ? (patch.results[0]?.targets[0] as TextStyleTargetResult | undefined)
    : undefined;
  return { patch, target };
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

  it("set_text_style autoLeading + inspect SourceText projection", async (ctx) => {
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
            op: "set_text_style",
            selector: {
              kind: "layers",
              layers: [{ compId: main.id, layerId: textLayer.id }],
            },
            style: { autoLeading: true },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    const target = patch.results[0]?.targets[0] as TextStyleTargetResult | undefined;
    expect(target?.status).toMatch(/^(changed|already_satisfied)$/);
    expect(target?.after?.style?.autoLeading).toBe(true);

    const inspect = await getLayer(
      host,
      {
        compId: main.id,
        layerId: textLayer.id,
        detail: "extended",
        matchNames: ["ADBE Text Properties", "ADBE Text Document"],
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    const findTextDoc = (
      nodes: typeof inspect.layer.properties,
    ): { kind?: string; style?: { autoLeading?: boolean } } | null => {
      for (const n of nodes) {
        if (n.propertyValueType === "TEXT_DOCUMENT" && n.value && typeof n.value === "object") {
          return n.value as { kind?: string; style?: { autoLeading?: boolean } };
        }
        if (n.properties) {
          const nested = findTextDoc(n.properties);
          if (nested) return nested;
        }
      }
      return null;
    };
    const projected = findTextDoc(inspect.layer.properties);
    expect(projected?.kind).toBe("textDocument");
    expect(projected?.style?.autoLeading).toBe(true);

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    const fontOnly = await applyProjectPatch(
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
    expect(fontOnly.ok).toBe(true);
    if (!fontOnly.ok) return;
    const fontTarget = fontOnly.results[0]?.targets[0] as TextStyleTargetResult | undefined;
    expect(fontTarget?.status).toMatch(/^(changed|already_satisfied)$/);
    expect(fontTarget?.after?.fonts).toBeTruthy();
  });

  it("set_text_style allCaps / smallCaps via fontCapsOption round-trip", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);
    const projectPath = before.projectPath!;

    const modes: Array<{
      style: { allCaps: boolean; smallCaps: boolean };
      label: string;
    }> = [
      { style: { allCaps: true, smallCaps: false }, label: "all caps" },
      { style: { allCaps: false, smallCaps: true }, label: "small caps" },
      { style: { allCaps: true, smallCaps: true }, label: "all small caps" },
      { style: { allCaps: false, smallCaps: false }, label: "normal caps" },
    ];

    let fingerprint = before.fingerprint;
    for (const mode of modes) {
      const { patch, target } = await patchMainTextStyle(
        host,
        projectPath,
        fingerprint,
        main,
        textLayer,
        mode.style,
      );
      expect(patch.ok, mode.label).toBe(true);
      if (!patch.ok) return;
      fingerprint = patch.fingerprint;
      expect(target?.status, mode.label).toMatch(/^(changed|already_satisfied)$/);
      expect(target?.after?.style?.allCaps, mode.label).toBe(mode.style.allCaps);
      expect(target?.after?.style?.smallCaps, mode.label).toBe(mode.style.smallCaps);
    }

    // Partial from normal caps: only smallCaps true → preserve allCaps false.
    {
      const { patch, target } = await patchMainTextStyle(
        host,
        projectPath,
        fingerprint,
        main,
        textLayer,
        { smallCaps: true },
      );
      expect(patch.ok).toBe(true);
      if (!patch.ok) return;
      fingerprint = patch.fingerprint;
      expect(target?.status).toMatch(/^(changed|already_satisfied)$/);
      expect(target?.after?.style?.allCaps).toBe(false);
      expect(target?.after?.style?.smallCaps).toBe(true);
    }

    // Partial merge: only allCaps true while smallCaps on → ALL_SMALL_CAPS.
    {
      const { patch, target } = await patchMainTextStyle(
        host,
        projectPath,
        fingerprint,
        main,
        textLayer,
        { allCaps: true },
      );
      expect(patch.ok).toBe(true);
      if (!patch.ok) return;
      fingerprint = patch.fingerprint;
      expect(target?.status).toMatch(/^(changed|already_satisfied)$/);
      expect(target?.after?.style?.allCaps).toBe(true);
      expect(target?.after?.style?.smallCaps).toBe(true);
    }

    // text + partial caps: merge sibling from pre-text state (not AE reset after text write).
    {
      const { patch, target } = await patchMainTextStyle(
        host,
        projectPath,
        fingerprint,
        main,
        textLayer,
        { text: "Caps Merge Probe", allCaps: false },
      );
      expect(patch.ok).toBe(true);
      if (!patch.ok) return;
      expect(target?.status).toMatch(/^(changed|already_satisfied)$/);
      expect(target?.after?.style?.allCaps).toBe(false);
      expect(target?.after?.style?.smallCaps).toBe(true);
      expect(target?.after?.style?.text).toBe("Caps Merge Probe");
    }
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

  it("set_layer_switches toggles enabled with full switch evidence; no implicit save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);
    const desiredEnabled = textLayer.enabled === false;

    const toggled = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "set_layer_switches",
            target: { compId: main.id, layerId: textLayer.id },
            switches: { enabled: desiredEnabled },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(toggled.ok).toBe(true);
    if (!toggled.ok) return;
    const target = toggled.results[0]?.targets[0] as SetLayerSwitchesTargetResult;
    expect(toggled.results[0]?.op).toBe("set_layer_switches");
    expect(target.status).toBe("changed");
    expect(target.before?.enabled).toBe(textLayer.enabled);
    expect(target.after?.enabled).toBe(desiredEnabled);
    expect(target.before).toMatchObject({
      enabled: expect.any(Boolean),
      solo: expect.any(Boolean),
      shy: expect.any(Boolean),
      locked: expect.any(Boolean),
    });
    expect(target.after).toMatchObject({
      enabled: desiredEnabled,
      solo: target.before?.solo,
      shy: target.before?.shy,
      locked: target.before?.locked,
    });

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    expect(mid.projectPath).toBe(before.projectPath);
    expect(mid.dirty).toBe(true);
    expect(mid.fingerprint).not.toBe(before.fingerprint);
    expect(mid.fingerprint).toBe(toggled.fingerprint);
  });

  it("set_layer_transform sets Position/Anchor; already_satisfied; refuses keyframes; honest resetTransforms", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    let ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
    const inventory = await listComps(host, {}, config.scriptTimeoutMs);
    const main = inventory.compositions.find((c) => c.name === "main");
    expect(main).toBeTruthy();
    if (!main) return;

    const created = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "create_solid",
            name: "XF Solid",
            width: 600,
            height: 1100,
            pixelAspect: 1,
            color: [0.2, 0.4, 0.8],
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(created.ok, !created.ok ? created.error : undefined).toBe(true);
    if (!created.ok) return;
    const solidTarget = created.results[0]?.targets[0] as CreateSolidTargetResult;
    const solidId = solidTarget.created?.id ?? solidTarget.itemId;
    ctxToken = {
      ...ctxToken,
      fingerprint: created.fingerprint,
      dirty: created.dirty,
      revision: created.revision,
    };

    const addLayer = await host.evalScript(
      `
      var items = app.project.items;
      var comp = null;
      var solid = null;
      for (var i = 1; i <= items.length; i++) {
        if (items[i] instanceof CompItem && items[i].id === ${main.id}) comp = items[i];
        if (items[i].id === ${solidId}) solid = items[i];
      }
      if (!comp || !solid) throw new Error("comp or solid missing");
      var layer = comp.layers.add(solid);
      layer.name = "XF Layer";
      return JSON.stringify({ layerId: layer.id, compWidth: comp.width, compHeight: comp.height });
      `,
      config.scriptTimeoutMs,
    );
    expect(addLayer.ok).toBe(true);
    if (!addLayer.ok) return;
    const layerInfo = JSON.parse(addLayer.result) as {
      layerId: number;
      compWidth: number;
      compHeight: number;
    };
    ctxToken = await listProjectContext(host, config.scriptTimeoutMs);

    const setXf = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "set_layer_transform",
            target: { compId: main.id, layerId: layerInfo.layerId },
            transform: {
              anchorPoint: [300, 550],
              position: [300, 550],
            },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(setXf.ok).toBe(true);
    if (!setXf.ok) return;
    const xfTarget = setXf.results[0]?.targets[0] as SetLayerTransformTargetResult;
    expect(setXf.results[0]?.op).toBe("set_layer_transform");
    expect(xfTarget.status).toBe("changed");
    expect(xfTarget.before?.position).toBeTruthy();
    expect(xfTarget.after?.position?.[0]).toBeCloseTo(300, 2);
    expect(xfTarget.after?.position?.[1]).toBeCloseTo(550, 2);
    expect(xfTarget.after?.anchorPoint?.[0]).toBeCloseTo(300, 2);
    expect(xfTarget.after?.anchorPoint?.[1]).toBeCloseTo(550, 2);
    ctxToken = {
      ...ctxToken,
      fingerprint: setXf.fingerprint,
      dirty: setXf.dirty,
      revision: setXf.revision,
    };

    const again = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "set_layer_transform",
            target: { compId: main.id, layerId: layerInfo.layerId },
            transform: { position: [300, 550], anchorPoint: [300, 550] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const againTarget = again.results[0]?.targets[0] as SetLayerTransformTargetResult;
    expect(againTarget.status).toBe("already_satisfied");
    ctxToken = {
      ...ctxToken,
      fingerprint: again.fingerprint,
      dirty: again.dirty,
      revision: again.revision,
    };

    await host.evalScript(
      `
      var items = app.project.items;
      var comp = null;
      for (var i = 1; i <= items.length; i++) {
        if (items[i] instanceof CompItem && items[i].id === ${main.id}) { comp = items[i]; break; }
      }
      if (!comp) throw new Error("comp missing");
      var layer = null;
      for (var j = 1; j <= comp.numLayers; j++) {
        if (comp.layer(j).id === ${layerInfo.layerId}) { layer = comp.layer(j); break; }
      }
      if (!layer) throw new Error("layer missing");
      var pos = layer.property("ADBE Transform Group").property("ADBE Position");
      pos.setValueAtTime(0, [100, 100]);
      pos.setValueAtTime(1, [200, 200]);
      return "ok";
      `,
      config.scriptTimeoutMs,
    );
    ctxToken = await listProjectContext(host, config.scriptTimeoutMs);

    const keyed = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "set_layer_transform",
            target: { compId: main.id, layerId: layerInfo.layerId },
            transform: { position: [400, 400] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(keyed.ok).toBe(false);
    if (keyed.ok) return;
    const keyedTarget = keyed.results?.[0]?.targets[0] as SetLayerTransformTargetResult | undefined;
    expect(keyedTarget?.status).toBe("failed");
    expect(keyedTarget?.message).toMatch(/keyframed/i);

    ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
    const reset = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "reset_layer_surface",
            target: { compId: main.id, layerId: layerInfo.layerId },
            clearKeyframes: true,
            clearEffects: false,
            clearMasks: false,
            clearLayerStyles: false,
            clearMarkers: false,
            clearTrackMatte: false,
            clearParent: false,
            resetTransforms: true,
            clearExpressions: false,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    const resetTarget = reset.results[0]?.targets[0] as ResetLayerSurfaceTargetResult;
    expect(resetTarget.status).toBe("changed");
    expect(resetTarget.cleared).not.toHaveProperty("transforms");
    expect(resetTarget.before?.transforms?.position).toBeTruthy();
    expect(resetTarget.after?.transforms?.position?.[0]).toBeCloseTo(layerInfo.compWidth / 2, 1);
    expect(resetTarget.after?.transforms?.position?.[1]).toBeCloseTo(layerInfo.compHeight / 2, 1);
    expect(resetTarget.after?.transforms?.anchorPoint?.[0]).toBeCloseTo(300, 1);
    expect(resetTarget.after?.transforms?.anchorPoint?.[1]).toBeCloseTo(550, 1);
    expect(resetTarget.after?.transforms?.scale?.[0]).toBeCloseTo(100, 1);
    expect(resetTarget.after?.transforms?.rotation).toBeCloseTo(0, 1);
    expect(resetTarget.after?.transforms?.opacity).toBeCloseTo(100, 1);

    const afterPatch = await listProjectContext(host, config.scriptTimeoutMs);
    expect(afterPatch.projectPath).toBe(ctxToken.projectPath);
    expect(afterPatch.dirty).toBe(true);
  });

  it("set_comp_settings changes duration/work area; no implicit save", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const inventory = await listComps(host, {}, config.scriptTimeoutMs);
    const main = inventory.compositions.find((c) => c.name === "main");
    expect(main).toBeTruthy();
    if (!main) return;
    const desiredDuration = main.durationFrames + 30;
    const desiredWorkArea = desiredDuration;

    const patched = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "set_comp_settings",
            target: { compId: main.id },
            settings: {
              durationFrames: desiredDuration,
              workAreaDurationFrames: desiredWorkArea,
            },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(patched.ok).toBe(true);
    if (!patched.ok) return;
    const target = patched.results[0]?.targets[0] as SetCompSettingsTargetResult;
    expect(patched.results[0]?.op).toBe("set_comp_settings");
    expect(target.status).toBe("changed");
    expect(target.after?.durationFrames).toBe(desiredDuration);
    expect(target.after?.workAreaDurationFrames).toBe(desiredWorkArea);

    const mid = await listProjectContext(host, config.scriptTimeoutMs);
    expect(mid.projectPath).toBe(before.projectPath);
    expect(mid.dirty).toBe(true);
    expect(mid.fingerprint).toBe(patched.fingerprint);

    const relisted = await listComps(host, { compIds: [main.id] }, config.scriptTimeoutMs);
    expect(relisted.compositions[0]?.durationFrames).toBe(desiredDuration);
    expect(relisted.compositions[0]?.workAreaDurationFrames).toBe(desiredWorkArea);
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

  it("set_layer_timing leaves in/out on-grid with exact durationFrames", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    const before = await listProjectContext(host, config.scriptTimeoutMs);
    const { main, textLayer } = await mainTextLayer(host);
    const inFrame = 5;
    const outFrame = 35;
    const expectedDuration = outFrame - inFrame;

    const patch = await applyProjectPatch(
      host,
      {
        project: { path: before.projectPath!, fingerprint: before.fingerprint },
        operations: [
          {
            op: "set_layer_timing",
            target: { compId: main.id, layerId: textLayer.id },
            inFrame,
            outFrame,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    const target = patch.results[0]?.targets[0] as SetLayerTimingTargetResult;
    expect(["changed", "already_satisfied"]).toContain(target.status);
    expect(target.keyframesPreserved).toBe(true);
    expect(target.after).toMatchObject({
      inFrame,
      outFrame,
      durationFrames: expectedDuration,
    });
    expect(typeof target.after?.inPoint).toBe("number");
    expect(typeof target.after?.outPoint).toBe("number");
    expect(typeof target.after?.startTime).toBe("number");

    const fps = main.frameRate;
    const onGrid = (seconds: number, frame: number) => Math.abs(seconds * fps - frame) < 1e-6;
    expect(onGrid(target.after!.inPoint!, inFrame)).toBe(true);
    expect(onGrid(target.after!.outPoint!, outFrame)).toBe(true);
    expect(target.after!.outFrame! - target.after!.inFrame!).toBe(expectedDuration);

    const relisted = await listComps(host, {}, config.scriptTimeoutMs);
    const reLayer = relisted.compositions
      .find((c) => c.id === main.id)
      ?.layers.find((l) => l.id === textLayer.id);
    expect(reLayer?.inFrame).toBe(inFrame);
    expect(reLayer?.outFrame).toBe(outFrame);
    expect(reLayer?.durationFrames).toBe(expectedDuration);
  });

  it("set_layer_timing preserves Scale key times across frame-rate churn", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);

    /** Absolute composition-time keys — must survive fps + trim churn. */
    const expectedKey0 = 23.0;
    const expectedKey1 = 24.0;
    /** Match apply KEY_TIME_EPSILON — tighter than a frame, looser than float noise. */
    const keyTimeTol = 1e-4;

    const seeded = await host.evalScript(
      `
      var items = app.project.items;
      var comp = null;
      for (var i = 1; i <= items.length; i++) {
        if (items[i] instanceof CompItem && items[i].name === "main") { comp = items[i]; break; }
      }
      if (!comp) throw new Error("main missing");
      // Long enough for 23-24s keys under every fps we churn through.
      comp.duration = 40;
      var solid = comp.layers.addSolid([0.2, 0.4, 0.8], "LC Timing Key Solid", 200, 200, 1);
      var scale = solid.property("ADBE Transform Group").property("ADBE Scale");
      scale.setValueAtTime(${expectedKey0}, [100, 100]);
      scale.setValueAtTime(${expectedKey1}, [120, 120]);
      return JSON.stringify({
        layerId: solid.id,
        key0: scale.keyTime(1),
        key1: scale.keyTime(2),
        numKeys: scale.numKeys,
        frameRate: comp.frameRate
      });
      `,
      config.scriptTimeoutMs,
    );
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    const layerInfo = JSON.parse(seeded.result) as {
      layerId: number;
      key0: number;
      key1: number;
      numKeys: number;
      frameRate: number;
    };
    expect(layerInfo.numKeys).toBe(2);
    expect(layerInfo.key0).toBeCloseTo(expectedKey0, 5);
    expect(layerInfo.key1).toBeCloseTo(expectedKey1, 5);

    const readScaleKeys = async () => {
      const verified = await host.evalScript(
        `
        var items = app.project.items;
        var comp = null;
        for (var i = 1; i <= items.length; i++) {
          if (items[i] instanceof CompItem && items[i].name === "main") { comp = items[i]; break; }
        }
        if (!comp) throw new Error("main missing");
        var layer = null;
        for (var j = 1; j <= comp.numLayers; j++) {
          if (comp.layer(j).id === ${layerInfo.layerId}) { layer = comp.layer(j); break; }
        }
        if (!layer) throw new Error("layer missing");
        var scale = layer.property("ADBE Transform Group").property("ADBE Scale");
        return JSON.stringify({
          numKeys: scale.numKeys,
          key0: scale.keyTime(1),
          key1: scale.keyTime(2),
          val0: scale.keyValue(1),
          val1: scale.keyValue(2),
          inPoint: layer.inPoint,
          outPoint: layer.outPoint,
          startTime: layer.startTime,
          frameRate: comp.frameRate
        });
        `,
        config.scriptTimeoutMs,
      );
      expect(verified.ok).toBe(true);
      if (!verified.ok) {
        throw new Error(verified.error);
      }
      return JSON.parse(verified.result) as {
        numKeys: number;
        key0: number;
        key1: number;
        val0: number[];
        val1: number[];
        inPoint: number;
        outPoint: number;
        startTime: number;
        frameRate: number;
      };
    };

    const assertKeysPreserved = async (label: string) => {
      const afterKeys = await readScaleKeys();
      expect(afterKeys.numKeys, label).toBe(2);
      expect(Math.abs(afterKeys.key0 - expectedKey0), `${label} key0 eps`).toBeLessThan(keyTimeTol);
      expect(Math.abs(afterKeys.key1 - expectedKey1), `${label} key1 eps`).toBeLessThan(keyTimeTol);
      expect(afterKeys.val0[0], `${label} val0`).toBeCloseTo(100, 3);
      expect(afterKeys.val1[0], `${label} val1`).toBeCloseTo(120, 3);
      return afterKeys;
    };

    let ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
    const comps0 = await listComps(host, {}, config.scriptTimeoutMs);
    const main = comps0.compositions.find((c) => c.name === "main");
    expect(main).toBeDefined();
    if (!main) return;

    /**
     * Integer rates: typed `set_comp_settings` then `set_layer_timing` (full on-grid + keys).
     * NTSC-ish rates: set fps via eval (set_comp_settings uses strict frameRate equality),
     * then timing — AE float quantization can fail the 1e-6 on-grid edge check; key
     * preservation must still hold either way.
     */
    const churn: Array<{
      frameRate: number;
      inFrame: number;
      outFrame: number;
      startFrame?: number;
      via: "patch" | "eval";
      expectTimingOk: boolean;
    }> = [
      { frameRate: 24, inFrame: 0, outFrame: 90, via: "patch", expectTimingOk: true },
      {
        frameRate: 12,
        inFrame: 6,
        outFrame: 60,
        startFrame: 0,
        via: "patch",
        expectTimingOk: true,
      },
      { frameRate: 29.97, inFrame: 10, outFrame: 120, via: "eval", expectTimingOk: false },
      { frameRate: 30, inFrame: 0, outFrame: 200, via: "patch", expectTimingOk: true },
      {
        frameRate: 23.976,
        inFrame: 5,
        outFrame: 150,
        startFrame: 0,
        via: "eval",
        expectTimingOk: false,
      },
      {
        frameRate: 25,
        inFrame: 12,
        outFrame: 180,
        startFrame: -5,
        via: "patch",
        expectTimingOk: true,
      },
      { frameRate: 60, inFrame: 0, outFrame: 300, via: "patch", expectTimingOk: true },
      {
        frameRate: 48,
        inFrame: 24,
        outFrame: 240,
        startFrame: -10,
        via: "patch",
        expectTimingOk: true,
      },
      {
        frameRate: 59.94,
        inFrame: 8,
        outFrame: 240,
        startFrame: 0,
        via: "eval",
        expectTimingOk: false,
      },
      { frameRate: 15, inFrame: 0, outFrame: 75, via: "patch", expectTimingOk: true },
      {
        frameRate: layerInfo.frameRate || 30,
        inFrame: 0,
        outFrame: 45,
        via: "patch",
        expectTimingOk: true,
      },
    ];

    const setFrameRateViaEval = async (frameRate: number) => {
      const set = await host.evalScript(
        `
        var items = app.project.items;
        var comp = null;
        for (var i = 1; i <= items.length; i++) {
          if (items[i] instanceof CompItem && items[i].name === "main") { comp = items[i]; break; }
        }
        if (!comp) throw new Error("main missing");
        app.beginUndoGroup("lc-fps");
        comp.frameRate = ${frameRate};
        comp.duration = 40;
        app.endUndoGroup();
        return JSON.stringify({ frameRate: comp.frameRate, duration: comp.duration });
        `,
        config.scriptTimeoutMs,
      );
      expect(set.ok).toBe(true);
      if (!set.ok) throw new Error(set.error);
      // Fingerprint changes outside patch — re-bind before the next timing write.
      ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
      return JSON.parse(set.result) as { frameRate: number; duration: number };
    };

    for (const step of churn) {
      const label =
        `fps=${step.frameRate} via=${step.via} in=${step.inFrame} out=${step.outFrame}` +
        (step.startFrame !== undefined ? ` start=${step.startFrame}` : "");
      const durationFrames = Math.max(step.outFrame + 60, Math.ceil(40 * step.frameRate));

      let hostFps = step.frameRate;
      if (step.via === "eval") {
        const applied = await setFrameRateViaEval(step.frameRate);
        hostFps = applied.frameRate;
      }

      const timingOp: PatchProjectInput["operations"][number] = {
        op: "set_layer_timing",
        target: { compId: main.id, layerId: layerInfo.layerId },
        inFrame: step.inFrame,
        outFrame: step.outFrame,
        ...(step.startFrame !== undefined ? { startFrame: step.startFrame } : {}),
      };

      const ops: PatchProjectInput["operations"] =
        step.via === "patch"
          ? [
              {
                op: "set_comp_settings",
                target: { compId: main.id },
                settings: {
                  frameRate: step.frameRate,
                  durationFrames,
                  workAreaDurationFrames: durationFrames,
                },
              },
              timingOp,
            ]
          : [timingOp];

      const patch = await applyProjectPatch(
        host,
        {
          project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
          operations: ops,
        },
        config.scriptTimeoutMs,
      );

      const timingResult = patch.results?.find((r) => r.op === "set_layer_timing");
      const timingTarget = timingResult?.targets[0] as SetLayerTimingTargetResult | undefined;

      if (step.expectTimingOk) {
        if (!patch.ok) {
          console.error(
            `${label} FAILED`,
            patch.error,
            JSON.stringify(timingTarget ?? patch.results, null, 2),
          );
        }
        expect(patch.ok, `${label} patch ok: ${!patch.ok ? patch.error : ""}`).toBe(true);
        if (!patch.ok) return;

        if (step.via === "patch") {
          const settingsResult = patch.results.find((r) => r.op === "set_comp_settings");
          const settingsTarget = settingsResult?.targets[0] as
            | SetCompSettingsTargetResult
            | undefined;
          expect(["changed", "already_satisfied"], `${label} settings`).toContain(
            settingsTarget?.status,
          );
          expect(settingsTarget?.after?.frameRate, `${label} settings fps`).toBeCloseTo(
            step.frameRate,
            3,
          );
          hostFps = settingsTarget?.after?.frameRate ?? step.frameRate;
        }

        expect(timingTarget, label).toBeDefined();
        expect(["changed", "already_satisfied"], label).toContain(timingTarget!.status);
        expect(timingTarget!.keyframesPreserved, `${label} keyframesPreserved`).toBe(true);
        expect(timingTarget!.after?.inFrame, `${label} inFrame`).toBe(step.inFrame);
        expect(timingTarget!.after?.outFrame, `${label} outFrame`).toBe(step.outFrame);
        expect(timingTarget!.after?.durationFrames, `${label} durationFrames`).toBe(
          step.outFrame - step.inFrame,
        );
        if (step.startFrame !== undefined) {
          expect(timingTarget!.after?.startFrame, `${label} startFrame`).toBe(step.startFrame);
        }

        const onGrid = (seconds: number, frame: number) =>
          Math.abs(seconds * hostFps - frame) < 1e-6;
        expect(onGrid(timingTarget!.after!.inPoint!, step.inFrame), `${label} in on-grid`).toBe(
          true,
        );
        expect(onGrid(timingTarget!.after!.outPoint!, step.outFrame), `${label} out on-grid`).toBe(
          true,
        );

        ctxToken = {
          ...ctxToken,
          fingerprint: patch.fingerprint,
          dirty: patch.dirty,
          revision: patch.revision,
        };
      } else {
        // NTSC path: timing may fail on-grid epsilon; keys must still be preserved.
        expect(timingTarget, label).toBeDefined();
        expect(timingTarget!.keyframesPreserved, `${label} keyframesPreserved`).toBe(true);
        if (patch.ok) {
          expect(["changed", "already_satisfied"], label).toContain(timingTarget!.status);
          ctxToken = {
            ...ctxToken,
            fingerprint: patch.fingerprint,
            dirty: patch.dirty,
            revision: patch.revision,
          };
        } else {
          expect(timingTarget!.status, label).toBe("failed");
          expect(timingTarget!.message ?? patch.error, label).toMatch(/off-grid|timing/i);
          // Failed apply still mutates inside AE; re-bind for the next step.
          ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
        }
      }

      const keys = await assertKeysPreserved(label);
      expect(keys.frameRate, `${label} host fps`).toBeCloseTo(hostFps, 2);
    }

    // Final inventory cross-check after the full churn.
    const relisted = await listComps(host, {}, config.scriptTimeoutMs);
    const reMain = relisted.compositions.find((c) => c.id === main.id);
    expect(reMain?.frameRate).toBeCloseTo(churn[churn.length - 1]!.frameRate, 3);
    await assertKeysPreserved("final");
  });

  it("create_text: point and box layouts with optional style; omit name", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    let ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
    const comps = await listComps(host, {}, config.scriptTimeoutMs);
    const main = comps.compositions.find((c) => c.name === "main");
    expect(main).toBeDefined();

    const point = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "create_text",
            target: { compId: main!.id },
            layout: "point",
            text: "LC Point",
            style: { fontSize: 36 },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(point.ok, !point.ok ? point.error : undefined).toBe(true);
    if (!point.ok) return;
    const pointTarget = point.results[0]?.targets[0] as CreateTextTargetResult;
    expect(pointTarget.status).toBe("changed");
    expect(pointTarget.created?.layout).toBe("point");
    expect(pointTarget.created?.pointText).toBe(true);
    expect(pointTarget.created?.text).toBe("LC Point");
    expect(pointTarget.created?.layerId).toBeGreaterThan(0);
    expect(pointTarget.created?.name?.length).toBeGreaterThan(0);
    ctxToken = {
      ...ctxToken,
      fingerprint: point.fingerprint,
      dirty: point.dirty,
      revision: point.revision,
    };

    const box = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "create_text",
            target: { compName: "main" },
            layout: "box",
            text: "LC Box",
            boxTextSize: [320, 120],
            name: "LC Box Title",
            style: { fontSize: 40, justification: "CENTER_JUSTIFY" },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(box.ok, !box.ok ? box.error : undefined).toBe(true);
    if (!box.ok) return;
    const boxTarget = box.results[0]?.targets[0] as CreateTextTargetResult;
    expect(boxTarget.status).toBe("changed");
    expect(boxTarget.created?.layout).toBe("box");
    expect(boxTarget.created?.boxText).toBe(true);
    expect(boxTarget.created?.name).toBe("LC Box Title");
    expect(boxTarget.created?.boxTextSize?.[0]).toBeCloseTo(320, 0);
    expect(boxTarget.created?.boxTextSize?.[1]).toBeCloseTo(120, 0);
    ctxToken = {
      ...ctxToken,
      fingerprint: box.fingerprint,
      dirty: box.dirty,
      revision: box.revision,
    };

    const badStyle = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "create_text",
            target: { compId: main!.id },
            layout: "box",
            text: "orphan",
            boxTextSize: [100, 50],
            style: { leading: 20, autoLeading: true },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(badStyle.ok).toBe(false);
  });

  it("control-plane: create_solid → replace → timing/index/expression → reset → delete_layer → safe_delete", async (ctx) => {
    if (!aeReady) {
      ctx.skip();
      return;
    }
    await openWorkCopy(host, true);
    let ctxToken = await listProjectContext(host, config.scriptTimeoutMs);
    const comps = await listComps(host, {}, config.scriptTimeoutMs);
    const main = comps.compositions.find((c) => c.name === "main");
    expect(main).toBeDefined();
    const avLayer = main!.layers.find(
      (l) => l.source?.type === "footage" || l.source?.type === "comp",
    );
    expect(avLayer).toBeDefined();

    const create = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "create_solid",
            name: "LC Control Solid",
            width: 100,
            height: 100,
            pixelAspect: 1,
            color: [1, 0, 0],
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(create.ok, !create.ok ? create.error : undefined).toBe(true);
    if (!create.ok) return;
    const solidTarget = create.results[0]?.targets[0] as CreateSolidTargetResult;
    const solidId = solidTarget.created?.id ?? solidTarget.itemId;
    expect(solidId).toBeGreaterThan(0);
    ctxToken = {
      ...ctxToken,
      fingerprint: create.fingerprint,
      dirty: create.dirty,
      revision: create.revision,
    };

    const replace = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "replace_layer_source",
            target: { compId: main!.id, layerId: avLayer!.id },
            sourceItemId: solidId,
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(replace.ok).toBe(true);
    if (!replace.ok) return;
    const replaceTarget = replace.results[0]?.targets[0] as ReplaceLayerSourceTargetResult;
    const liveLayerId = replaceTarget.newLayerId ?? replaceTarget.layerId;
    expect(replaceTarget.after?.sourceItemId).toBe(solidId);
    ctxToken = {
      ...ctxToken,
      fingerprint: replace.fingerprint,
      dirty: replace.dirty,
      revision: replace.revision,
    };

    const refsInUse = await getItemRefs(host, solidId, config.scriptTimeoutMs);
    expect(refsInUse.item.id).toBe(solidId);
    expect(refsInUse).not.toHaveProperty("deletionCandidate");
    expect(refsInUse.refs.some((r) => r.kind === "layer_source")).toBe(true);

    const safeRefuseInUse = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "safe_delete_project_item",
            selector: { kind: "items", itemIds: [solidId] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(safeRefuseInUse.ok).toBe(false);

    const mutate = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "set_layer_index",
            target: { compId: main!.id, layerId: liveLayerId },
            index: 1,
          },
          {
            op: "set_layer_timing",
            target: { compId: main!.id, layerId: liveLayerId },
            inFrame: 0,
            outFrame: 30,
          },
          {
            op: "set_property_expression",
            target: { compId: main!.id, layerId: liveLayerId },
            matchNames: ["ADBE Transform Group", "ADBE Scale"],
            expression: "[100,100]",
            expressionEnabled: true,
          },
          {
            op: "reset_layer_surface",
            target: { compId: main!.id, layerId: liveLayerId },
            clearExpressions: true,
            clearKeyframes: true,
            clearEffects: true,
          },
          {
            op: "delete_layer",
            target: { compId: main!.id, layerId: liveLayerId },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    expect(mutate.ok).toBe(true);
    if (!mutate.ok) return;
    ctxToken = {
      ...ctxToken,
      fingerprint: mutate.fingerprint,
      dirty: mutate.dirty,
      revision: mutate.revision,
    };

    const refsAfter = await getItemRefs(host, solidId, config.scriptTimeoutMs);
    expect(refsAfter.refs.filter((r) => r.kind === "layer_source")).toHaveLength(0);

    const safeDel = await applyProjectPatch(
      host,
      {
        project: { path: ctxToken.projectPath!, fingerprint: ctxToken.fingerprint },
        operations: [
          {
            op: "safe_delete_project_item",
            selector: { kind: "items", itemIds: [solidId] },
          },
        ],
      },
      config.scriptTimeoutMs,
    );
    if (!refsAfter.unknownRefsPossible && refsAfter.refs.length === 0) {
      expect(safeDel.ok, !safeDel.ok ? safeDel.error : undefined).toBe(true);
    } else {
      // Heuristic incompleteness correctly blocks rather than false-allowing.
      expect(safeDel.ok).toBe(false);
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
