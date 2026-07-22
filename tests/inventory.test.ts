import { describe, expect, it } from "vitest";

import { applyCompFilters } from "../src/inventory/filter.js";
import {
  classifyEffectOrigin,
  getFirstPartyEffectAllowlist,
} from "../src/inventory/effect-origin.js";
import { LIST_COMPS_SCRIPT } from "../src/inventory/list-comps-script.js";
import { LIST_FOLDERS_SCRIPT } from "../src/inventory/list-folders-script.js";
import { LIST_PROJECT_CONTEXT_SCRIPT } from "../src/inventory/list-project-context-script.js";
import { LIST_PROJECT_SUMMARY_SCRIPT } from "../src/inventory/list-project-summary-script.js";
import { LIST_SOURCES_SCRIPT } from "../src/inventory/list-sources-script.js";
import {
  parseCompInventory,
  parseFolderInventory,
  parseItemRefs,
  parseProjectContext,
  parseProjectSummary,
  parseSourceInventory,
} from "../src/inventory/parse.js";
import { buildFingerprint } from "../src/inventory/fingerprint.js";
import { loadAeHelperScript, loadAeScript } from "../src/host/load-ae-script.js";
import { buildGetItemRefsScript } from "../src/inventory/item-refs-script.js";
import type {
  CompInventory,
  FolderInventory,
  ItemRefsResult,
  SourceInventory,
} from "../src/inventory/types.js";

const defaultCompSwitches = {
  motionBlur: false,
  frameBlending: false,
  draft3d: false,
  hideShyLayers: false,
  dropFrame: false,
  preserveNestedResolution: false,
};

const sample: CompInventory = {
  projectName: "Demo.aep",
  compositions: [
    {
      id: 101,
      name: "Main",
      duration: 10,
      frameRate: 30,
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      durationFrames: 300,
      displayStartFrame: 0,
      workAreaStartFrame: 0,
      workAreaDurationFrames: 300,
      renderer: "ADBE Advanced 3d",
      switches: { ...defaultCompSwitches },
      numLayers: 4,
      layers: [
        {
          id: 42,
          index: 1,
          name: "Logo",
          type: "av",
          inPoint: 0,
          outPoint: 5,
          duration: 5,
          stretch: 100,
          startTime: 0,
          startFrame: 0,
          inFrame: 0,
          outFrame: 150,
          durationFrames: 150,
          motionBlur: false,
          label: 3,
          hasEffects: true,
          enabled: true,
          hasVideo: true,
          videoEnabled: true,
          guideLayer: false,
          adjustmentLayer: false,
          threeDLayer: false,
          collapseTransformation: false,
          frameBlending: false,
          timeRemapEnabled: false,
          source: {
            id: 55,
            name: "logo.png",
            type: "footage",
            footageKind: "file",
            parentFolderId: 12,
            folderPath: "Assets/Logos",
          },
        },
        {
          id: 43,
          index: 2,
          name: "Precomp Layer",
          type: "av",
          inPoint: 0,
          outPoint: 4,
          duration: 4,
          stretch: 100,
          startTime: 0,
          startFrame: 0,
          inFrame: 0,
          outFrame: 120,
          durationFrames: 120,
          motionBlur: false,
          label: 0,
          hasEffects: false,
          enabled: true,
          timeRemapEnabled: false,
          parentLayerId: 42,
          source: {
            id: 202,
            name: "Precomp",
            type: "comp",
            parentFolderId: 1,
            folderPath: "",
          },
        },
        {
          id: 45,
          index: 3,
          name: "Control Solid",
          type: "av",
          inPoint: 0,
          outPoint: 10,
          duration: 10,
          stretch: 100,
          startTime: 1,
          startFrame: 30,
          inFrame: 0,
          outFrame: 300,
          durationFrames: 300,
          motionBlur: false,
          label: 0,
          hasEffects: false,
          enabled: true,
          guideLayer: true,
          timeRemapEnabled: false,
          trackMatteType: "ALPHA",
          trackMatteLayerId: 42,
          source: {
            id: 56,
            name: "Red Solid",
            type: "footage",
            footageKind: "solid",
            parentFolderId: 1,
            folderPath: "",
          },
        },
        {
          id: 44,
          index: 4,
          name: "Camera 1",
          type: "camera",
          inPoint: 0,
          outPoint: 10,
          duration: 10,
          stretch: 100,
          startTime: 0,
          startFrame: 0,
          inFrame: 0,
          outFrame: 300,
          durationFrames: 300,
          motionBlur: false,
          label: 0,
          hasEffects: false,
          enabled: true,
        },
      ],
    },
    {
      id: 202,
      name: "Precomp",
      duration: 4,
      frameRate: 30,
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      durationFrames: 120,
      displayStartFrame: 0,
      workAreaStartFrame: 0,
      workAreaDurationFrames: 120,
      renderer: "ADBE Advanced 3d",
      switches: { ...defaultCompSwitches },
      numLayers: 0,
      layers: [],
    },
  ],
  missing: { compIds: [], compNames: [] },
};

const sourcesSample: SourceInventory = {
  projectName: "Demo.aep",
  sources: [
    {
      id: 55,
      name: "logo.png",
      label: 0,
      comment: "",
      footageKind: "file",
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      frameRate: 30,
      duration: 0,
      hasVideo: true,
      hasAudio: false,
      footageMissing: false,
      isStill: true,
      useProxy: false,
      file: "/Users/me/project/logo.png",
      missingFootagePath: null,
      solidColor: null,
      parentFolderId: 12,
      folderPath: "Assets/Logos",
      usedInCompIds: [101],
    },
    {
      id: 56,
      name: "Red Solid",
      label: 1,
      comment: "bg",
      footageKind: "solid",
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      frameRate: 30,
      duration: 0,
      hasVideo: true,
      hasAudio: false,
      footageMissing: false,
      isStill: true,
      useProxy: false,
      file: null,
      missingFootagePath: null,
      solidColor: [1, 0, 0],
      parentFolderId: 1,
      folderPath: "",
      usedInCompIds: [],
    },
    {
      id: 57,
      name: "Placeholder",
      label: 0,
      comment: "",
      footageKind: "placeholder",
      width: 640,
      height: 480,
      pixelAspect: 1,
      frameRate: 24,
      duration: 10,
      hasVideo: true,
      hasAudio: false,
      footageMissing: true,
      isStill: false,
      useProxy: false,
      file: null,
      missingFootagePath: null,
      solidColor: null,
      parentFolderId: 1,
      folderPath: "",
      usedInCompIds: [],
    },
    {
      id: 58,
      name: "missing.mov",
      label: 0,
      comment: "",
      footageKind: "file",
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      frameRate: 30,
      duration: 5,
      hasVideo: true,
      hasAudio: true,
      footageMissing: true,
      isStill: false,
      useProxy: false,
      file: null,
      missingFootagePath: "/old/path/missing.mov",
      solidColor: null,
      parentFolderId: 12,
      folderPath: "Assets/Logos",
      usedInCompIds: [101],
    },
  ],
};

const foldersSample: FolderInventory = {
  projectName: "Demo.aep",
  root: {
    id: 1,
    name: "Root",
    type: "folder",
    children: [
      {
        id: 12,
        name: "Assets",
        type: "folder",
        children: [
          {
            id: 13,
            name: "Logos",
            type: "folder",
            children: [
              {
                id: 55,
                name: "logo.png",
                type: "footage",
                footageKind: "file",
              },
            ],
          },
          {
            id: 14,
            name: "Empty",
            type: "folder",
            children: [],
          },
        ],
      },
      {
        id: 101,
        name: "Main",
        type: "comp",
      },
      {
        id: 56,
        name: "Red Solid",
        type: "footage",
        footageKind: "solid",
      },
    ],
  },
};

describe("parseCompInventory", () => {
  it("parses a valid payload shape", () => {
    const parsed = parseCompInventory(JSON.stringify(sample));
    expect(parsed.projectName).toBe("Demo.aep");
    expect(parsed.compositions).toHaveLength(2);
    expect(parsed.compositions[0]!.layers[0]!.id).toBe(42);
    expect(parsed.compositions[0]!.layers[0]!.hasEffects).toBe(true);
    expect(parsed.compositions[0]).toMatchObject({
      width: 1920,
      height: 1080,
      pixelAspect: 1,
      durationFrames: 300,
      displayStartFrame: 0,
      workAreaStartFrame: 0,
      workAreaDurationFrames: 300,
      renderer: "ADBE Advanced 3d",
      switches: defaultCompSwitches,
    });
    expect(parsed).not.toHaveProperty("folded");
    expect(JSON.stringify(parsed)).not.toMatch(/folded/i);
  });

  it("parses layer source refs for footage and precomp layers", () => {
    const parsed = parseCompInventory(JSON.stringify(sample));
    const layers = parsed.compositions[0]!.layers;
    expect(layers[0]!.source).toEqual({
      id: 55,
      name: "logo.png",
      type: "footage",
      footageKind: "file",
      parentFolderId: 12,
      folderPath: "Assets/Logos",
    });
    expect(layers[1]!.source).toEqual({
      id: 202,
      name: "Precomp",
      type: "comp",
      parentFolderId: 1,
      folderPath: "",
    });
    expect(layers[1]!.source).not.toHaveProperty("footageKind");
  });

  it("omits source on layers without one", () => {
    const parsed = parseCompInventory(JSON.stringify(sample));
    expect(parsed.compositions[0]!.layers[3]!).not.toHaveProperty("source");
  });

  it("parses control-plane timing, switches, parent/matte, and solid footageKind", () => {
    const parsed = parseCompInventory(JSON.stringify(sample));
    const layers = parsed.compositions[0]!.layers;
    expect(layers[0]).toMatchObject({
      startTime: 0,
      startFrame: 0,
      inFrame: 0,
      outFrame: 150,
      durationFrames: 150,
      enabled: true,
      timeRemapEnabled: false,
    });
    expect(layers[1]!.parentLayerId).toBe(42);
    expect(layers[2]).toMatchObject({
      startFrame: 30,
      guideLayer: true,
      trackMatteType: "ALPHA",
      trackMatteLayerId: 42,
      source: { type: "footage", footageKind: "solid" },
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseCompInventory("not-json")).toThrow(/not valid JSON/i);
  });

  it("rejects unknown layer types", () => {
    const bad = structuredClone(sample);
    // @ts-expect-error intentional invalid type
    bad.compositions[0]!.layers[0]!.type = "bogus";
    expect(() => parseCompInventory(JSON.stringify(bad))).toThrow(/layer type/i);
  });
});

describe("applyCompFilters", () => {
  it("returns all compositions when no filter is provided", () => {
    const result = applyCompFilters(sample, {});
    expect(result.compositions).toHaveLength(2);
    expect(result.missing).toEqual({ compIds: [], compNames: [] });
  });

  it("filters by composition id", () => {
    const result = applyCompFilters(sample, { compIds: [202] });
    expect(result.compositions.map((c) => c.id)).toEqual([202]);
    expect(result.missing).toEqual({ compIds: [], compNames: [] });
  });

  it("filters by composition name", () => {
    const result = applyCompFilters(sample, { compNames: ["Main"] });
    expect(result.compositions.map((c) => c.name)).toEqual(["Main"]);
  });

  it("uses union matching for combined filters", () => {
    const result = applyCompFilters(sample, {
      compIds: [202],
      compNames: ["Main"],
    });
    expect(result.compositions.map((c) => c.id).sort()).toEqual([101, 202]);
  });

  it("reports unmatched filter entries under missing", () => {
    const result = applyCompFilters(sample, {
      compIds: [101, 999],
      compNames: ["Main", "Nope"],
    });
    expect(result.compositions).toHaveLength(1);
    expect(result.compositions[0]!.id).toBe(101);
    expect(result.missing).toEqual({
      compIds: [999],
      compNames: ["Nope"],
    });
  });
});

describe("helpers-inventory emit", () => {
  it("exposes folder placement, footage kind, serializeSourceRef, and time↔frame helpers", () => {
    const helpers = loadAeHelperScript("helpers-inventory");
    expect(helpers).toContain("function folderPlacement");
    expect(helpers).toContain("function footageKindOf");
    expect(helpers).toContain("function serializeSourceRef");
    expect(helpers).toContain("FileSource");
    expect(helpers).toContain("SolidSource");
    expect(helpers).toContain("PlaceholderSource");
    expect(helpers).toContain("function timeToFrame");
    expect(helpers).toContain("function frameToTime");
    expect(helpers).toContain("function isOnGridFrame");
    expect(helpers).toContain("function layerTimingFrames");
    expect(helpers).toContain("function transformMatchName");
    expect(helpers).toContain("function isCoreTransformMatchName");
    expect(helpers).toContain("function readCompSwitches");
    expect(helpers).toContain("function readDisplayStartFrame");
    expect(helpers).toContain("function compSwitchKeys");
    expect(helpers).toContain('"preserveNestedResolution"');
  });

  it("treats frame/fps seconds as on-grid (including non-integer fps)", () => {
    const helpers = new Function(`
      ${loadAeHelperScript("helpers-inventory")}
      return {
        timeToFrame: timeToFrame,
        frameToTime: frameToTime,
        isOnGridFrame: isOnGridFrame
      };
    `)() as {
      timeToFrame: (time: number, frameRate: number) => number;
      frameToTime: (frame: number, frameRate: number) => number;
      isOnGridFrame: (time: number, frame: number, frameRate: number) => boolean;
    };

    for (const fps of [24, 30, 23.976, 29.97]) {
      const frame = 518;
      const seconds = helpers.frameToTime(frame, fps);
      expect(helpers.timeToFrame(seconds, fps)).toBe(frame);
      expect(helpers.isOnGridFrame(seconds, frame, fps)).toBe(true);
      // Half-frame offset is off-grid for every integer frame (including the nearest).
      const offGrid = seconds + 0.5 / fps;
      const nearest = helpers.timeToFrame(offGrid, fps);
      expect(helpers.isOnGridFrame(offGrid, frame, fps)).toBe(false);
      expect(helpers.isOnGridFrame(offGrid, nearest, fps)).toBe(false);
    }

    // Tiny float noise under epsilon stays on-grid; larger drift does not.
    const fps = 29.97;
    const frame = 100;
    const exact = frame / fps;
    expect(helpers.isOnGridFrame(exact + 1e-10, frame, fps)).toBe(true);
    expect(helpers.isOnGridFrame(exact + 1e-4, frame, fps)).toBe(false);
  });
});

describe("parseItemRefs", () => {
  const sampleRefs: ItemRefsResult = {
    item: { id: 56, name: "Red Solid", type: "footage" },
    refs: [
      { kind: "used_in_comp", compId: 101, compName: "Main" },
      { kind: "layer_source", compId: 101, layerId: 45, layerName: "Control Solid" },
      { kind: "parent_link", compId: 101, layerId: 43, parentLayerId: 45 },
    ],
    unknownRefsPossible: false,
    incompleteReasons: [],
  };

  it("parses a valid refs payload", () => {
    const parsed = parseItemRefs(JSON.stringify(sampleRefs));
    expect(parsed.item.id).toBe(56);
    expect(parsed.refs).toHaveLength(3);
    expect(parsed.unknownRefsPossible).toBe(false);
    expect(parsed).not.toHaveProperty("deletionCandidate");
  });

  it("rejects deletionCandidate policy bits", () => {
    expect(() => parseItemRefs(JSON.stringify({ ...sampleRefs, deletionCandidate: true }))).toThrow(
      /deletionCandidate/,
    );
  });
});

describe("item refs script", () => {
  it("loads the self-contained get-item-refs entry with an itemId preamble", () => {
    const entry = loadAeScript("get-item-refs");
    expect(entry).toContain("collectItemRefs");
    expect(entry).toContain("unknownRefsPossible");
    const script = buildGetItemRefsScript(56);
    expect(script).toContain('"itemId":56');
    expect(script).toContain("collectItemRefs");
    expect(script).not.toContain("function folderPlacement");
    // Bundled entry has one main; do not prepend helpers-inventory (second main).
    expect(script.match(/function main\b/g)?.length).toBe(1);
  });
});

describe("LIST_COMPS_SCRIPT", () => {
  it("is non-empty ExtendScript that uses JSON.stringify and shared helpers", () => {
    expect(LIST_COMPS_SCRIPT.length).toBeGreaterThan(100);
    expect(LIST_COMPS_SCRIPT).toContain("CompItem");
    expect(LIST_COMPS_SCRIPT).toContain("JSON.stringify");
    expect(LIST_COMPS_SCRIPT).toContain("Layer.id is unavailable");
    expect(LIST_COMPS_SCRIPT).toContain("No After Effects project is open");
    expect(LIST_COMPS_SCRIPT).toContain("serializeSourceRef");
    expect(LIST_COMPS_SCRIPT).toContain("payload.source");
    expect(LIST_COMPS_SCRIPT).toContain("timeToFrame");
    expect(LIST_COMPS_SCRIPT).toContain("startFrame");
    expect(LIST_COMPS_SCRIPT).toContain("parentLayerId");
    expect(LIST_COMPS_SCRIPT).toContain("timeRemapEnabled");
    expect(LIST_COMPS_SCRIPT).toContain("trackMatteLayerId");
  });
});

describe("parseSourceInventory", () => {
  it("parses file, solid, placeholder, and missing footage cases", () => {
    const parsed = parseSourceInventory(JSON.stringify(sourcesSample));
    expect(parsed.projectName).toBe("Demo.aep");
    expect(parsed.sources).toHaveLength(4);

    const file = parsed.sources[0]!;
    expect(file.footageKind).toBe("file");
    expect(file.file).toBe("/Users/me/project/logo.png");
    expect(file.solidColor).toBeNull();
    expect(file.usedInCompIds).toEqual([101]);
    expect(file.folderPath).toBe("Assets/Logos");

    const solid = parsed.sources[1]!;
    expect(solid.footageKind).toBe("solid");
    expect(solid.file).toBeNull();
    expect(solid.solidColor).toEqual([1, 0, 0]);

    const placeholder = parsed.sources[2]!;
    expect(placeholder.footageKind).toBe("placeholder");
    expect(placeholder.footageMissing).toBe(true);

    const missing = parsed.sources[3]!;
    expect(missing.footageMissing).toBe(true);
    expect(missing.file).toBeNull();
    expect(missing.missingFootagePath).toBe("/old/path/missing.mov");
  });

  it("parses an empty sources array", () => {
    const parsed = parseSourceInventory(JSON.stringify({ projectName: "Empty.aep", sources: [] }));
    expect(parsed.sources).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseSourceInventory("not-json")).toThrow(/not valid JSON/i);
  });

  it("rejects unknown footageKind", () => {
    const bad = structuredClone(sourcesSample);
    // @ts-expect-error intentional invalid kind
    bad.sources[0]!.footageKind = "bogus";
    expect(() => parseSourceInventory(JSON.stringify(bad))).toThrow(/footageKind/i);
  });
});

describe("LIST_SOURCES_SCRIPT", () => {
  it("inventories FootageItems with shared helpers", () => {
    expect(LIST_SOURCES_SCRIPT).toContain("FootageItem");
    expect(LIST_SOURCES_SCRIPT).toContain("usedInCompIds");
    expect(LIST_SOURCES_SCRIPT).toContain("footageKindOf");
    expect(LIST_SOURCES_SCRIPT).toContain("folderPlacement");
    expect(LIST_SOURCES_SCRIPT).toContain("JSON.stringify");
  });
});

describe("parseFolderInventory", () => {
  it("parses nested folders, empty folders, and mixed children", () => {
    const parsed = parseFolderInventory(JSON.stringify(foldersSample));
    expect(parsed.projectName).toBe("Demo.aep");
    expect(parsed.root.name).toBe("Root");
    expect(parsed.root.type).toBe("folder");
    expect(parsed.root.children).toHaveLength(3);

    const assets = parsed.root.children[0]!;
    expect(assets).toMatchObject({ id: 12, name: "Assets", type: "folder" });
    if (assets.type !== "folder") throw new Error("expected folder");
    expect(assets.children).toHaveLength(2);

    const logos = assets.children[0]!;
    expect(logos).toMatchObject({ id: 13, name: "Logos", type: "folder" });
    if (logos.type !== "folder") throw new Error("expected folder");
    expect(logos.children[0]).toEqual({
      id: 55,
      name: "logo.png",
      type: "footage",
      footageKind: "file",
    });

    const empty = assets.children[1]!;
    expect(empty).toMatchObject({ id: 14, name: "Empty", type: "folder", children: [] });

    expect(parsed.root.children[1]).toEqual({ id: 101, name: "Main", type: "comp" });
    expect(parsed.root.children[2]).toEqual({
      id: 56,
      name: "Red Solid",
      type: "footage",
      footageKind: "solid",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseFolderInventory("not-json")).toThrow(/not valid JSON/i);
  });
});

describe("LIST_FOLDERS_SCRIPT", () => {
  it("walks rootFolder with Root name fallback", () => {
    expect(LIST_FOLDERS_SCRIPT).toContain("rootFolder");
    expect(LIST_FOLDERS_SCRIPT).toContain('name = "Root"');
    expect(LIST_FOLDERS_SCRIPT).toContain("FolderItem");
    expect(LIST_FOLDERS_SCRIPT).toContain("footageKindOf");
    expect(LIST_FOLDERS_SCRIPT).toContain("JSON.stringify");
  });
});

describe("classifyEffectOrigin", () => {
  it("classifies ADBE and non-ADBE stock effects as first-party", () => {
    expect(classifyEffectOrigin("ADBE Gaussian Blur 2")).toBe("firstParty");
    expect(classifyEffectOrigin("CC Radial Blur")).toBe("firstParty");
    expect(classifyEffectOrigin("EXtractoR")).toBe("firstParty");
  });

  it("classifies unknown matchNames as third-party", () => {
    expect(classifyEffectOrigin("tc Particular")).toBe("thirdParty");
    expect(classifyEffectOrigin("VIDEOCOPILOT OpticalFlares")).toBe("thirdParty");
  });

  it("loads a non-empty allowlist from the generated corpus", () => {
    expect(getFirstPartyEffectAllowlist().size).toBeGreaterThan(50);
    expect(getFirstPartyEffectAllowlist().has("CC Radial Blur")).toBe(true);
  });
});

describe("parseProjectSummary", () => {
  const summaryFixture = {
    projectName: "Demo.aep",
    projectPath: "/tmp/Demo.aep",
    aeVersion: "25.0.0",
    numComps: 2,
    numFootage: 3,
    numFolders: 1,
    numLayers: 5,
    bitsPerChannel: 8,
    timeDisplayType: "TIMECODE",
    effects: [
      {
        matchName: "ADBE Box Blur2",
        displayName: "Fast Box Blur",
        available: true,
        instanceCount: 1,
      },
      {
        matchName: "CC Radial Blur",
        displayName: "CC Radial Blur",
        available: true,
        instanceCount: 2,
      },
      {
        matchName: "tc Particular",
        displayName: "Particular",
        available: false,
        instanceCount: 1,
      },
    ],
    missingFootageCount: 1,
    missingFootage: [{ id: 99, name: "gone.mov", missingFootagePath: "/old/gone.mov" }],
    fontsApiAvailable: false,
    missingOrSubstitutedFonts: [],
  };

  it("parses identity, counts, settings, and classifies effects", () => {
    const parsed = parseProjectSummary(JSON.stringify(summaryFixture));
    expect(parsed.projectName).toBe("Demo.aep");
    expect(parsed.projectPath).toBe("/tmp/Demo.aep");
    expect(parsed.aeVersion).toBe("25.0.0");
    expect(parsed.numComps).toBe(2);
    expect(parsed.bitsPerChannel).toBe(8);
    expect(parsed.timeDisplayType).toBe("TIMECODE");
    expect(parsed.effects).toHaveLength(3);
    expect(parsed.effects[0]).toMatchObject({
      matchName: "ADBE Box Blur2",
      origin: "firstParty",
      available: true,
      instanceCount: 1,
    });
    expect(parsed.effects[1]).toMatchObject({
      matchName: "CC Radial Blur",
      origin: "firstParty",
    });
    expect(parsed.effects[2]).toMatchObject({
      matchName: "tc Particular",
      origin: "thirdParty",
      available: false,
    });
    expect(parsed.hasThirdPartyEffects).toBe(true);
    expect(parsed.missingFootageCount).toBe(1);
    expect(parsed.missingFootage[0]).toEqual({
      id: 99,
      name: "gone.mov",
      missingFootagePath: "/old/gone.mov",
    });
    expect(parsed.fontsApiAvailable).toBe(false);
    expect(parsed.missingOrSubstitutedFonts).toEqual([]);
  });

  it("sets hasThirdPartyEffects false when only first-party effects", () => {
    const onlyStock = {
      ...summaryFixture,
      effects: [
        {
          matchName: "ADBE Box Blur2",
          displayName: "Fast Box Blur",
          available: true,
          instanceCount: 1,
        },
      ],
      missingFootageCount: 0,
      missingFootage: [],
    };
    const parsed = parseProjectSummary(JSON.stringify(onlyStock));
    expect(parsed.hasThirdPartyEffects).toBe(false);
  });

  it("accepts fonts soft-fail and populated font lists", () => {
    const withFonts = {
      ...summaryFixture,
      effects: [],
      missingFootageCount: 0,
      missingFootage: [],
      fontsApiAvailable: true,
      missingOrSubstitutedFonts: ["MissingFont-Regular"],
    };
    const parsed = parseProjectSummary(JSON.stringify(withFonts));
    expect(parsed.fontsApiAvailable).toBe(true);
    expect(parsed.missingOrSubstitutedFonts).toEqual(["MissingFont-Regular"]);
    expect(parsed.hasThirdPartyEffects).toBe(false);
  });

  it("rejects mismatched missingFootageCount", () => {
    expect(() =>
      parseProjectSummary(JSON.stringify({ ...summaryFixture, missingFootageCount: 0 })),
    ).toThrow(/missingFootageCount/);
  });
});

describe("LIST_PROJECT_SUMMARY_SCRIPT", () => {
  it("walks effects, footage, and soft-fails fonts", () => {
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("ADBE Effect Parade");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("app.effects");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("footageMissing");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("missingOrSubstitutedFonts");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("bitsPerChannel");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("timeDisplayType");
    expect(LIST_PROJECT_SUMMARY_SCRIPT).toContain("JSON.stringify");
  });
});

describe("buildFingerprint", () => {
  it("builds rev|dirty|path composite", () => {
    expect(buildFingerprint(12, true, "/tmp/Demo.aep")).toBe("rev:12|dirty:1|path:/tmp/Demo.aep");
    expect(buildFingerprint(0, false, null)).toBe("rev:0|dirty:0|path:unsaved");
  });
});

describe("parseProjectContext", () => {
  it("parses lean payload and attaches fingerprint", () => {
    const parsed = parseProjectContext(
      JSON.stringify({
        projectName: "Demo.aep",
        projectPath: "/Projects/Demo.aep",
        dirty: false,
        revision: 7,
        aeVersion: "25.0",
      }),
    );
    expect(parsed).toEqual({
      projectName: "Demo.aep",
      projectPath: "/Projects/Demo.aep",
      dirty: false,
      revision: 7,
      fingerprint: "rev:7|dirty:0|path:/Projects/Demo.aep",
      aeVersion: "25.0",
    });
    expect(parsed.warning).toBeUndefined();
  });

  it("adds dirty warning when unsaved", () => {
    const parsed = parseProjectContext(
      JSON.stringify({
        projectName: "Untitled",
        projectPath: null,
        dirty: true,
        revision: 3,
        aeVersion: "25.0",
      }),
    );
    expect(parsed.dirty).toBe(true);
    expect(parsed.fingerprint).toBe("rev:3|dirty:1|path:unsaved");
    expect(parsed.warning).toMatch(/unsaved changes/i);
  });

  it("rejects malformed context JSON", () => {
    expect(() => parseProjectContext("not-json")).toThrow(/not valid JSON/);
    expect(() =>
      parseProjectContext(
        JSON.stringify({
          projectName: "x",
          projectPath: null,
          dirty: "yes",
          revision: 1,
          aeVersion: "25.0",
        }),
      ),
    ).toThrow(/dirty/);
  });
});

describe("LIST_PROJECT_CONTEXT_SCRIPT", () => {
  it("reads revision, dirty, file, and version without health walks", () => {
    expect(LIST_PROJECT_CONTEXT_SCRIPT).toContain("app.project.revision");
    expect(LIST_PROJECT_CONTEXT_SCRIPT).toContain("app.project.dirty");
    expect(LIST_PROJECT_CONTEXT_SCRIPT).toContain("app.version");
    expect(LIST_PROJECT_CONTEXT_SCRIPT).toContain("projectNameOf");
    expect(LIST_PROJECT_CONTEXT_SCRIPT).not.toContain("app.effects");
    expect(LIST_PROJECT_CONTEXT_SCRIPT).not.toContain("missingOrSubstitutedFonts");
  });
});
