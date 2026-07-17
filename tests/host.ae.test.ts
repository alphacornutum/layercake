import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { assertHostConfigured, loadConfig } from "../src/config.js";
import { createAeHost } from "../src/host/create-host.js";
import { getLayer } from "../src/inventory/get-layer.js";
import { getSource } from "../src/inventory/get-source.js";
import { listComps } from "../src/inventory/list-comps.js";
import { listFolders } from "../src/inventory/list-folders.js";
import { listSources } from "../src/inventory/list-sources.js";
import type {
  CompInventory,
  InventoryComposition,
  SourceInventory,
} from "../src/inventory/types.js";

/**
 * hello-world.aep fixture layout (names are stable; ids may change on re-save):
 * - main: text "Hello World" + solid "Background"
 * - animated: shape with Position expression wiggle(1, 10) + Opacity keyframes
 * - duplicatedLayerName: two layers named "thisNameExistsTwice"
 * - withFootage: file "1x1.png" + Fast Box Blur (ADBE Box Blur2)
 * - sources: 1x1.png (file), Background (solid), thisNameExistsTwice (solid)
 */

const fixtureAep = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/hello-world.aep");
const config = loadConfig();
const hostPlatformSupported = process.platform === "darwin" || process.platform === "win32";
function isHostConfigured(): boolean {
  if (!hostPlatformSupported) {
    return false;
  }
  try {
    assertHostConfigured(config);
    return true;
  } catch {
    return false;
  }
}
const hasHost = isHostConfigured();
const hasFixture = existsSync(fixtureAep);

describe.skipIf(!hasHost)("After Effects host smoke", () => {
  it("reports available host status and can ensure session", async () => {
    const host = createAeHost(config);
    const status = await host.status();
    expect(status.available).toBe(true);
    if (process.platform === "win32") {
      expect(status.executable).toBeTruthy();
    } else {
      expect(status.appName).toBeTruthy();
    }
    await host.ensureSession();
  });
});

describe.skipIf(!hasHost || !hasFixture)("After Effects project + ExtendScript", () => {
  it("opens fixture and evaluates app.project.numItems", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const result = await host.evalScript("return app.project.numItems;", config.scriptTimeoutMs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number(result.result)).toBeGreaterThanOrEqual(0);
    }
  });

  it("lists compositions and layers with stable ids via ae_list_comps path", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const inventory = await listComps(host, {}, config.scriptTimeoutMs);
    expectFixtureComps(inventory);
    for (const comp of inventory.compositions) {
      expect(typeof comp.id).toBe("number");
      expect(typeof comp.name).toBe("string");
      expect(Array.isArray(comp.layers)).toBe(true);
      for (const layer of comp.layers) {
        expect(typeof layer.id).toBe("number");
        expect(typeof layer.index).toBe("number");
        expect(typeof layer.type).toBe("string");
        expect(typeof layer.label).toBe("number");
        expect(typeof layer.hasEffects).toBe("boolean");
        if (layer.source) {
          expect(typeof layer.source.id).toBe("number");
          expect(typeof layer.source.name).toBe("string");
          expect(["footage", "comp"]).toContain(layer.source.type);
          expect(typeof layer.source.parentFolderId).toBe("number");
          expect(typeof layer.source.folderPath).toBe("string");
          if (layer.source.type === "footage") {
            expect(["file", "solid", "placeholder"]).toContain(layer.source.footageKind);
          } else {
            expect(layer.source.footageKind).toBeUndefined();
          }
        }
      }
    }
  });

  it("lists footage sources with metadata via ae_list_sources path", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const inventory = await listSources(host, config.scriptTimeoutMs);
    expectFixtureSources(inventory);
    for (const source of inventory.sources) {
      expect(typeof source.id).toBe("number");
      expect(typeof source.name).toBe("string");
      expect(["file", "solid", "placeholder"]).toContain(source.footageKind);
      expect(typeof source.parentFolderId).toBe("number");
      expect(typeof source.folderPath).toBe("string");
      expect(Array.isArray(source.usedInCompIds)).toBe(true);
      expect(typeof source.footageMissing).toBe("boolean");
    }
  });

  it("lists project folder hierarchy via ae_list_folders path", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const inventory = await listFolders(host, config.scriptTimeoutMs);
    expect(inventory.root.type).toBe("folder");
    expect(inventory.root.name.length).toBeGreaterThan(0);
    expect(typeof inventory.root.id).toBe("number");
    expect(Array.isArray(inventory.root.children)).toBe(true);

    const names = collectFolderNames(inventory.root);
    expect(names).toEqual(expect.arrayContaining(["footage", "Solids"]));

    const walk = (node: (typeof inventory.root)["children"][number]) => {
      expect(typeof node.id).toBe("number");
      expect(typeof node.name).toBe("string");
      if (node.type === "folder") {
        expect(Array.isArray(node.children)).toBe(true);
        for (const child of node.children) walk(child);
      } else if (node.type === "footage") {
        expect(["file", "solid", "placeholder"]).toContain(node.footageKind);
      } else {
        expect(node.type).toBe("comp");
      }
    };
    for (const child of inventory.root.children) walk(child);
  });

  it("ae_get_layer: animated expression + keyframes (overview vs extended)", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);

    const overview = await getLayer(
      host,
      {
        compName: "animated",
        layerName: "Shape Layer 1",
        detail: "overview",
        matchNames: ["ADBE Transform Group"],
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(overview.detail).toBe("overview");
    expect(overview.comp.name).toBe("animated");
    expect(overview.layer.name).toBe("Shape Layer 1");
    expect(overview.layer.type).toBe("shape");

    const overviewPos = findPropertyByMatchName(overview.layer.properties, "ADBE Position");
    const overviewOpacity = findPropertyByMatchName(overview.layer.properties, "ADBE Opacity");
    expect(overviewPos?.hasExpression).toBe(true);
    expect(overviewPos?.expression).toBeUndefined();
    expect(overviewPos?.value).toBeUndefined();
    expect(overviewOpacity?.numKeys).toBe(2);
    expect(overviewOpacity?.keyframes).toBeUndefined();

    const extended = await getLayer(
      host,
      {
        compName: "animated",
        layerName: "Shape Layer 1",
        detail: "extended",
        matchNames: ["ADBE Transform Group"],
        atTime: 0,
        preExpression: true,
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(extended.detail).toBe("extended");
    expect(extended.atTime).toBe(0);
    expect(extended.preExpression).toBe(true);

    const pos = findPropertyByMatchName(extended.layer.properties, "ADBE Position");
    expect(pos?.expression).toBe("wiggle(1, 10)");
    expect(pos?.expressionEnabled).toBe(true);
    expect(Array.isArray(pos?.value)).toBe(true);

    const opacity = findPropertyByMatchName(extended.layer.properties, "ADBE Opacity");
    expect(opacity?.keyframes).toHaveLength(2);
    expect(opacity!.keyframes![0]).toMatchObject({ time: 0, value: 0 });
    expect(opacity!.keyframes![1]!.time).toBeCloseTo(2.76, 2);
    expect(opacity!.keyframes![1]!.value).toBe(99);
  });

  it("ae_get_layer: ambiguous duplicate layer name + effect matchNames", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);

    await expect(
      getLayer(
        host,
        {
          compName: "duplicatedLayerName",
          layerName: "thisNameExistsTwice",
          detail: "overview",
        },
        config.scriptTimeoutMs,
        config.inspectMaxBytes,
      ),
    ).rejects.toThrow(/ambiguous layer name/i);

    const ambiguous = await getLayer(
      host,
      {
        compName: "duplicatedLayerName",
        layerName: "thisNameExistsTwice",
        detail: "overview",
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    ).then(
      () => {
        throw new Error("expected ambiguous layer name to reject");
      },
      (err: unknown) => (err instanceof Error ? err.message : String(err)),
    );
    expect(ambiguous).toContain("thisNameExistsTwice");
    expect(ambiguous).toMatch(/"id"\s*:/);
    expect(ambiguous).toMatch(/"index"\s*:/);

    const effects = await getLayer(
      host,
      {
        compName: "withFootage",
        layerName: "1x1.png",
        detail: "overview",
        matchNames: ["ADBE Effect Parade"],
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(effects.layer.hasEffects).toBe(true);
    expect(effects.layer.source?.footageKind).toBe("file");
    expect(effects.layer.properties).toHaveLength(1);
    expect(effects.layer.properties[0]!.matchName).toBe("ADBE Effect Parade");
    const blur = findPropertyByMatchName(effects.layer.properties, "ADBE Box Blur2");
    expect(blur?.name).toBe("Fast Box Blur");
    expect(blur?.isGroup).toBe(true);
  });

  it("ae_get_layer: id lookup, full tier, and not-found", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const inventory = await listComps(host, {}, config.scriptTimeoutMs);
    const main = requireComp(inventory, "main");
    const hello = main.layers.find((l) => l.name === "Hello World");
    expect(hello, "main must contain Hello World text layer").toBeTruthy();

    const byId = await getLayer(
      host,
      { compId: main.id, layerId: hello!.id, detail: "overview" },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(byId.layer.type).toBe("text");
    expect(byId.layer.name).toBe("Hello World");

    const full = await getLayer(
      host,
      {
        compName: "animated",
        layerName: "Shape Layer 1",
        detail: "full",
        matchNames: ["ADBE Opacity"],
      },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(full.detail).toBe("full");
    const opacity = findPropertyByMatchName(full.layer.properties, "ADBE Opacity");
    expect(opacity?.keyframes?.length).toBe(2);
    expect(opacity!.keyframes![0]!.inInterpolationType).toBeDefined();

    await expect(
      getLayer(
        host,
        { compName: "main", layerId: 999_999_999, detail: "overview" },
        config.scriptTimeoutMs,
        config.inspectMaxBytes,
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("ae_get_source: file full interpret, solid overview, name lookup, not-found", async () => {
    const host = createAeHost(config);
    await host.openProject(fixtureAep);
    const inventory = await listSources(host, config.scriptTimeoutMs);
    const png = inventory.sources.find((s) => s.name === "1x1.png");
    const solid = inventory.sources.find((s) => s.name === "Background");
    expect(png, "fixture must include 1x1.png").toBeTruthy();
    expect(solid, "fixture must include Background solid").toBeTruthy();

    const overview = await getSource(
      host,
      { sourceName: "1x1.png", detail: "overview" },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(overview.detail).toBe("overview");
    expect(overview.source.footageKind).toBe("file");
    expect(overview.source.width).toBe(1);
    expect(overview.source.height).toBe(1);
    expect(overview.source.file).toMatch(/1x1\.png$/);
    expect(overview.source.interpret).toBeDefined();
    expect(overview.source.mainSource).toBeUndefined();

    const full = await getSource(
      host,
      { sourceId: png!.id, detail: "full" },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(full.detail).toBe("full");
    expect(full.source.mainSource?.kind).toBe("file");
    expect(full.source.mainSource?.file).toMatch(/1x1\.png$/);
    expect(full.source.mainSource?.isStill).toBe(true);
    expect(full.source.mainSource?.alphaMode).toBeTruthy();
    expect(full.source.proxySource).toBeNull();

    const solidOverview = await getSource(
      host,
      { sourceId: solid!.id, detail: "overview" },
      config.scriptTimeoutMs,
      config.inspectMaxBytes,
    );
    expect(solidOverview.source.footageKind).toBe("solid");
    expect(solidOverview.source.solidColor).toHaveLength(3);

    await expect(
      getSource(
        host,
        { sourceId: 999_999_999, detail: "overview" },
        config.scriptTimeoutMs,
        config.inspectMaxBytes,
      ),
    ).rejects.toThrow(/not found/i);
  });
});

function expectFixtureComps(inventory: CompInventory): void {
  const names = inventory.compositions.map((c) => c.name).sort();
  expect(names).toEqual(["animated", "duplicatedLayerName", "main", "withFootage"]);

  const animated = requireComp(inventory, "animated");
  expect(animated.layers).toHaveLength(1);
  expect(animated.layers[0]!.name).toBe("Shape Layer 1");
  expect(animated.layers[0]!.type).toBe("shape");

  const dup = requireComp(inventory, "duplicatedLayerName");
  expect(dup.layers).toHaveLength(2);
  expect(dup.layers.every((l) => l.name === "thisNameExistsTwice")).toBe(true);

  const main = requireComp(inventory, "main");
  expect(main.layers.map((l) => l.name).sort()).toEqual(["Background", "Hello World"]);

  const withFootage = requireComp(inventory, "withFootage");
  expect(withFootage.layers).toHaveLength(1);
  expect(withFootage.layers[0]!.name).toBe("1x1.png");
  expect(withFootage.layers[0]!.hasEffects).toBe(true);
  expect(withFootage.layers[0]!.source?.footageKind).toBe("file");
}

function expectFixtureSources(inventory: SourceInventory): void {
  const byName = new Map(inventory.sources.map((s) => [s.name, s]));
  expect(byName.has("1x1.png")).toBe(true);
  expect(byName.has("Background")).toBe(true);
  expect(byName.has("thisNameExistsTwice")).toBe(true);
  expect(byName.get("1x1.png")!.footageKind).toBe("file");
  expect(byName.get("Background")!.footageKind).toBe("solid");
  expect(byName.get("1x1.png")!.file).toMatch(/1x1\.png$/);
}

function requireComp(inventory: CompInventory, name: string): InventoryComposition {
  const comp = inventory.compositions.find((c) => c.name === name);
  expect(comp, `fixture must contain composition "${name}"`).toBeTruthy();
  return comp!;
}

type PropNode = {
  name: string;
  matchName: string;
  isGroup: boolean;
  expression?: string;
  expressionEnabled?: boolean;
  keyframes?: Array<{ time: number; value: unknown; inInterpolationType?: string }>;
  value?: unknown;
  numKeys?: number;
  hasExpression?: boolean;
  properties?: PropNode[];
};

function findPropertyByMatchName(nodes: PropNode[], matchName: string): PropNode | undefined {
  for (const node of nodes) {
    if (node.matchName === matchName) return node;
    if (node.properties) {
      const found = findPropertyByMatchName(node.properties, matchName);
      if (found) return found;
    }
  }
  return undefined;
}

function collectFolderNames(root: {
  type: string;
  name: string;
  children?: Array<{ type: string; name: string; children?: unknown[] }>;
}): string[] {
  const names: string[] = [];
  const walk = (node: {
    type: string;
    name: string;
    children?: Array<{ type: string; name: string; children?: unknown[] }>;
  }) => {
    if (node.type === "folder") {
      names.push(node.name);
      for (const child of node.children ?? []) {
        walk(child as typeof node);
      }
    }
  };
  walk(root);
  return names;
}
