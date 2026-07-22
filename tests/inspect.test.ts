import { describe, expect, it } from "vitest";

import { buildGetLayerScript, resolveGetLayerArgs } from "../src/inventory/get-layer-script.js";
import { buildGetSourceScript, resolveGetSourceArgs } from "../src/inventory/get-source-script.js";
import {
  assertInspectWithinLimit,
  DEFAULT_INSPECT_MAX_BYTES,
  InspectSizeError,
} from "../src/inventory/inspect-limit.js";
import {
  formatInspectScriptError,
  parseLayerInspect,
  parseSourceInspect,
} from "../src/inventory/parse.js";
import type { LayerInspectResult, SourceInspectResult } from "../src/inventory/types.js";

const overviewSample: LayerInspectResult = {
  projectName: "Demo.aep",
  detail: "overview",
  atTime: 1.5,
  preExpression: true,
  matchNames: null,
  comp: { id: 101, name: "Main", duration: 10, frameRate: 30, time: 1.5 },
  layer: {
    id: 42,
    index: 1,
    name: "Logo",
    type: "av",
    inPoint: 0,
    outPoint: 5,
    duration: 5,
    stretch: 100,
    startTime: 0,
    motionBlur: false,
    label: 3,
    hasEffects: true,
    properties: [
      {
        name: "Transform",
        matchName: "ADBE Transform Group",
        propertyIndex: 1,
        isGroup: true,
        properties: [
          {
            name: "Position",
            matchName: "ADBE Position",
            propertyIndex: 2,
            isGroup: false,
            propertyValueType: "ThreeD_SPATIAL",
            numKeys: 2,
            hasExpression: true,
            expressionEnabled: true,
          },
          {
            name: "Opacity",
            matchName: "ADBE Opacity",
            propertyIndex: 6,
            isGroup: false,
            propertyValueType: "OneD",
            numKeys: 0,
            hasExpression: false,
            expressionEnabled: false,
          },
        ],
      },
    ],
  },
};

const extendedSample: LayerInspectResult = {
  ...overviewSample,
  detail: "extended",
  matchNames: ["ADBE Transform Group"],
  layer: {
    ...overviewSample.layer,
    properties: [
      {
        name: "Transform",
        matchName: "ADBE Transform Group",
        propertyIndex: 1,
        isGroup: true,
        properties: [
          {
            name: "Position",
            matchName: "ADBE Position",
            propertyIndex: 2,
            isGroup: false,
            propertyValueType: "ThreeD_SPATIAL",
            numKeys: 2,
            hasExpression: true,
            expressionEnabled: true,
            expression: "wiggle(2, 20)",
            value: [100, 200, 0],
            authoredValue: [100, 200, 0],
            evaluatedValue: [105, 198, 0],
            keyframes: [
              {
                time: 0,
                value: [0, 0, 0],
                inInterpolationType: "LINEAR",
                outInterpolationType: "LINEAR",
              },
              {
                time: 2,
                value: [100, 200, 0],
                inInterpolationType: "BEZIER",
                outInterpolationType: "BEZIER",
              },
            ],
          },
          {
            name: "Scale",
            matchName: "ADBE Scale",
            propertyIndex: 3,
            isGroup: false,
            propertyValueType: "ThreeD",
            numKeys: 0,
            hasExpression: true,
            expressionEnabled: true,
            expression: "[100,100,100]*coverScale",
            value: [100, 100, 100],
            authoredValue: [100, 100, 100],
            evaluatedValue: [142.5, 142.5, 100],
          },
        ],
      },
    ],
  },
};

const fullSample: LayerInspectResult = {
  ...extendedSample,
  detail: "full",
  layer: {
    ...extendedSample.layer,
    properties: [
      {
        name: "Transform",
        matchName: "ADBE Transform Group",
        propertyIndex: 1,
        isGroup: true,
        properties: [
          {
            name: "Position",
            matchName: "ADBE Position",
            propertyIndex: 2,
            isGroup: false,
            propertyValueType: "ThreeD_SPATIAL",
            numKeys: 1,
            hasExpression: false,
            expressionEnabled: false,
            value: [10, 20, 0],
            authoredValue: [10, 20, 0],
            evaluatedValue: [10, 20, 0],
            keyframes: [
              {
                time: 0,
                value: [10, 20, 0],
                inInterpolationType: "BEZIER",
                outInterpolationType: "BEZIER",
                inEase: [{ speed: 0, influence: 16.7 }],
                outEase: [{ speed: 0, influence: 16.7 }],
                inSpatialTangent: [0, 0, 0],
                outSpatialTangent: [10, 0, 0],
              },
            ],
          },
          {
            name: "Path",
            matchName: "ADBE Vector Shape",
            propertyIndex: 3,
            isGroup: false,
            propertyValueType: "SHAPE",
            numKeys: 0,
            hasExpression: false,
            expressionEnabled: false,
            value: { unserializable: true, propertyValueType: "SHAPE" },
          },
        ],
      },
    ],
  },
};

const sourceOverview: SourceInspectResult = {
  projectName: "Demo.aep",
  detail: "overview",
  source: {
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
    interpret: {
      hasAlpha: true,
      alphaMode: "STRAIGHT",
      isStill: true,
      nativeFrameRate: 30,
    },
  },
};

const sourceFull: SourceInspectResult = {
  projectName: "Demo.aep",
  detail: "full",
  source: {
    ...sourceOverview.source,
    interpret: undefined,
    mainSource: {
      kind: "file",
      hasAlpha: true,
      alphaMode: "STRAIGHT",
      invertAlpha: false,
      isStill: true,
      nativeFrameRate: 30,
      conformFrameRate: 0,
      displayFrameRate: 30,
      fieldSeparationType: "OFF",
      removePulldown: "OFF",
      premulColor: null,
      highQualityFieldSeparation: false,
      file: "/Users/me/project/logo.png",
      missingFootagePath: null,
      solidColor: null,
    },
    proxySource: null,
  },
};

describe("resolveGetLayerArgs", () => {
  it("requires exactly one comp and one layer selector", () => {
    expect(() => resolveGetLayerArgs({ layerId: 1 })).toThrow(/compId or compName/);
    expect(() => resolveGetLayerArgs({ compId: 1, compName: "A", layerId: 1 })).toThrow(
      /compId or compName/,
    );
    expect(() => resolveGetLayerArgs({ compId: 1 })).toThrow(/layerId or layerName/);
    expect(() => resolveGetLayerArgs({ compId: 1, layerId: 1, layerName: "X" })).toThrow(
      /layerId or layerName/,
    );
  });

  it("defaults detail and preExpression", () => {
    const args = resolveGetLayerArgs({ compId: 1, layerId: 2 });
    expect(args.detail).toBe("overview");
    expect(args.preExpression).toBe(true);
    expect(args.atTime).toBeNull();
  });
});

describe("resolveGetSourceArgs", () => {
  it("requires exactly one source selector", () => {
    expect(() => resolveGetSourceArgs({})).toThrow(/sourceId or sourceName/);
    expect(() => resolveGetSourceArgs({ sourceId: 1, sourceName: "a" })).toThrow(
      /sourceId or sourceName/,
    );
  });
});

describe("parseLayerInspect", () => {
  it("parses overview without expression bodies or keyframes", () => {
    const parsed = parseLayerInspect(JSON.stringify(overviewSample));
    expect(parsed.detail).toBe("overview");
    const pos = parsed.layer.properties[0]!.properties![0]!;
    expect(pos.hasExpression).toBe(true);
    expect(pos.expression).toBeUndefined();
    expect(pos.keyframes).toBeUndefined();
    expect(pos.value).toBeUndefined();
  });

  it("parses extended with expression and keyframes", () => {
    const parsed = parseLayerInspect(JSON.stringify(extendedSample));
    expect(parsed.detail).toBe("extended");
    expect(parsed.matchNames).toEqual(["ADBE Transform Group"]);
    const pos = parsed.layer.properties[0]!.properties![0]!;
    expect(pos.expression).toBe("wiggle(2, 20)");
    expect(pos.keyframes).toHaveLength(2);
    expect(pos.value).toEqual([100, 200, 0]);
    expect(pos.authoredValue).toEqual([100, 200, 0]);
    expect(pos.evaluatedValue).toEqual([105, 198, 0]);
    const scale = parsed.layer.properties[0]!.properties![1]!;
    expect(scale.matchName).toBe("ADBE Scale");
    expect(scale.authoredValue).toEqual([100, 100, 100]);
    expect(scale.evaluatedValue).toEqual([142.5, 142.5, 100]);
  });

  it("parses full with ease/tangents and unserializable values", () => {
    const parsed = parseLayerInspect(JSON.stringify(fullSample));
    const props = parsed.layer.properties[0]!.properties!;
    const pos = props[0]!;
    expect(pos.keyframes![0]!.inEase).toEqual([{ speed: 0, influence: 16.7 }]);
    expect(pos.keyframes![0]!.outSpatialTangent).toEqual([10, 0, 0]);
    expect(pos.authoredValue).toEqual([10, 20, 0]);
    expect(pos.evaluatedValue).toEqual([10, 20, 0]);
    const shape = props[1]!;
    expect(shape.value).toEqual({ unserializable: true, propertyValueType: "SHAPE" });
  });

  it("parses TEXT_DOCUMENT style projection and keeps shape unserializable", () => {
    const withText: LayerInspectResult = {
      ...extendedSample,
      layer: {
        ...extendedSample.layer,
        type: "text",
        properties: [
          {
            name: "Source Text",
            matchName: "ADBE Text Document",
            propertyIndex: 1,
            isGroup: false,
            propertyValueType: "TEXT_DOCUMENT",
            numKeys: 0,
            hasExpression: false,
            expressionEnabled: false,
            value: {
              kind: "textDocument",
              style: { font: "ArialMT", fontSize: 48, autoLeading: true },
              boxText: false,
              pointText: true,
            },
          },
          {
            name: "Path",
            matchName: "ADBE Vector Shape",
            propertyIndex: 2,
            isGroup: false,
            propertyValueType: "SHAPE",
            numKeys: 0,
            hasExpression: false,
            expressionEnabled: false,
            value: { unserializable: true, propertyValueType: "SHAPE" },
          },
        ],
      },
    };
    const parsed = parseLayerInspect(JSON.stringify(withText));
    const textVal = parsed.layer.properties[0]!.value as {
      kind: string;
      style: { font: string; autoLeading: boolean };
    };
    expect(textVal.kind).toBe("textDocument");
    expect(textVal.style.font).toBe("ArialMT");
    expect(textVal.style.autoLeading).toBe(true);
    expect(parsed.layer.properties[1]!.value).toEqual({
      unserializable: true,
      propertyValueType: "SHAPE",
    });
  });
});

describe("parseSourceInspect", () => {
  it("parses overview with interpret summary", () => {
    const parsed = parseSourceInspect(JSON.stringify(sourceOverview));
    expect(parsed.detail).toBe("overview");
    expect(parsed.source.interpret?.alphaMode).toBe("STRAIGHT");
    expect(parsed.source.mainSource).toBeUndefined();
  });

  it("parses full with mainSource dump", () => {
    const parsed = parseSourceInspect(JSON.stringify(sourceFull));
    expect(parsed.detail).toBe("full");
    expect(parsed.source.mainSource?.kind).toBe("file");
    expect(parsed.source.proxySource).toBeNull();
  });
});

describe("assertInspectWithinLimit", () => {
  it("defaults to 512 KiB", () => {
    expect(DEFAULT_INSPECT_MAX_BYTES).toBe(524_288);
  });

  it("returns JSON when under limit", () => {
    const text = assertInspectWithinLimit({ ok: true }, 1024);
    expect(text).toContain('"ok": true');
  });

  it("hard-errors when over limit without truncating", () => {
    const big = { blob: "x".repeat(200) };
    expect(() => assertInspectWithinLimit(big, 50)).toThrow(InspectSizeError);
    try {
      assertInspectWithinLimit(big, 50);
    } catch (err) {
      expect(err).toBeInstanceOf(InspectSizeError);
      const sizeErr = err as InspectSizeError;
      expect(sizeErr.limit).toBe(50);
      expect(sizeErr.size).toBeGreaterThan(50);
      expect(sizeErr.message).toMatch(/leaner detail/);
      expect(sizeErr.message).toMatch(/matchNames/);
    }
  });
});

describe("formatInspectScriptError", () => {
  it("formats ambiguity candidates", () => {
    const msg = formatInspectScriptError(
      'AFX_INSPECT:{"code":"ambiguous_layer_name","message":"Ambiguous layer name; multiple matches","candidates":[{"id":1,"index":1,"name":"A"},{"id":2,"index":2,"name":"A"}]}',
    );
    expect(msg).toContain("Ambiguous layer name");
    expect(msg).toContain('"id":1');
  });
});

describe("inspect scripts", () => {
  it("embed shared helpers and resolution probes", () => {
    const layerScript = buildGetLayerScript({ compId: 1, layerId: 2, detail: "extended" });
    expect(layerScript).toContain("function projectNameOf");
    expect(layerScript).toContain("function serializeSourceRef");
    expect(layerScript).toContain("function walkLayerProperties");
    expect(layerScript).toContain("resolveComp");
    expect(layerScript).toContain("unserializable");
    expect(layerScript).toContain('"detail":"extended"');
    expect(layerScript).toContain("authoredValue");
    expect(layerScript).toContain("evaluatedValue");
    expect(layerScript).toContain("ADBE Scale");
    expect(layerScript).toContain("projectTextDocument");
    expect(layerScript).toContain("TEXT_DOCUMENT");
    expect(layerScript).toContain('kind: "textDocument"');

    const sourceScript = buildGetSourceScript({ sourceId: 55, detail: "full" });
    expect(sourceScript).toContain("resolveFootage");
    expect(sourceScript).toContain("serializeInterpretFull");
    expect(sourceScript).toContain('"detail":"full"');
  });
});
