import { beforeAll, describe, expect, it } from "vitest";

import {
  applySetPropertyKeyframes,
  preflightSetPropertyKeyframes,
} from "../src/ae-scripts/shared/control-plane.js";

/**
 * Unit tests for the set_property_keyframes host helpers (preflight + apply)
 * against stubbed AE globals -- no After Effects required. The helpers only
 * touch AE globals inside function bodies, so hand-rolled fakes are enough to
 * cover refusal paths, guards, and write verification without mutation.
 */

const PT: any = { PROPERTY: 1, INDEX: 2, PROPERTYGRP: 3 };
const PVT: any = {
  NO_VALUE: 107,
  OneD: 101,
  TwoD: 102,
  ThreeD: 103,
  TwoD_SPATIAL: 104,
  ThreeD_SPATIAL: 105,
  COLOR: 106,
  TEXT_DOCUMENT: 108,
  MARKER: 109,
  SHAPE: 110,
  MASK_INDEX: 111,
  LAYER_INDEX: 112,
};
const KIT: any = { LINEAR: 201, BEZIER: 202, HOLD: 203 };

class KeyframeEaseFake {
  speed: number;
  influence: number;
  constructor(speed: number, influence: number) {
    this.speed = speed;
    this.influence = influence;
  }
}

class CompItemFake {}

beforeAll(() => {
  (globalThis as any).PropertyType = PT;
  (globalThis as any).PropertyValueType = PVT;
  (globalThis as any).KeyframeInterpolationType = KIT;
  (globalThis as any).KeyframeEase = KeyframeEaseFake;
  (globalThis as any).CompItem = CompItemFake;
});

type FakeKey = {
  time: number;
  value: number | number[];
  inType?: number;
  outType?: number;
  inEase?: { speed: number; influence: number }[];
  outEase?: { speed: number; influence: number }[];
  temporalContinuous?: boolean;
  temporalAutoBezier?: boolean;
  inSpatialTangent?: number[];
  outSpatialTangent?: number[];
  spatialContinuous?: boolean;
  spatialAutoBezier?: boolean;
  roving?: boolean;
};

function key(time: number, value: number | number[], extra: Partial<FakeKey> = {}): FakeKey {
  return { time, value, ...extra };
}

interface PropOptions {
  matchName?: string;
  name?: string;
  propertyValueType?: number;
  propertyType?: number;
  canVaryOverTime?: boolean;
  isSeparationFollower?: boolean;
  isSeparationLeader?: boolean;
  dimensionsSeparated?: boolean;
  keys?: FakeKey[];
  value?: number | number[];
  expression?: string;
  expressionEnabled?: boolean;
  validInterps?: number[];
  spatial?: boolean;
  onAddKey?: () => void;
  throwOnSetValueAtKey?: boolean;
  throwOnSetValue?: boolean;
}

/** Read-only property fake backed by fixed key/value state. */
function fakeProp(opts: PropOptions = {}): any {
  const keys = opts.keys ?? [];
  const info = { spatial: opts.spatial ?? false };
  return {
    matchName: opts.matchName ?? "ADBE Opacity",
    name: opts.name ?? "Opacity",
    propertyType: opts.propertyType ?? PT.PROPERTY,
    propertyValueType: opts.propertyValueType ?? PVT.OneD,
    canVaryOverTime: opts.canVaryOverTime ?? true,
    isSeparationFollower: opts.isSeparationFollower ?? false,
    isSeparationLeader: opts.isSeparationLeader ?? false,
    dimensionsSeparated: opts.dimensionsSeparated ?? false,
    expression: opts.expression ?? "",
    expressionEnabled: opts.expressionEnabled ?? false,
    isInterpolationTypeValid: (t: number) =>
      (opts.validInterps ?? [KIT.LINEAR, KIT.BEZIER, KIT.HOLD]).includes(t),
    numKeys: keys.length,
    keyTime: (i: number) => keys[i - 1]!.time,
    keyValue: (i: number) => keys[i - 1]!.value,
    keyInInterpolationType: (i: number) => keys[i - 1]!.inType ?? KIT.LINEAR,
    keyOutInterpolationType: (i: number) => keys[i - 1]!.outType ?? KIT.LINEAR,
    keyInTemporalEase: (i: number) => keys[i - 1]!.inEase ?? [{ speed: 0, influence: 33.333 }],
    keyOutTemporalEase: (i: number) => keys[i - 1]!.outEase ?? [{ speed: 0, influence: 33.333 }],
    keyTemporalContinuous: (i: number) => keys[i - 1]!.temporalContinuous ?? false,
    keyTemporalAutoBezier: (i: number) => keys[i - 1]!.temporalAutoBezier ?? false,
    keyInSpatialTangent: (i: number) => keys[i - 1]!.inSpatialTangent,
    keyOutSpatialTangent: (i: number) => keys[i - 1]!.outSpatialTangent,
    keySpatialContinuous: (i: number) => keys[i - 1]!.spatialContinuous ?? false,
    keySpatialAutoBezier: (i: number) => keys[i - 1]!.spatialAutoBezier ?? false,
    keyRoving: (i: number) => keys[i - 1]!.roving ?? false,
    valueAtTime: (_t: number, _pre: boolean) =>
      opts.value !== undefined ? opts.value : (keys[0]?.value ?? 0),
    value: opts.value !== undefined ? opts.value : (keys[0]?.value ?? 0),
    __keys: keys,
    __info: info,
  };
}

/** Writable property fake: mutation methods update internal state. */
function writableProp(opts: PropOptions = {}): any {
  const state = {
    keys: [...(opts.keys ?? [])] as FakeKey[],
    value: opts.value ?? 0,
    expression: opts.expression ?? "",
    expressionEnabled: opts.expressionEnabled ?? false,
  };
  const prop: any = fakeProp({ ...opts });
  Object.defineProperties(prop, {
    expression: {
      get: () => state.expression,
      set: (v: string) => {
        state.expression = v;
      },
    },
    expressionEnabled: {
      get: () => state.expressionEnabled,
      set: (v: boolean) => {
        state.expressionEnabled = v;
      },
    },
    numKeys: { get: () => state.keys.length },
    value: {
      get: () => (state.keys.length ? state.keys[0]!.value : state.value),
      set: (v: number | number[]) => {
        state.value = v;
      },
    },
  });
  prop.__state = state;
  prop.addKey = (time: number) => {
    state.keys.push({ time, value: state.value });
    if (opts.onAddKey) opts.onAddKey();
    return state.keys.length;
  };
  prop.removeKey = (i: number) => {
    state.keys.splice(i - 1, 1);
  };
  prop.setValueAtKey = (i: number, v: number | number[]) => {
    if (opts.throwOnSetValueAtKey) throw new Error("setValueAtKey failed");
    state.keys[i - 1]!.value = v;
  };
  prop.setValue = (v: number | number[]) => {
    if (opts.throwOnSetValue) throw new Error("setValue refused (hidden)");
    state.value = v;
  };
  prop.setInterpolationTypeAtKey = (i: number, inT: number, outT?: number) => {
    state.keys[i - 1]!.inType = inT;
    state.keys[i - 1]!.outType = outT ?? inT;
  };
  prop.setTemporalEaseAtKey = (i: number, inE: any[], outE?: any[]) => {
    state.keys[i - 1]!.inEase = inE.map((e) => ({
      speed: e.speed,
      influence: e.influence,
    }));
    state.keys[i - 1]!.outEase = (outE ?? inE).map((e) => ({
      speed: e.speed,
      influence: e.influence,
    }));
  };
  prop.setTemporalContinuousAtKey = (i: number, v: boolean) => {
    state.keys[i - 1]!.temporalContinuous = v;
  };
  prop.setTemporalAutoBezierAtKey = (i: number, v: boolean) => {
    state.keys[i - 1]!.temporalAutoBezier = v;
  };
  prop.setSpatialTangentsAtKey = (i: number, inT: number[], outT?: number[]) => {
    state.keys[i - 1]!.inSpatialTangent = inT.slice();
    state.keys[i - 1]!.outSpatialTangent = (outT ?? inT).slice();
  };
  prop.setSpatialContinuousAtKey = (i: number, v: boolean) => {
    state.keys[i - 1]!.spatialContinuous = v;
  };
  prop.setSpatialAutoBezierAtKey = (i: number, v: boolean) => {
    state.keys[i - 1]!.spatialAutoBezier = v;
  };
  prop.setRovingAtKey = (i: number, v: boolean) => {
    state.keys[i - 1]!.roving = v;
  };
  prop.keyTime = (i: number) => state.keys[i - 1]!.time;
  prop.keyValue = (i: number) => state.keys[i - 1]!.value;
  prop.keyInInterpolationType = (i: number) => state.keys[i - 1]!.inType ?? KIT.LINEAR;
  prop.keyOutInterpolationType = (i: number) => state.keys[i - 1]!.outType ?? KIT.LINEAR;
  prop.keyInTemporalEase = (i: number) =>
    state.keys[i - 1]!.inEase ?? [{ speed: 0, influence: 33.333 }];
  prop.keyOutTemporalEase = (i: number) =>
    state.keys[i - 1]!.outEase ?? [{ speed: 0, influence: 33.333 }];
  prop.keyTemporalContinuous = (i: number) => state.keys[i - 1]!.temporalContinuous ?? false;
  prop.keyTemporalAutoBezier = (i: number) => state.keys[i - 1]!.temporalAutoBezier ?? false;
  prop.keyInSpatialTangent = (i: number) => state.keys[i - 1]!.inSpatialTangent;
  prop.keyOutSpatialTangent = (i: number) => state.keys[i - 1]!.outSpatialTangent;
  prop.keySpatialContinuous = (i: number) => state.keys[i - 1]!.spatialContinuous ?? false;
  prop.keySpatialAutoBezier = (i: number) => state.keys[i - 1]!.spatialAutoBezier ?? false;
  prop.keyRoving = (i: number) => state.keys[i - 1]!.roving ?? false;
  prop.valueAtTime = (_t: number, _pre: boolean) =>
    state.keys.length ? state.keys[0]!.value : state.value;
  return prop;
}

function fakeGroup(matchName: string, name: string, children: any[]): any {
  return {
    matchName,
    name,
    propertyType: PT.PROPERTYGRP,
    numProperties: children.length,
    property: (i: number) => children[i - 1],
  };
}

function fakeLayer(children: any[]): any {
  return {
    name: "Background",
    id: 2,
    numProperties: children.length,
    property: (i: number) => children[i - 1],
  };
}

/** Standard target layer: Transform group holding Opacity (+ optional sibling props). */
function transformLayer(opacity: any, transformSiblings: any[] = [], rootExtras: any[] = []): any {
  const transform = fakeGroup("ADBE Transform Group", "Transform", [opacity, ...transformSiblings]);
  return fakeLayer([transform, ...rootExtras]);
}

function fakeComp(time = 0): any {
  return { name: "main", id: 1, time };
}

function timelineOp(overrides: Record<string, unknown> = {}): any {
  return {
    op: "set_property_keyframes",
    target: { compId: 1, layerId: 2 },
    matchNames: ["ADBE Transform Group", "ADBE Opacity"],
    keyframes: [
      { time: 0, value: 0 },
      { time: 1, value: 50 },
    ],
    ...overrides,
  };
}

function preflight(op: any, layer: any, comp: any = fakeComp()) {
  return preflightSetPropertyKeyframes(op, comp, layer);
}

function buildPlan(op: any, layer: any, comp: any = fakeComp()) {
  const pre = preflightSetPropertyKeyframes(op, comp, layer);
  if (pre.error) throw new Error(`preflight failed: ${pre.error}`);
  return {
    op,
    kind: "set_property_keyframes",
    targets: [{ comp, layer }],
    kf: pre,
  };
}

function runApply(op: any, layer: any, comp: any = fakeComp()) {
  const plan = buildPlan(op, layer, comp);
  const opResult: any = {
    index: 0,
    op: "set_property_keyframes",
    status: "already_satisfied",
    targets: [],
  };
  const outcome = applySetPropertyKeyframes(plan, opResult);
  return { outcome, opResult };
}

describe("pkf property resolution", () => {
  it("resolves a unique matchName path with identity evidence", () => {
    const opacity = fakeProp();
    const layer = fakeLayer([fakeGroup("ADBE Transform Group", "Transform", [opacity])]);
    const pre = preflight(timelineOp(), layer);
    expect(pre.error).toBeNull();
    expect(pre.matchNames).toEqual(["ADBE Transform Group", "ADBE Opacity"]);
    expect(pre.identity).toEqual([
      { name: "Transform", matchName: "ADBE Transform Group", index: 1 },
      { name: "Opacity", matchName: "ADBE Opacity", index: 1 },
    ]);
  });

  it("resolves by unique display name and normalizes to matchNames", () => {
    const slider = fakeProp({
      matchName: "ADBE Slider Control",
      name: "My Slider",
    });
    const parade = fakeGroup("ADBE Effect Parade", "Effects", [slider]);
    const layer = fakeLayer([parade]);
    const op = timelineOp({
      matchNames: ["ADBE Effect Parade", "My Slider"],
    });
    const pre = preflight(op, layer);
    expect(pre.error).toBeNull();
    expect(pre.matchNames).toEqual(["ADBE Effect Parade", "ADBE Slider Control"]);
  });

  it("refuses ambiguous segments and not-found segments before mutation", () => {
    const sliderA = fakeProp({ matchName: "ADBE Slider Control" });
    const sliderB = fakeProp({ matchName: "ADBE Slider Control" });
    const parade = fakeGroup("ADBE Effect Parade", "Effects", [sliderA, sliderB]);
    const layer = fakeLayer([parade]);
    const ambiguous = preflight(
      timelineOp({ matchNames: ["ADBE Effect Parade", "ADBE Slider Control"] }),
      layer,
    );
    expect(ambiguous.error).toMatch(/Ambiguous property segment 'ADBE Slider Control'/);

    const missing = preflight(
      timelineOp({ matchNames: ["ADBE Effect Parade", "ADBE No Such Param"] }),
      layer,
    );
    expect(missing.error).toMatch(/Property not found for segment/);
  });

  it("refuses non-leaf resolution, empty segments, and oversized paths", () => {
    const group = fakeGroup("ADBE Transform Group", "Transform", []);
    const layer = fakeLayer([group]);
    const nonLeaf = preflight(timelineOp({ matchNames: ["ADBE Transform Group"] }), layer);
    expect(nonLeaf.error).toMatch(/not a property leaf/);

    const empty = preflight(timelineOp({ matchNames: [""] }), layer);
    expect(empty.error).toMatch(/Empty property path segment/);

    const segments = new Array(33).fill("ADBE Opacity");
    const long = preflight(timelineOp({ matchNames: segments }), layer);
    expect(long.error).toMatch(/exceeds 32 segments/);
  });
});

describe("pkf property domain refusals", () => {
  const cases: Array<{ name: string; prop: any; expect: RegExp }> = [
    {
      name: "unsupported value type (shape)",
      prop: fakeProp({ propertyValueType: PVT.SHAPE }),
      expect: /Unsupported property value type \(SHAPE\)/,
    },
    {
      name: "time remap",
      prop: fakeProp({ matchName: "ADBE Time Remap" }),
      expect: /Time Remap is not supported/,
    },
    {
      name: "separation follower",
      prop: fakeProp({ isSeparationFollower: true }),
      expect: /Separation follower properties are not supported/,
    },
    {
      name: "separated dimensions",
      prop: fakeProp({ isSeparationLeader: true, dimensionsSeparated: true }),
      expect: /separated dimensions/,
    },
    {
      name: "cannot vary over time",
      prop: fakeProp({ canVaryOverTime: false }),
      expect: /cannot vary over time/,
    },
  ];

  for (const testCase of cases) {
    it(`refuses ${testCase.name}`, () => {
      const layer = fakeLayer([testCase.prop]);
      const pre = preflight(timelineOp({ matchNames: [testCase.prop.matchName] }), layer);
      expect(pre.error).toMatch(testCase.expect);
    });
  }

  it("refuses an enabled expression unless clearing is requested", () => {
    const prop = fakeProp({
      expression: "wiggle(1, 10)",
      expressionEnabled: true,
    });
    const layer = fakeLayer([prop]);
    const refused = preflight(timelineOp({ matchNames: ["ADBE Opacity"] }), layer);
    expect(refused.error).toMatch(/enabled expression/);

    const cleared = preflight(
      timelineOp({ matchNames: ["ADBE Opacity"], expressionHandling: "clear" }),
      layer,
    );
    expect(cleared.error).toBeNull();
    expect(cleared.wantClear).toBe(true);
    expect(cleared.alreadySatisfied).toBe(false);
  });

  it("refuses observed timelines beyond the key bound", () => {
    const keys = new Array(1025).fill(null).map((_, i) => key(i, i));
    const prop = fakeProp({ keys });
    const layer = fakeLayer([prop]);
    const pre = preflight(timelineOp({ matchNames: ["ADBE Opacity"] }), layer);
    expect(pre.error).toMatch(/Observed timeline exceeds 1024 keys/);
  });
});

describe("pkf desired-state validation", () => {
  it("enforces value shapes and compares supplied components", () => {
    const scalarProp = fakeProp();
    const scalar = preflight(
      timelineOp({
        matchNames: ["ADBE Opacity"],
        keyframes: [{ time: 0, value: [1, 2] }],
      }),
      fakeLayer([scalarProp]),
    );
    expect(scalar.error).toMatch(/Unsupported value shape/);

    // Vectors accept 2 or 3 components and are written as supplied (AE normalizes
    // the tail per property: Scale keeps its default z, Position uses z 0).
    const wideProp = fakeProp({
      propertyValueType: PVT.ThreeD,
      keys: [key(0, [1, 2, 3])],
    });
    const twoOfThree = preflight(
      timelineOp({
        matchNames: ["ADBE Opacity"],
        keyframes: [{ time: 0, value: [10, 20] }],
      }),
      fakeLayer([wideProp]),
    );
    expect(twoOfThree.error).toBeNull();
    expect(twoOfThree.desiredEntries?.[0]?.value).toEqual([10, 20]);

    const fourTooMany = preflight(
      timelineOp({
        matchNames: ["ADBE Opacity"],
        keyframes: [{ time: 0, value: [1, 2, 3, 4] }],
      }),
      fakeLayer([wideProp]),
    );
    expect(fourTooMany.error).toMatch(/Unsupported value shape/);
  });

  it("requires native ease cardinality for Bezier sides", () => {
    const scale = fakeProp({
      matchName: "ADBE Scale",
      propertyValueType: PVT.TwoD,
      keys: [key(0, [100, 100])],
    });
    const bad = preflight(
      timelineOp({
        matchNames: ["ADBE Scale"],
        keyframes: [
          {
            time: 0,
            value: [100, 100],
            inInterpolationType: "BEZIER",
            outInterpolationType: "BEZIER",
            inEase: [{ speed: 0, influence: 30 }],
          },
        ],
      }),
      fakeLayer([scale]),
    );
    expect(bad.error).toMatch(/inEase must contain 2 ease point/);

    const good = preflight(
      timelineOp({
        matchNames: ["ADBE Scale"],
        keyframes: [
          {
            time: 0,
            value: [100, 100],
            inInterpolationType: "BEZIER",
            outInterpolationType: "BEZIER",
            inEase: [
              { speed: 0, influence: 30 },
              { speed: 0, influence: 30 },
            ],
            outEase: [
              { speed: 0, influence: 30 },
              { speed: 0, influence: 30 },
            ],
          },
        ],
      }),
      fakeLayer([scale]),
    );
    expect(good.error).toBeNull();
  });

  it("refuses unsupported interpolation types and near-duplicate desired times", () => {
    const limited = fakeProp({ validInterps: [KIT.LINEAR] });
    const refused = preflight(
      timelineOp({
        matchNames: ["ADBE Opacity"],
        keyframes: [
          {
            time: 0,
            value: 1,
            inInterpolationType: "BEZIER",
            outInterpolationType: "BEZIER",
            inEase: [{ speed: 0, influence: 30 }],
            outEase: [{ speed: 0, influence: 30 }],
          },
        ],
      }),
      fakeLayer([limited]),
    );
    expect(refused.error).toMatch(/does not support BEZIER interpolation/);

    const near = preflight(
      timelineOp({
        matchNames: ["ADBE Opacity"],
        keyframes: [
          { time: 0, value: 1 },
          { time: 5e-8, value: 2 },
        ],
      }),
      fakeLayer([fakeProp()]),
    );
    expect(near.error).toMatch(/strictly increasing/);
  });
});

describe("pkf expected-state guards", () => {
  const currentKeys = [
    key(0, 10, {
      inType: KIT.BEZIER,
      outType: KIT.LINEAR,
      inEase: [{ speed: 0, influence: 25 }],
    }),
    key(1, 90),
  ];

  function guardedLayer() {
    return transformLayer(fakeProp({ keys: currentKeys }));
  }

  it("accepts a matching count-only guard", () => {
    const pre = preflight(
      timelineOp({
        expected: { numKeys: 2 },
        keyframes: [{ time: 0, value: 5 }],
      }),
      guardedLayer(),
    );
    expect(pre.error).toBeNull();
    expect(pre.before?.numKeys).toBe(2);
  });

  it("refuses stale numKeys, timeline, interpolation, and ease guards", () => {
    const staleCount = preflight(
      timelineOp({
        expected: { numKeys: 3 },
        keyframes: [{ time: 0, value: 5 }],
      }),
      guardedLayer(),
    );
    expect(staleCount.error).toMatch(/Expected-state guard failed.*has 2 keys, expected 3/);

    const staleValue = preflight(
      timelineOp({
        expected: {
          keyframes: [
            { time: 0, value: 11 },
            { time: 1, value: 90 },
          ],
        },
        keyframes: [{ time: 0, value: 5 }],
      }),
      guardedLayer(),
    );
    expect(staleValue.error).toMatch(/Expected-state guard failed.*value does not match/);

    const staleInterp = preflight(
      timelineOp({
        expected: {
          keyframes: [
            { time: 0, value: 10, inInterpolationType: "LINEAR" },
            { time: 1, value: 90 },
          ],
        },
        keyframes: [{ time: 0, value: 5 }],
      }),
      guardedLayer(),
    );
    expect(staleInterp.error).toMatch(/inInterpolationType is BEZIER, expected LINEAR/);

    const staleEase = preflight(
      timelineOp({
        expected: {
          keyframes: [
            { time: 0, value: 10, inEase: [{ speed: 0, influence: 90 }] },
            { time: 1, value: 90 },
          ],
        },
        keyframes: [{ time: 0, value: 5 }],
      }),
      guardedLayer(),
    );
    expect(staleEase.error).toMatch(/inEase does not match expectation/);
  });

  it("a stale guard refuses even when the desired state is already satisfied", () => {
    const matching = [
      key(0, 0, { temporalContinuous: false, temporalAutoBezier: false }),
      key(1, 50, { temporalContinuous: false, temporalAutoBezier: false }),
    ];
    const layer = transformLayer(fakeProp({ keys: matching }));
    const satisfied = preflight(timelineOp({ expected: { numKeys: 9 } }), layer);
    expect(satisfied.error).toMatch(/Expected-state guard failed/);

    const ok = preflight(timelineOp({ expected: { numKeys: 2 } }), layer);
    expect(ok.error).toBeNull();
    expect(ok.alreadySatisfied).toBe(true);
  });

  it("desired idempotence requires normalized flags, not just times and values", () => {
    const continuous = [key(0, 5, { temporalContinuous: true }), key(1, 50)];
    const pre = preflight(
      timelineOp({ expected: { numKeys: 2 } }),
      transformLayer(fakeProp({ keys: continuous })),
    );
    expect(pre.error).toBeNull();
    expect(pre.alreadySatisfied).toBe(false);
  });

  it("static mode: zero keys is already satisfied; keyed state is not", () => {
    const keyless = fakeProp({ value: 42 });
    const satisfied = preflight(
      timelineOp({
        keyframes: undefined,
        staticValueAtTime: 0,
        matchNames: ["ADBE Opacity"],
        expected: { numKeys: 0 },
      }),
      fakeLayer([keyless]),
    );
    expect(satisfied.error).toBeNull();
    expect(satisfied.mode).toBe("static");
    expect(satisfied.alreadySatisfied).toBe(true);

    const keyed = fakeProp({ keys: [key(0, 10), key(1, 90)], value: 10 });
    const notSatisfied = preflight(
      timelineOp({
        keyframes: undefined,
        staticValueAtTime: 0,
        matchNames: ["ADBE Opacity"],
        expected: { numKeys: 2 },
      }),
      fakeLayer([keyed]),
    );
    expect(notSatisfied.error).toBeNull();
    expect(notSatisfied.alreadySatisfied).toBe(false);
    expect(notSatisfied.sample).toBe(10);
  });
});

describe("pkf preservation preflight", () => {
  it("refuses opaque keyed siblings (markers) before mutation", () => {
    const opacity = fakeProp();
    const marker = fakeProp({
      matchName: "ADBE Marker",
      propertyValueType: PVT.MARKER,
      keys: [key(0, { comment: "m" } as unknown as number)],
    });
    const layer = fakeLayer([opacity, marker]);
    const pre = preflight(timelineOp({ matchNames: ["ADBE Opacity"] }), layer);
    expect(pre.error).toMatch(/Cannot faithfully compare keyed sibling property/);
    expect(pre.error).toMatch(/MARKER/);
  });

  it("refuses sibling key and node budget overruns", () => {
    const opacity = fakeProp();
    const bigKeys = new Array(2049).fill(null).map((_, i) => key(i, i));
    const siblingA = fakeProp({ matchName: "ADBE Scale", keys: bigKeys });
    const siblingB = fakeProp({
      matchName: "ADBE Rotation",
      keys: bigKeys.slice(0, 2048),
    });
    const keyed = fakeLayer([opacity, siblingA, siblingB]);
    const keyBudget = preflight(timelineOp({ matchNames: ["ADBE Opacity"] }), keyed);
    expect(keyBudget.error).toMatch(/Preservation walk exceeded 4096 sibling keys/);

    const manyChildren = new Array(4097)
      .fill(null)
      .map((_, i) => fakeProp({ matchName: `ADBE Leaf ${i}`, keys: [] }));
    const nodeBudget = preflight(
      timelineOp({ matchNames: ["ADBE Opacity"] }),
      fakeLayer([opacity, ...manyChildren]),
    );
    expect(nodeBudget.error).toMatch(/Preservation walk exceeded 4096 property nodes/);
  });

  it("skips the target property itself in the preservation walk", () => {
    const opacity = fakeProp({ keys: [key(0, 5), key(1, 6), key(2, 7)] });
    const pre = preflight(timelineOp({ matchNames: ["ADBE Opacity"] }), fakeLayer([opacity]));
    expect(pre.error).toBeNull();
    // target itself is not counted as a sibling
  });
});

describe("pkf apply", () => {
  it("replaces a timeline with curves and reports changed with preservation evidence", () => {
    const sibling = fakeProp({
      matchName: "ADBE Scale",
      keys: [key(0.5, [100, 100])],
    });
    const layer = transformLayer(fakeProp(), [sibling]);
    // target is the first transform child (ADBE Opacity)
    const op = timelineOp({
      keyframes: [
        { time: 0, value: 0 },
        {
          time: 1,
          value: 50,
          inInterpolationType: "BEZIER",
          outInterpolationType: "BEZIER",
          inEase: [{ speed: 0, influence: 33.333 }],
          outEase: [{ speed: 0, influence: 44.444 }],
        },
        {
          time: 2,
          value: 100,
          inInterpolationType: "LINEAR",
          outInterpolationType: "HOLD",
        },
      ],
    });
    const writable = writableProp({ keys: [key(0, 10), key(1, 90)] });
    const writableLayer = transformLayer(writable, [sibling]);
    const { outcome, opResult } = runApply(op, writableLayer);
    expect(outcome.anyFailed).toBe(false);
    expect(outcome.anyChanged).toBe(true);
    const target = opResult.targets[0];
    expect(target.status).toBe("changed");
    expect(target.mode).toBe("timeline");
    expect(target.before.numKeys).toBe(2);
    expect(target.after.numKeys).toBe(3);
    expect(target.after.keyframes[1]).toMatchObject({
      time: 1,
      value: 50,
      inInterpolationType: "BEZIER",
      outInterpolationType: "BEZIER",
    });
    expect(target.after.keyframes[1].inEase[0]).toMatchObject({
      speed: 0,
      influence: 33.333,
    });
    expect(target.after.keyframes[2].outInterpolationType).toBe("HOLD");
    expect(target.preservation).toMatchObject({
      scope: "other_keyframes_on_target_layer",
      checkedProperties: 1,
      checkedKeys: 1,
      unchanged: true,
    });
    expect(writable.__state.keys).toHaveLength(3);
  });

  it("removes keys and restores the sampled static value", () => {
    const writable = writableProp({
      keys: [key(0, 10), key(1, 90)],
      value: 10,
    });
    const layer = transformLayer(writable);
    const op = timelineOp({
      keyframes: undefined,
      staticValueAtTime: 0,
      expected: { numKeys: 2 },
    });
    const { outcome, opResult } = runApply(op, layer);
    expect(outcome.anyFailed).toBe(false);
    const target = opResult.targets[0];
    expect(target.status).toBe("changed");
    expect(target.after.numKeys).toBe(0);
    expect(target.after.staticValue).toBe(10);
    expect(writable.__state.keys).toHaveLength(0);
    expect(writable.__state.value).toBe(10);
  });

  it("detects sibling drift introduced during the write", () => {
    const siblingProp = writableProp({
      matchName: "ADBE Scale",
      keys: [key(0.5, [100, 100])],
    });
    const target = writableProp({
      keys: [key(0, 10), key(1, 90)],
      onAddKey: () => {
        // simulate an AE side effect nudging a sibling key
        siblingProp.__state.keys[0]!.time = 0.75;
      },
    });
    const layer = transformLayer(target, [siblingProp]);
    const { outcome, opResult } = runApply(timelineOp(), layer);
    expect(outcome.anyFailed).toBe(true);
    const result = opResult.targets[0];
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/unrelated keyframes on the target layer changed/);
    expect(result.preservation?.unchanged).toBe(false);
    expect(result.preservation?.drift?.[0]).toMatchObject({
      matchNames: ["ADBE Transform Group", "ADBE Scale"],
      beforeTime: 0.5,
      afterTime: 0.75,
    });
    expect(outcome.anyChanged).toBe(true);
  });

  it("refuses stale plans: property changed between preflight and apply", () => {
    const target = writableProp({ keys: [key(0, 10), key(1, 90)] });
    const layer = transformLayer(target);
    const op = timelineOp({ expected: { numKeys: 2 } });
    const plan = buildPlan(op, layer);
    // simulate another batch op mutating the property after preflight
    target.__state.keys.push({ time: 2, value: 42 });
    const opResult: any = {
      index: 0,
      op: "set_property_keyframes",
      status: "already_satisfied",
      targets: [],
    };
    const outcome = applySetPropertyKeyframes(plan, opResult);
    expect(outcome.anyFailed).toBe(true);
    expect(outcome.anyChanged).toBe(false);
    expect(opResult.targets[0].message).toMatch(/Planned property changed before apply/);
    expect(target.__state.keys).toHaveLength(3);
  });

  it("refuses stale plans: expression gained after preflight", () => {
    const target = writableProp({ keys: [key(0, 10)] });
    const layer = transformLayer(target);
    const op = timelineOp({ expected: { numKeys: 1 } });
    const plan = buildPlan(op, layer);
    target.__state.expression = "wiggle(1, 10)";
    target.__state.expressionEnabled = true;
    const opResult: any = {
      index: 0,
      op: "set_property_keyframes",
      status: "already_satisfied",
      targets: [],
    };
    const outcome = applySetPropertyKeyframes(plan, opResult);
    expect(outcome.anyFailed).toBe(true);
    expect(opResult.targets[0].message).toMatch(/gained an enabled expression after preflight/);
  });

  it("clears the expression when explicitly requested and verifies it", () => {
    const target = writableProp({
      keys: [],
      value: 50,
      expression: "wiggle(1, 10)",
      expressionEnabled: true,
    });
    const layer = transformLayer(target);
    const op = timelineOp({
      keyframes: [{ time: 0, value: 50 }],
      expressionHandling: "clear",
    });
    const { outcome, opResult } = runApply(op, layer);
    expect(outcome.anyFailed).toBe(false);
    const result = opResult.targets[0];
    expect(result.status).toBe("changed");
    expect(result.after.expression).toEqual({
      expression: "",
      expressionEnabled: false,
    });
  });

  it("preserves a disabled expression by default", () => {
    const target = writableProp({
      keys: [key(0, 10)],
      expression: "wiggle(1, 10)",
      expressionEnabled: false,
    });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(timelineOp({ expected: { numKeys: 1 } }), layer);
    expect(outcome.anyFailed).toBe(false);
    expect(opResult.targets[0].after.expression).toEqual({
      expression: "wiggle(1, 10)",
      expressionEnabled: false,
    });
  });

  it("reports an already-satisfied timeline with preservation counts", () => {
    const sibling = fakeProp({
      matchName: "ADBE Scale",
      keys: [key(0.25, [5, 5])],
    });
    const target = fakeProp({
      keys: [
        key(0, 0, { temporalContinuous: false, temporalAutoBezier: false }),
        key(1, 50, { temporalContinuous: false, temporalAutoBezier: false }),
      ],
    });
    const layer = transformLayer(target, [sibling]);
    const { outcome, opResult } = runApply(timelineOp({ expected: { numKeys: 2 } }), layer);
    expect(outcome.anyChanged).toBe(false);
    expect(outcome.anyFailed).toBe(false);
    const result = opResult.targets[0];
    expect(result.status).toBe("already_satisfied");
    expect(result.preservation).toMatchObject({
      checkedProperties: 1,
      checkedKeys: 1,
      unchanged: true,
    });
  });

  it("fails honestly with mutation evidence when a write throws mid-way", () => {
    const target = writableProp({
      keys: [key(0, 10), key(1, 90)],
      throwOnSetValueAtKey: true,
    });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(timelineOp(), layer);
    expect(outcome.anyFailed).toBe(true);
    expect(outcome.anyChanged).toBe(true);
    const result = opResult.targets[0];
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/setValueAtKey failed/);
    expect(result.after).toBeDefined();
  });
});

describe("pkf clear mode", () => {
  it("preflights clear mode without sampling and treats zero keys as satisfied", () => {
    const keyed = preflight(
      timelineOp({ keyframes: undefined, clearKeys: true }),
      transformLayer(fakeProp({ keys: [key(0, 10), key(1, 90)] })),
    );
    expect(keyed.error).toBeNull();
    expect(keyed.mode).toBe("clear");
    expect(keyed.alreadySatisfied).toBe(false);

    const empty = preflight(
      timelineOp({ keyframes: undefined, clearKeys: true }),
      transformLayer(fakeProp({ keys: [] })),
    );
    expect(empty.error).toBeNull();
    expect(empty.mode).toBe("clear");
    expect(empty.alreadySatisfied).toBe(true);
  });

  it("removes every key without writing a value and reports the retained value", () => {
    const target = writableProp({ keys: [key(0, -8), key(1, -20)], value: -8 });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(
      timelineOp({ keyframes: undefined, clearKeys: true }),
      layer,
    );
    expect(outcome.anyFailed).toBe(false);
    const result = opResult.targets[0];
    expect(result.status).toBe("changed");
    expect(result.mode).toBe("clear");
    expect(result.after.numKeys).toBe(0);
    expect(result.after.retainedValue).toBe(-8);
    expect(result.after.valueWritten).toBe(false);
    expect(target.__state.keys).toHaveLength(0);
  });

  it("clears a property whose value write is refused (hidden) without throwing", () => {
    const target = writableProp({
      keys: [key(0, -8), key(1, -20)],
      value: -8,
      throwOnSetValue: true,
    });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(
      timelineOp({ keyframes: undefined, clearKeys: true }),
      layer,
    );
    expect(outcome.anyFailed).toBe(false);
    const result = opResult.targets[0];
    expect(result.status).toBe("changed");
    expect(result.after.numKeys).toBe(0);
    expect(result.after.retainedValue).toBe(-8);
    expect(result.after.valueWritten).toBe(false);
  });

  it("is idempotent when the property already has no keys", () => {
    const target = writableProp({ keys: [], value: 5 });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(
      timelineOp({ keyframes: undefined, clearKeys: true }),
      layer,
    );
    expect(outcome.anyChanged).toBe(false);
    expect(outcome.anyFailed).toBe(false);
    const result = opResult.targets[0];
    expect(result.status).toBe("already_satisfied");
    expect(result.mode).toBe("clear");
    expect(result.after.numKeys).toBe(0);
    expect(result.after.retainedValue).toBe(5);
    expect(result.after.valueWritten).toBe(false);
  });
});

describe("pkf static restore safety", () => {
  it("restores removed keys in place and reports verified when the static write is refused", () => {
    const target = writableProp({
      keys: [key(0, 10), key(1, 90)],
      value: 0,
      throwOnSetValue: true,
    });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(
      timelineOp({ keyframes: undefined, staticValueAtTime: 0 }),
      layer,
    );
    expect(outcome.anyFailed).toBe(true);
    const result = opResult.targets[0];
    expect(result.status).toBe("failed");
    expect(result.restore).toEqual({ attempted: true, verified: true });
    expect(result.after.numKeys).toBe(2);
    expect(target.__state.keys.map((k: FakeKey) => k.value)).toEqual([10, 90]);
  });

  it("reports restore verified false when the keys cannot be recreated", () => {
    const target = writableProp({
      keys: [key(0, 10), key(1, 90)],
      value: 0,
      throwOnSetValue: true,
      throwOnSetValueAtKey: true,
    });
    const layer = transformLayer(target);
    const { outcome, opResult } = runApply(
      timelineOp({ keyframes: undefined, staticValueAtTime: 0 }),
      layer,
    );
    expect(outcome.anyFailed).toBe(true);
    const result = opResult.targets[0];
    expect(result.status).toBe("failed");
    expect(result.restore).toEqual({ attempted: true, verified: false });
  });
});
