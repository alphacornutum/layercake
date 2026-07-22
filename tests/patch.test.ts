import { describe, expect, it, vi } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { AeHost } from "../src/host/types.js";
import { applyProjectPatch, parsePatchApplyResult } from "../src/patch/apply.js";
import { buildPatchApplyScript } from "../src/patch/apply-script.js";
import { checkBroadTargetGate } from "../src/patch/broad-gate.js";
import { PATCH_MAX_TARGETS } from "../src/patch/constants.js";
import { patchProjectInputSchema } from "../src/patch/schema.js";
import { saveProject } from "../src/patch/save.js";

function guardedProject() {
  return { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" };
}

describe("patchProjectInputSchema", () => {
  it("accepts set_text_style apply-only payload", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "all_text_layers" },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(parsed.operations[0]?.op).toBe("set_text_style");
    expect(parsed.allowBroadTargetSet).toBe(false);
  });

  it("accepts set_text_style with autoLeading-only style bag", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "layers", layers: [{ compId: 1, layerId: 2 }] },
          style: { autoLeading: true },
        },
      ],
    });
    const op = parsed.operations[0];
    expect(op?.op).toBe("set_text_style");
    if (op?.op === "set_text_style") {
      expect(op.style.autoLeading).toBe(true);
      expect(op.style.font).toBeUndefined();
    }
  });

  it("accepts set_text_style caps booleans and rejects fontCapsOption", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "layers", layers: [{ compId: 1, layerId: 2 }] },
          style: { allCaps: true, smallCaps: false },
        },
      ],
    });
    const op = parsed.operations[0];
    expect(op?.op).toBe("set_text_style");
    if (op?.op === "set_text_style") {
      expect(op.style.allCaps).toBe(true);
      expect(op.style.smallCaps).toBe(false);
    }
    expect(() =>
      patchProjectInputSchema.parse({
        project: guardedProject(),
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "all_text_layers" },
            style: { fontCapsOption: "FONT_ALL_CAPS" } as { fontCapsOption: string },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects empty or unknown set_text_style style keys", () => {
    expect(() =>
      patchProjectInputSchema.parse({
        project: guardedProject(),
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "all_text_layers" },
            style: {},
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      patchProjectInputSchema.parse({
        project: guardedProject(),
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "all_text_layers" },
            style: { font: "ArialMT", unknownKey: true } as { font: string },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts panel ops create_folder / move_project_item / delete_project_item", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        { op: "create_folder", name: "Bundle", parentFolderId: 12 },
        {
          op: "move_project_item",
          selector: { kind: "items", itemIds: [1, 576] },
          destinationFolderId: 12,
        },
        {
          op: "delete_project_item",
          selector: { kind: "items", itemIds: [99] },
        },
      ],
    });
    expect(parsed.operations.map((o) => o.op)).toEqual([
      "create_folder",
      "move_project_item",
      "delete_project_item",
    ]);
  });

  it("allows omitting name on create_folder and create_solid", () => {
    const folder = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [{ op: "create_folder", parentFolderId: 12 }],
    });
    expect(folder.operations[0]).toMatchObject({ op: "create_folder", parentFolderId: 12 });
    expect((folder.operations[0] as { name?: string }).name).toBeUndefined();

    const solid = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "create_solid",
          width: 100,
          height: 100,
          pixelAspect: 1,
          color: [0, 0, 0],
        },
      ],
    });
    expect(solid.operations[0]?.op).toBe("create_solid");
    expect((solid.operations[0] as { name?: string }).name).toBeUndefined();
  });

  it("accepts create_text point and box layouts with optional style", () => {
    const point = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "create_text",
          target: { compId: 12 },
          layout: "point",
          text: "Hello",
          style: { font: "ArialMT", fontSize: 48 },
        },
      ],
    });
    expect(point.operations[0]).toMatchObject({
      op: "create_text",
      layout: "point",
      text: "Hello",
    });

    const box = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "create_text",
          target: { compName: "main" },
          layout: "box",
          text: "",
          boxTextSize: [400, 200],
          name: "Title",
        },
      ],
    });
    expect(box.operations[0]).toMatchObject({
      op: "create_text",
      layout: "box",
      boxTextSize: [400, 200],
      name: "Title",
    });
  });

  it("refines create_text boxTextSize by layout", () => {
    const missingSize = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "create_text",
          target: { compId: 1 },
          layout: "box",
          text: "x",
        },
      ],
    });
    expect(missingSize.success).toBe(false);

    const pointWithSize = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "create_text",
          target: { compId: 1 },
          layout: "point",
          text: "x",
          boxTextSize: [100, 50],
        },
      ],
    });
    expect(pointWithSize.success).toBe(false);
  });

  it("rejects empty itemIds on move/delete", () => {
    const move = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "move_project_item",
          selector: { kind: "items", itemIds: [] },
          destinationFolderId: 1,
        },
      ],
    });
    expect(move.success).toBe(false);
  });

  it("rejects unknown ops", () => {
    const result = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [{ op: "rename", selector: { kind: "all_text_layers" }, name: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts rename_layer by ids and by unique names", () => {
    const byIds = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "rename_layer",
          target: { compId: 12, layerId: 3 },
          layerName: "{brand_url}",
        },
      ],
    });
    expect(byIds.operations[0]?.op).toBe("rename_layer");

    const byNames = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "rename_layer",
          target: { compName: "main", layerName: "Hello World" },
          layerName: "{message_10}",
        },
      ],
    });
    expect(byNames.operations[0]).toMatchObject({
      op: "rename_layer",
      layerName: "{message_10}",
    });
  });

  it("rejects rename_layer / set_text_style layer targets missing or with both selectors", () => {
    const missingComp = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "rename_layer",
          target: { layerId: 3 },
          layerName: "x",
        },
      ],
    });
    expect(missingComp.success).toBe(false);

    const bothLayer = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "rename_layer",
          target: { compId: 1, layerId: 2, layerName: "Hello" },
          layerName: "x",
        },
      ],
    });
    expect(bothLayer.success).toBe(false);

    const bothComp = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: {
            kind: "layers",
            layers: [{ compId: 1, compName: "main", layerId: 2 }],
          },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(bothComp.success).toBe(false);
  });

  it("accepts set_text_style id-only and name-based layer/comp selectors", () => {
    const idOnly = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "layers", layers: [{ compId: 1, layerId: 2 }] },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(idOnly.operations[0]?.op).toBe("set_text_style");

    const byNames = patchProjectInputSchema.parse({
      project: guardedProject(),
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
    });
    expect(byNames.operations[0]?.op).toBe("set_text_style");

    const compsByName = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "comps", compNames: ["main"] },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(compsByName.operations[0]).toMatchObject({
      op: "set_text_style",
      selector: { kind: "comps", compNames: ["main"] },
    });

    const compsIdsOnly = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "comps", compIds: [1] },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(compsIdsOnly.operations[0]?.op).toBe("set_text_style");
  });

  it("rejects empty comps selector lists", () => {
    const empty = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "comps", compIds: [], compNames: [] },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(empty.success).toBe(false);
  });

  it("rejects empty operations", () => {
    const result = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [],
    });
    expect(result.success).toBe(false);
  });

  it("emits Codex-compatible JSON Schema (no tuple-style items arrays)", () => {
    const schema = zodToJsonSchema(patchProjectInputSchema, { $refStrategy: "none" });
    const tupleItemsPaths: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      const obj = node as Record<string, unknown>;
      if (Array.isArray(obj.items)) tupleItemsPaths.push(`${path}.items`);
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
    };
    walk(schema, "$");
    expect(tupleItemsPaths).toEqual([]);
  });

  it("accepts control-plane ops with op-specific fields", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        { op: "rename_project_item", itemId: 56, name: "Solid A" },
        {
          op: "set_layer_index",
          target: { compId: 1, layerId: 2 },
          index: 1,
        },
        {
          op: "create_solid",
          name: "Matte",
          width: 1920,
          height: 1080,
          pixelAspect: 1,
          color: [1, 0, 0],
          parentFolderId: 12,
        },
        {
          op: "create_text",
          target: { compId: 1 },
          layout: "point",
          text: "Hi",
        },
        {
          op: "replace_layer_source",
          target: { compName: "main", layerName: "Logo" },
          sourceItemId: 56,
        },
        {
          op: "set_layer_timing",
          target: { compId: 1, layerId: 2 },
          inFrame: 0,
          outFrame: 90,
        },
        {
          op: "set_layer_switches",
          target: { compId: 1, layerId: 2 },
          switches: { enabled: false },
        },
        {
          op: "set_comp_settings",
          target: { compId: 1 },
          settings: { durationFrames: 450, workAreaDurationFrames: 450 },
        },
        {
          op: "set_property_expression",
          target: { compId: 1, layerId: 2 },
          matchNames: ["ADBE Transform Group", "ADBE Scale"],
          expression: "[100,100]",
          expressionEnabled: true,
        },
        {
          op: "set_layer_transform",
          target: { compId: 1, layerId: 2 },
          transform: { position: [300, 550], anchorPoint: [300, 550] },
        },
        {
          op: "reset_layer_surface",
          target: { compId: 1, layerId: 2 },
          clearExpressions: true,
        },
        { op: "delete_layer", target: { compId: 1, layerId: 2 } },
        {
          op: "safe_delete_project_item",
          selector: { kind: "items", itemIds: [99] },
        },
      ],
    });
    expect(parsed.operations.map((o) => o.op)).toEqual([
      "rename_project_item",
      "set_layer_index",
      "create_solid",
      "create_text",
      "replace_layer_source",
      "set_layer_timing",
      "set_layer_switches",
      "set_comp_settings",
      "set_property_expression",
      "set_layer_transform",
      "reset_layer_surface",
      "delete_layer",
      "safe_delete_project_item",
    ]);
  });

  it("accepts set_comp_settings by compId and by unique compName", () => {
    const byId = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_comp_settings",
          target: { compId: 12 },
          settings: { durationFrames: 300, switches: { motionBlur: true } },
        },
      ],
    });
    expect(byId.operations[0]).toMatchObject({
      op: "set_comp_settings",
      target: { compId: 12 },
    });
    const byName = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_comp_settings",
          target: { compName: "main" },
          settings: { width: 1280, height: 720 },
        },
      ],
    });
    expect(byName.operations[0]).toMatchObject({
      op: "set_comp_settings",
      target: { compName: "main" },
    });
  });

  it("rejects empty/unknown set_comp_settings bags and invalid targets", () => {
    const empty = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [{ op: "set_comp_settings", target: { compId: 1 }, settings: {} }],
    });
    expect(empty.success).toBe(false);
    const emptySwitches = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [{ op: "set_comp_settings", target: { compId: 1 }, settings: { switches: {} } }],
    });
    expect(emptySwitches.success).toBe(false);
    const unknown = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_comp_settings",
          target: { compId: 1 },
          settings: { durationFrames: 10, bgColor: [0, 0, 0] },
        },
      ],
    });
    expect(unknown.success).toBe(false);
    const both = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_comp_settings",
          target: { compId: 1, compName: "main" },
          settings: { durationFrames: 10 },
        },
      ],
    });
    expect(both.success).toBe(false);
    const neither = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [{ op: "set_comp_settings", target: {}, settings: { durationFrames: 10 } }],
    });
    expect(neither.success).toBe(false);
  });

  it("accepts set_layer_switches by ids and by unique names", () => {
    const byIds = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_switches",
          target: { compId: 12, layerId: 3 },
          switches: { enabled: false, audioEnabled: true },
        },
      ],
    });
    expect(byIds.operations[0]).toMatchObject({
      op: "set_layer_switches",
      target: { compId: 12, layerId: 3 },
      switches: { enabled: false, audioEnabled: true },
    });

    const byNames = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_switches",
          target: { compName: "main", layerName: "Voice" },
          switches: { timeRemapEnabled: true },
        },
      ],
    });
    expect(byNames.operations[0]).toMatchObject({
      op: "set_layer_switches",
      target: { compName: "main", layerName: "Voice" },
      switches: { timeRemapEnabled: true },
    });
  });

  it("rejects empty or unknown set_layer_switches bags", () => {
    const empty = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_switches",
          target: { compId: 1, layerId: 2 },
          switches: {},
        },
      ],
    });
    expect(empty.success).toBe(false);

    const unknown = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_switches",
          target: { compId: 1, layerId: 2 },
          switches: { enabled: false, videoEnabled: false },
        },
      ],
    });
    expect(unknown.success).toBe(false);
  });

  it("accepts set_layer_transform by ids and by unique names", () => {
    const byIds = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compId: 12, layerId: 3 },
          transform: { position: [300, 550], opacity: 50 },
        },
      ],
    });
    expect(byIds.operations[0]).toMatchObject({
      op: "set_layer_transform",
      target: { compId: 12, layerId: 3 },
      transform: { position: [300, 550], opacity: 50 },
    });
    expect(byIds.operations[0]).not.toHaveProperty("expected");

    const byNames = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compName: "main", layerName: "Logo" },
          transform: { anchorPoint: [100, 200, 0], scale: [50, 50, 50], rotation: 15 },
        },
      ],
    });
    expect(byNames.operations[0]).toMatchObject({
      op: "set_layer_transform",
      target: { compName: "main", layerName: "Logo" },
      transform: { anchorPoint: [100, 200, 0], scale: [50, 50, 50], rotation: 15 },
    });
  });

  it("rejects empty/unknown set_layer_transform bags and expected field", () => {
    const empty = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compId: 1, layerId: 2 },
          transform: {},
        },
      ],
    });
    expect(empty.success).toBe(false);

    const unknown = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compId: 1, layerId: 2 },
          transform: { position: [0, 0], orientation: [0, 0, 0] },
        },
      ],
    });
    expect(unknown.success).toBe(false);

    const badLen = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compId: 1, layerId: 2 },
          transform: { position: [1] },
        },
      ],
    });
    expect(badLen.success).toBe(false);

    const withExpected = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_transform",
          target: { compId: 1, layerId: 2 },
          transform: { opacity: 50 },
          expected: { opacity: 100 },
        },
      ],
    });
    expect(withExpected.success).toBe(false);
  });

  it("rejects timeRemapEnabled on set_layer_timing", () => {
    const result = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_timing",
          target: { compId: 1, layerId: 2 },
          inFrame: 0,
          timeRemapEnabled: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects set_property_expression with both or neither selectors", () => {
    const both = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_property_expression",
          target: { compId: 1, layerId: 2 },
          matchNames: ["ADBE Scale"],
          propertyPath: "ADBE Scale",
          expression: "1",
        },
      ],
    });
    expect(both.success).toBe(false);

    const neither = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_property_expression",
          target: { compId: 1, layerId: 2 },
          expression: "1",
        },
      ],
    });
    expect(neither.success).toBe(false);
  });

  it("rejects seconds-only set_layer_timing payloads", () => {
    const secondsOnly = patchProjectInputSchema.safeParse({
      project: guardedProject(),
      operations: [
        {
          op: "set_layer_timing",
          target: { compId: 1, layerId: 2 },
          inPoint: 0,
          outPoint: 3,
        },
      ],
    });
    expect(secondsOnly.success).toBe(false);
  });

  it("accepts set_property_expression via propertyPath", () => {
    const parsed = patchProjectInputSchema.parse({
      project: guardedProject(),
      operations: [
        {
          op: "set_property_expression",
          target: { compId: 1, layerId: 2 },
          propertyPath: "ADBE Transform Group.ADBE Scale",
          expression: null,
        },
      ],
    });
    expect(parsed.operations[0]?.op).toBe("set_property_expression");
  });
});

describe("checkBroadTargetGate", () => {
  it("allows counts at or below the built-in max", () => {
    expect(checkBroadTargetGate(PATCH_MAX_TARGETS, false)).toBeNull();
  });

  it("refuses over-max without allowBroadTargetSet", () => {
    const refusal = checkBroadTargetGate(PATCH_MAX_TARGETS + 1, false);
    expect(refusal?.code).toBe("broad_target_set");
    expect(refusal?.resolvedTargetCount).toBe(PATCH_MAX_TARGETS + 1);
  });

  it("allows over-max when acknowledged", () => {
    expect(checkBroadTargetGate(PATCH_MAX_TARGETS + 10, true)).toBeNull();
  });
});

describe("buildPatchApplyScript", () => {
  it("includes guards, undo group, font apply, and broad gate", () => {
    const script = buildPatchApplyScript(
      JSON.stringify({
        project: guardedProject(),
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "layers", layers: [{ compId: 1, layerId: 2 }] },
            style: { font: "ArialMT" },
            allStyleRuns: true,
            preserveUnspecified: true,
          },
        ],
        allowBroadTargetSet: false,
      }),
    );
    expect(script).toContain("stale_fingerprint");
    expect(script).toContain("path_mismatch");
    expect(script).toContain("broad_target_set");
    expect(script).toContain("beginUndoGroup");
    expect(script).toContain("already_satisfied");
    expect(script).toContain("characterRange");
    expect(script).toContain("Source Text");
    expect(script).toContain("resolveTextSelector");
    expect(script).toContain("valueAtTime");
    expect(script).toContain("valueAtTime(comp.time, true)");
    expect(script).toContain("evaluatedFonts");
    expect(script).toContain("evaluatedStyle");
    expect(script).toContain("projectTextDocument");
    expect(script).toContain("styleSnapshotFromProjection");
    expect(script).toContain("applyStyleToDoc");
    expect(script).toContain("Cannot set leading with autoLeading: true");
    expect(script).toContain("fontCapsOption");
    expect(script).toContain("FONT_ALL_SMALL_CAPS");
    expect(script).toContain("capsBooleansFromDoc");
    expect(script).toContain("preservedCaps");
    expect(script).toContain('charWriteTarget("allCaps")');
    expect(script).not.toContain("fontCapsOptionFromBooleans");
    const preserveAt = script.indexOf("preservedCaps = capsBooleansFromDoc");
    const docOrderAt = script.indexOf("for (di = 0; di < TEXT_STYLE_DOC_ORDER.length");
    expect(preserveAt).toBeGreaterThan(-1);
    expect(docOrderAt).toBeGreaterThan(-1);
    expect(preserveAt).toBeLessThan(docOrderAt);
    expect(script).toContain("attachEvaluatedTextEvidence");
    expect(script).toContain("readAuthoredTextDocument");
    expect(script).toContain("readEvaluatedTextDocument");
    expect(script).not.toContain("planToken");
    expect(script).not.toContain("replaceFont");
  });

  it("includes panel op paths, cycle detection, and root refuse", () => {
    const script = buildPatchApplyScript(
      JSON.stringify({
        project: guardedProject(),
        operations: [
          { op: "create_folder", name: "Bundle", parentFolderId: 12 },
          {
            op: "move_project_item",
            selector: { kind: "items", itemIds: [1] },
            destinationFolderId: 12,
          },
          {
            op: "delete_project_item",
            selector: { kind: "items", itemIds: [99] },
          },
        ],
        allowBroadTargetSet: false,
      }),
    );
    expect(script).toContain("create_folder");
    expect(script).toContain("move_project_item");
    expect(script).toContain("delete_project_item");
    expect(script).toContain("addFolder");
    expect(script).toContain("wouldCreateFolderCycle");
    expect(script).toContain("Cycle checks run at apply time");
    expect(script).toContain("anyChanged: !!created");
    expect(script).toContain("function resolveOp");
    expect(script).toContain("function applyPlan");
    expect(script).toContain("function rootRefusalAmong");
    expect(script).toContain("countNestedDescendants");
    expect(script).toContain("collectUsedInCompIds");
    expect(script).toContain('Refusing to " + actionVerb + " the project root folder');
    expect(script).toContain("nestedItemCount");
    expect(script).toContain("usedInCompIds");
    expect(script).toContain("rootFolder.id === itemId");
  });

  it("includes control-plane ops, frame helpers, property path walk, and safe delete", () => {
    const script = buildPatchApplyScript(
      JSON.stringify({
        project: guardedProject(),
        operations: [
          {
            op: "create_solid",
            name: "S",
            width: 100,
            height: 100,
            pixelAspect: 1,
            color: [0, 0, 0],
          },
        ],
        allowBroadTargetSet: false,
      }),
    );
    expect(script).toContain("function timeToFrame");
    expect(script).toContain("function frameToTime");
    expect(script).toContain("function isOnGridFrame");
    expect(script).toContain("function layerTimingFrames");
    expect(script).toContain("function collectItemRefs");
    expect(script).toContain("applyCreateSolid");
    expect(script).toContain("applyReplaceLayerSource");
    expect(script).toContain("applySetLayerTiming");
    expect(script).toContain("layerTimingPostConditionError");
    expect(script).toContain("timing edge off-grid or frames did not match request");
    expect(script).toContain("implies exact durationFrames");
    expect(script).toContain("durationFrames: outFrame - inFrame");
    expect(script).toContain("startTime: startTime");
    expect(script).toContain("inPoint: inPoint");
    expect(script).toContain("outPoint: outPoint");
    expect(script).toContain("function snapshotLayerKeyframes");
    expect(script).toContain("function restoreLayerKeyframes");
    expect(script).toContain("function collectKeyframeDrift");
    expect(script).toContain("keyframes not preserved after timing write");
    expect(script).toContain("keyframesPreserved");
    expect(script).toContain("applySetLayerSwitches");
    expect(script).toContain("applySetLayerTransform");
    expect(script).toContain("function readLayerTransform");
    expect(script).toContain("function writeAndVerifyTransforms");
    expect(script).toContain("function keyframedTransformKeys");
    expect(script).toContain("function isAeArray");
    expect(script).toContain("function transformMatchName");
    expect(script).toContain("function isCoreTransformMatchName");
    expect(script).toContain("TRANSFORM_EPSILON");
    expect(script).toContain("defaultLayerTransform");
    expect(script).toContain("anyChanged: xfMutated");
    expect(script).toContain("anyChanged: xfCatchMutated");
    expect(script).toContain("applySetCompSettings");
    expect(script).toContain("readCompSettingsSnapshot");
    expect(script).toContain("clampWorkAreaToDuration");
    expect(script).toContain("compSettingsMatchRequest");
    expect(script).toContain("function readCompSwitches");
    expect(script).toContain("function compSwitchKeys");
    expect(script).not.toContain("rendererIsInstalled");
    expect(script).toContain("readLayerSwitches");
    expect(script).toContain("parsePropertyPathSegments");
    expect(script).toContain('split("->")');
    expect(script).toContain("applySetPropertyExpression");
    expect(script).toContain("applyResetLayerSurface");
    expect(script).toContain("applyDeleteLayer");
    expect(script).toContain("applySafeDeleteProjectItem");
    expect(script).toContain("unknownRefsPossible");
    expect(script).toContain("safe_delete_project_item");
    expect(script).toContain("layerIdPreserved");
  });

  it("includes rename_layer, comp/layer resolve, and rename post-condition (no footage helpers)", () => {
    const script = buildPatchApplyScript(
      JSON.stringify({
        project: guardedProject(),
        operations: [
          {
            op: "rename_layer",
            target: { compName: "main", layerName: "Hello World" },
            layerName: "{message_10}",
          },
        ],
        allowBroadTargetSet: false,
      }),
    );
    expect(script).toContain("applyRenameLayer");
    expect(script).toContain("function resolveComp");
    expect(script).toContain("function resolveLayer");
    expect(script).toContain("ambiguous_layer_name");
    expect(script).toContain("Post-condition failed: layer name did not match after write");
    expect(script).not.toContain("function resolveFootage");
  });
});

describe("parsePatchApplyResult", () => {
  it("shapes success, stale, idempotent, and rollback failures", () => {
    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: true,
          results: [
            {
              index: 0,
              op: "set_text_style",
              status: "already_satisfied",
              targets: [{ compId: 1, layerId: 2, status: "already_satisfied" }],
            },
          ],
          fingerprint: "rev:2|dirty:1|path:/tmp/Demo.aep",
          dirty: true,
          revision: 2,
        }),
      ),
    ).toMatchObject({ ok: true, revision: 2 });

    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: false,
          error: "Stale",
          code: "stale_fingerprint",
          context: {
            projectPath: "/tmp/Demo.aep",
            dirty: false,
            revision: 9,
            fingerprint: "rev:9|dirty:0|path:/tmp/Demo.aep",
            aeVersion: "25.0",
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "stale_fingerprint" });

    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: false,
          error: "boom",
          code: "apply_failed",
          results: [{ index: 0, op: "set_text_style", status: "failed", targets: [] }],
          rollback: { attempted: true, completed: true },
        }),
      ),
    ).toMatchObject({
      ok: false,
      rollback: { attempted: true, completed: true },
    });
  });

  it("shapes rename_layer evidence with before/after names", () => {
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: true,
        results: [
          {
            index: 0,
            op: "rename_layer",
            status: "changed",
            targets: [
              {
                compId: 12,
                layerId: 3,
                compName: "main",
                layerName: "{message_10}",
                status: "changed",
                before: { name: "Hello World" },
                after: { name: "{message_10}" },
              },
            ],
          },
        ],
        fingerprint: "rev:3|dirty:1|path:/tmp/Demo.aep",
        dirty: true,
        revision: 3,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.results[0]?.targets[0]).toMatchObject({
      before: { name: "Hello World" },
      after: { name: "{message_10}" },
      status: "changed",
    });
  });

  it("shapes set_layer_timing evidence with frames, seconds, durationFrames, and keyframe drift", () => {
    const timing = {
      startFrame: 0,
      inFrame: 518,
      outFrame: 637,
      durationFrames: 119,
      startTime: 0,
      inPoint: 518 / 29.97,
      outPoint: 637 / 29.97,
      stretch: 100,
    };
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: false,
        error: "Post-condition failed: keyframes not preserved after timing write",
        code: "apply_failed",
        results: [
          {
            index: 0,
            op: "set_layer_timing",
            status: "failed",
            targets: [
              {
                compId: 1,
                layerId: 2,
                status: "failed",
                before: timing,
                after: timing,
                keyframesPreserved: false,
                keyframeDrift: [
                  {
                    matchNames: ["ADBE Transform Group", "ADBE Scale"],
                    beforeTime: 23,
                    afterTime: 23.02,
                  },
                ],
                message: "Post-condition failed: keyframes not preserved after timing write",
              },
            ],
          },
        ],
        rollback: { attempted: true, completed: true },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.results?.[0]?.targets[0]).toMatchObject({
      status: "failed",
      keyframesPreserved: false,
      keyframeDrift: [
        {
          matchNames: ["ADBE Transform Group", "ADBE Scale"],
          beforeTime: 23,
          afterTime: 23.02,
        },
      ],
      before: {
        startFrame: 0,
        inFrame: 518,
        outFrame: 637,
        durationFrames: 119,
        startTime: 0,
        stretch: 100,
      },
      after: {
        inFrame: 518,
        outFrame: 637,
        durationFrames: 119,
      },
      message: expect.stringMatching(/keyframes not preserved/i),
    });
  });

  it("shapes rename post-condition failure with actual after (not overall success)", () => {
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: false,
        error: "Post-condition failed: layer name did not match after write",
        code: "apply_failed",
        results: [
          {
            index: 0,
            op: "rename_layer",
            status: "failed",
            targets: [
              {
                compId: 1,
                layerId: 2,
                status: "failed",
                before: { name: "A" },
                after: { name: "A" },
                message: "Post-condition failed: layer name did not match after write",
              },
            ],
          },
        ],
        rollback: { attempted: true, completed: true },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe("apply_failed");
    expect(parsed.results?.[0]?.targets[0]).toMatchObject({
      status: "failed",
      after: { name: "A" },
    });
  });

  it("shapes set_layer_transform evidence with authored numeric before/after", () => {
    const snap = {
      anchorPoint: [300, 550],
      position: [960, 540],
      scale: [100, 100],
      rotation: 0,
      opacity: 100,
    };
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: true,
        results: [
          {
            index: 0,
            op: "set_layer_transform",
            status: "changed",
            targets: [
              {
                compId: 1,
                layerId: 2,
                status: "changed",
                before: snap,
                after: { ...snap, position: [300, 550] },
              },
            ],
          },
        ],
        fingerprint: "rev:4|dirty:1|path:/tmp/Demo.aep",
        dirty: true,
        revision: 4,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.results[0]?.targets[0]).toMatchObject({
      status: "changed",
      before: { position: [960, 540], anchorPoint: [300, 550] },
      after: { position: [300, 550], anchorPoint: [300, 550], opacity: 100 },
    });
  });

  it("shapes resetTransforms evidence with numeric transforms and no cleared.transforms", () => {
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: true,
        results: [
          {
            index: 0,
            op: "reset_layer_surface",
            status: "changed",
            targets: [
              {
                compId: 1,
                layerId: 2,
                status: "changed",
                cleared: {
                  keyframes: true,
                  effects: true,
                  masks: true,
                  expressions: false,
                },
                before: {
                  transforms: {
                    anchorPoint: [100, 100],
                    position: [10, 20],
                    scale: [50, 50],
                    rotation: 15,
                    opacity: 40,
                  },
                },
                after: {
                  effectCount: 0,
                  maskCount: 0,
                  markerCount: 0,
                  hasParent: false,
                  hasTrackMatte: false,
                  transforms: {
                    anchorPoint: [960, 540],
                    position: [960, 540],
                    scale: [100, 100],
                    rotation: 0,
                    opacity: 100,
                  },
                },
              },
            ],
          },
        ],
        fingerprint: "rev:5|dirty:1|path:/tmp/Demo.aep",
        dirty: true,
        revision: 5,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = parsed.results[0]?.targets[0] as {
      cleared?: Record<string, unknown>;
      before?: { transforms?: { position?: number[] } };
      after?: { transforms?: { position?: number[]; opacity?: number } };
    };
    expect(target.cleared).not.toHaveProperty("transforms");
    expect(target.before?.transforms?.position).toEqual([10, 20]);
    expect(target.after?.transforms?.position).toEqual([960, 540]);
    expect(target.after?.transforms?.opacity).toBe(100);
  });

  it("shapes panel op evidence (create / move / delete impact)", () => {
    const parsed = parsePatchApplyResult(
      JSON.stringify({
        ok: true,
        results: [
          {
            index: 0,
            op: "create_folder",
            status: "changed",
            targets: [
              {
                itemId: 40,
                itemName: "Bundle",
                itemType: "folder",
                status: "changed",
                created: { id: 40, name: "Bundle", parentFolderId: 12 },
                after: { parentFolderId: 12, parentFolderName: "Root" },
              },
            ],
          },
          {
            index: 1,
            op: "move_project_item",
            status: "changed",
            targets: [
              {
                itemId: 1,
                itemName: "main",
                itemType: "comp",
                status: "changed",
                before: { parentFolderId: 12, parentFolderName: "Root" },
                after: { parentFolderId: 40, parentFolderName: "Bundle" },
              },
            ],
          },
          {
            index: 2,
            op: "delete_project_item",
            status: "changed",
            targets: [
              {
                itemId: 40,
                itemName: "Bundle",
                itemType: "folder",
                status: "changed",
                nestedItemCount: 1,
                usedInCompIds: [],
                usedInCompCount: 0,
              },
            ],
          },
        ],
        fingerprint: "rev:5|dirty:1|path:/tmp/Demo.aep",
        dirty: true,
        revision: 5,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fingerprint).toContain("rev:5");
    expect(parsed.results[0]?.targets[0]).toMatchObject({
      itemId: 40,
      created: { id: 40, name: "Bundle", parentFolderId: 12 },
    });
    expect(parsed.results[1]?.targets[0]).toMatchObject({
      before: { parentFolderId: 12 },
      after: { parentFolderId: 40 },
    });
    expect(parsed.results[2]?.targets[0]).toMatchObject({
      nestedItemCount: 1,
      usedInCompIds: [],
      usedInCompCount: 0,
    });
  });
});

describe("applyProjectPatch", () => {
  it("returns validation errors without calling the host", async () => {
    const evalScript = vi.fn();
    const host = { evalScript } as unknown as AeHost;
    const result = await applyProjectPatch(host, { operations: [] }, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
    expect(evalScript).not.toHaveBeenCalled();
  });

  it("surfaces stale fingerprint from host JSON", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          ok: false,
          error: "Stale fingerprint",
          code: "stale_fingerprint",
          context: {
            projectPath: "/tmp/Demo.aep",
            dirty: false,
            revision: 3,
            fingerprint: "rev:3|dirty:0|path:/tmp/Demo.aep",
            aeVersion: "25.0",
          },
        }),
      }),
    } as unknown as AeHost;
    const result = await applyProjectPatch(
      host,
      {
        project: guardedProject(),
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "all_text_layers" },
            style: { font: "ArialMT" },
          },
        ],
      },
      1000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_fingerprint");
  });
});

describe("saveProject", () => {
  it("refuses overwrite when destination exists", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "lc-save-"));
    const dest = join(dir, "copy.aep");
    writeFileSync(dest, "existing");

    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 1,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;

    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: dest,
      },
      { artifactDir: dir, timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("overwrite_refused");
  });

  it("refuses stale fingerprint", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 5,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: "/tmp/out.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_fingerprint");
  });

  it("refuses create_backup when the project is dirty", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: true,
          revision: 4,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "create_backup",
        expectedFingerprint: "rev:4|dirty:1|path:/tmp/Demo.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.error).toMatch(/clean, saved project/i);
    }
  });

  it("requires absolute path for save_copy", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 1,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: "relative.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
  });
});
