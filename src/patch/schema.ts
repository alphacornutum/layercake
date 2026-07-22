import { z } from "zod";

import { COMP_SWITCH_KEYS, type CompSwitchKey } from "../inventory/comp-switches.js";
import { compTargetSchema, layerTargetSchema } from "../inventory/layer-target-schema.js";

export { compTargetSchema, layerTargetSchema };
export type { CompTarget, LayerTarget } from "../inventory/layer-target-schema.js";

const compSwitchFieldSchemas = Object.fromEntries(
  COMP_SWITCH_KEYS.map((k) => [k, z.boolean().optional()]),
) as { [K in CompSwitchKey]: z.ZodOptional<z.ZodBoolean> };

const compsSelectorSchema = z
  .object({
    kind: z.literal("comps"),
    compIds: z.array(z.number().int()).optional().describe("Composition Item.id values"),
    compNames: z
      .array(z.string())
      .optional()
      .describe("Exact composition names (case-sensitive; each must resolve uniquely)"),
  })
  .refine((v) => (v.compIds?.length ?? 0) > 0 || (v.compNames?.length ?? 0) > 0, {
    message: "Provide at least one non-empty compIds or compNames list",
  });

// z.union (not discriminatedUnion): compsSelectorSchema is refined (ZodEffects).
const textSelectorSchema = z.union([
  z.object({
    kind: z.literal("layers"),
    layers: z.array(layerTargetSchema).min(1),
  }),
  compsSelectorSchema,
  z.object({
    kind: z.literal("all_text_layers"),
  }),
]);

const itemsSelectorSchema = z.object({
  kind: z.literal("items"),
  itemIds: z
    .array(z.number().int())
    .min(1)
    .describe("Stable Project panel Item.id values (not names)"),
});

// Prefer length-bounded array over z.tuple: tuple JSON Schema emits `items` as an
// array of schemas, which Codex rejects when building MCP tool specs.
const rgbColorSchema = z.array(z.number()).length(3).describe("RGB color in [0..1] per channel");

const vec2Schema = z.array(z.number()).length(2).describe("2D vector [x, y] or [width, height]");

export const TEXT_JUSTIFICATION_VALUES = [
  "LEFT_JUSTIFY",
  "RIGHT_JUSTIFY",
  "CENTER_JUSTIFY",
  "FULL_JUSTIFY_LASTLINE_LEFT",
  "FULL_JUSTIFY_LASTLINE_RIGHT",
  "FULL_JUSTIFY_LASTLINE_CENTER",
  "FULL_JUSTIFY_LASTLINE_FULL",
] as const;

const textStyleBagSchema = z
  .object({
    font: z
      .string()
      .min(1)
      .optional()
      .describe("Exact ExtendScript TextDocument/CharacterRange font string"),
    fontSize: z.number().optional(),
    fillColor: rgbColorSchema.optional(),
    applyFill: z.boolean().optional(),
    strokeColor: rgbColorSchema.optional(),
    applyStroke: z.boolean().optional(),
    strokeWidth: z.number().optional(),
    tracking: z.number().optional(),
    baselineShift: z.number().optional(),
    fauxBold: z.boolean().optional(),
    fauxItalic: z.boolean().optional(),
    allCaps: z.boolean().optional(),
    smallCaps: z.boolean().optional(),
    horizontalScale: z.number().optional(),
    verticalScale: z.number().optional(),
    autoLeading: z.boolean().optional(),
    leading: z.number().optional(),
    justification: z.enum(TEXT_JUSTIFICATION_VALUES).optional(),
    text: z.string().optional(),
    boxTextSize: vec2Schema.optional(),
    boxTextPos: vec2Schema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "style requires at least one allowlisted key",
  });

export type TextStyleBag = z.infer<typeof textStyleBagSchema>;

export const setTextStyleOpSchema = z.object({
  op: z.literal("set_text_style"),
  selector: textSelectorSchema,
  style: textStyleBagSchema,
  allStyleRuns: z.boolean().optional().default(true),
  preserveUnspecified: z.boolean().optional().default(true),
});

export const renameLayerOpSchema = z.object({
  op: z.literal("rename_layer"),
  target: layerTargetSchema,
  layerName: z
    .string()
    .min(1)
    .describe("Desired new layer name (opaque; braces and counters preserved)"),
});

export const createFolderOpSchema = z.object({
  op: z.literal("create_folder"),
  name: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional folder name (opaque). Omit = host default (placeholder Untitled Folder when AE requires a name). See ADR 0006.",
    ),
  parentFolderId: z
    .number()
    .int()
    .describe("Destination FolderItem Item.id (use inventory root id, never a magic 0)"),
});

export const moveProjectItemOpSchema = z.object({
  op: z.literal("move_project_item"),
  selector: itemsSelectorSchema,
  destinationFolderId: z
    .number()
    .int()
    .describe("Destination FolderItem Item.id (including real rootFolder.id from inventory)"),
});

export const deleteProjectItemOpSchema = z.object({
  op: z.literal("delete_project_item"),
  selector: itemsSelectorSchema,
});

export const renameProjectItemOpSchema = z.object({
  op: z.literal("rename_project_item"),
  itemId: z.number().int().describe("Stable Project panel Item.id"),
  name: z.string().min(1).describe("Desired item name (opaque; no normalization)"),
});

export const setLayerIndexOpSchema = z.object({
  op: z.literal("set_layer_index"),
  target: layerTargetSchema,
  index: z.number().int().min(1).describe("1-based layer index within the composition"),
});

export const createSolidOpSchema = z.object({
  op: z.literal("create_solid"),
  name: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional solid name (opaque). Omit = host default (placeholder Solid when AE requires a name). See ADR 0006.",
    ),
  width: z.number().int().min(4).max(30000),
  height: z.number().int().min(4).max(30000),
  pixelAspect: z.number().positive(),
  color: rgbColorSchema,
  parentFolderId: z.number().int().optional().describe("Optional FolderItem Item.id"),
});

const boxTextSizeSchema = z
  .array(z.number())
  .length(2)
  .refine((v) => v[0]! >= 1 && v[1]! >= 1, {
    message: "boxTextSize values must be at least 1",
  })
  .describe("Box text size [width, height] in pixels");

export const createTextOpSchema = z
  .object({
    op: z.literal("create_text"),
    target: compTargetSchema,
    layout: z.enum(["point", "box"]).describe("Horizontal point text or paragraph (box) text"),
    text: z.string().describe("Source text content (empty string allowed)"),
    boxTextSize: boxTextSizeSchema.optional(),
    name: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional layer name (opaque). Omit = AE default for addText/addBoxText. See ADR 0006.",
      ),
    style: textStyleBagSchema
      .optional()
      .describe("Optional partial TextDocument style bag (same allowlist as set_text_style)"),
  })
  .superRefine((v, ctx) => {
    if (v.layout === "box" && v.boxTextSize === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "boxTextSize is required when layout is box",
        path: ["boxTextSize"],
      });
    }
    if (v.layout === "point" && v.boxTextSize !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "boxTextSize is not allowed when layout is point",
        path: ["boxTextSize"],
      });
    }
  });

export const replaceLayerSourceOpSchema = z.object({
  op: z.literal("replace_layer_source"),
  target: layerTargetSchema,
  sourceItemId: z.number().int().describe("Replacement AVItem Item.id"),
  fixExpressions: z.boolean().optional().default(true),
});

export const setLayerTimingOpSchema = z
  .object({
    op: z.literal("set_layer_timing"),
    target: layerTargetSchema,
    startFrame: z.number().int().optional(),
    inFrame: z.number().int().optional(),
    outFrame: z.number().int().optional(),
    stretch: z.number().optional().describe("Layer stretch percentage"),
  })
  .strict()
  .refine(
    (v) =>
      v.startFrame !== undefined ||
      v.inFrame !== undefined ||
      v.outFrame !== undefined ||
      v.stretch !== undefined,
    {
      message:
        "Provide at least one integer frame field (startFrame/inFrame/outFrame) or stretch — seconds-only timing is refused; use set_layer_switches for timeRemapEnabled",
    },
  );

const layerSwitchesBagSchema = z
  .object({
    enabled: z.boolean().optional().describe("Layer.enabled (eyeball / video switch)"),
    audioEnabled: z.boolean().optional(),
    solo: z.boolean().optional(),
    shy: z.boolean().optional(),
    locked: z.boolean().optional(),
    guideLayer: z.boolean().optional(),
    adjustmentLayer: z.boolean().optional(),
    threeDLayer: z.boolean().optional(),
    collapseTransformation: z.boolean().optional(),
    frameBlending: z.boolean().optional(),
    motionBlur: z.boolean().optional(),
    timeRemapEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.enabled !== undefined ||
      v.audioEnabled !== undefined ||
      v.solo !== undefined ||
      v.shy !== undefined ||
      v.locked !== undefined ||
      v.guideLayer !== undefined ||
      v.adjustmentLayer !== undefined ||
      v.threeDLayer !== undefined ||
      v.collapseTransformation !== undefined ||
      v.frameBlending !== undefined ||
      v.motionBlur !== undefined ||
      v.timeRemapEnabled !== undefined,
    { message: "Provide at least one switch key in switches" },
  );

export const setLayerSwitchesOpSchema = z.object({
  op: z.literal("set_layer_switches"),
  target: layerTargetSchema,
  switches: layerSwitchesBagSchema.describe(
    "Partial switch bag; omitted keys are preserved. Evidence returns a full readable snapshot.",
  ),
});

const compSwitchesBagSchema = z.object(compSwitchFieldSchemas).strict();

const compSettingsBagSchema = z
  .object({
    width: z.number().int().min(1).max(30000).optional(),
    height: z.number().int().min(1).max(30000).optional(),
    pixelAspect: z.number().positive().optional(),
    frameRate: z.number().positive().optional(),
    durationFrames: z.number().int().min(0).optional(),
    displayStartFrame: z.number().int().optional(),
    workAreaStartFrame: z.number().int().min(0).optional(),
    workAreaDurationFrames: z.number().int().min(0).optional(),
    renderer: z.string().min(1).optional(),
    switches: compSwitchesBagSchema.optional(),
  })
  .strict()
  .refine(
    (v) => {
      const { switches, ...rest } = v;
      if (Object.values(rest).some((x) => x !== undefined)) return true;
      return !!switches && Object.values(switches).some((x) => x !== undefined);
    },
    { message: "Provide at least one allowlisted field in settings" },
  );

export const setCompSettingsOpSchema = z.object({
  op: z.literal("set_comp_settings"),
  target: compTargetSchema,
  settings: compSettingsBagSchema.describe(
    "Partial composition settings; omitted keys are preserved. Evidence returns a full settings snapshot.",
  ),
});

export const setPropertyExpressionOpSchema = z
  .object({
    op: z.literal("set_property_expression"),
    target: layerTargetSchema,
    matchNames: z.array(z.string().min(1)).min(1).optional(),
    propertyPath: z.string().min(1).optional(),
    expression: z.string().nullable().describe("Expression body, or null to clear"),
    expressionEnabled: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    const hasNames = (v.matchNames?.length ?? 0) > 0;
    const hasPath = v.propertyPath !== undefined && v.propertyPath.length > 0;
    if (hasNames === hasPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of matchNames or propertyPath",
      });
    }
  });

// Prefer length-bounded array over z.tuple: tuple JSON Schema emits `items` as an
// array of schemas, which Codex rejects when building MCP tool specs.
const spatialArraySchema = z
  .union([z.array(z.number()).length(2), z.array(z.number()).length(3)])
  .describe("Spatial/scale array (length 2 or 3)");

const layerTransformBagSchema = z
  .object({
    anchorPoint: spatialArraySchema.optional(),
    position: spatialArraySchema.optional(),
    scale: spatialArraySchema.optional(),
    rotation: z.number().optional().describe("2D / Z rotation in degrees"),
    opacity: z.number().optional().describe("Opacity 0–100"),
  })
  .strict()
  .refine(
    (v) =>
      v.anchorPoint !== undefined ||
      v.position !== undefined ||
      v.scale !== undefined ||
      v.rotation !== undefined ||
      v.opacity !== undefined,
    { message: "Provide at least one transform key in transform" },
  );

export const setLayerTransformOpSchema = z
  .object({
    op: z.literal("set_layer_transform"),
    target: layerTargetSchema,
    transform: layerTransformBagSchema.describe(
      "Partial authored Transform bag; omitted keys are preserved. Evidence returns a full readable snapshot.",
    ),
  })
  .strict();

export const resetLayerSurfaceOpSchema = z.object({
  op: z.literal("reset_layer_surface"),
  target: layerTargetSchema,
  clearKeyframes: z.boolean().optional().default(true),
  clearEffects: z.boolean().optional().default(true),
  clearMasks: z.boolean().optional().default(true),
  clearLayerStyles: z.boolean().optional().default(true),
  clearMarkers: z.boolean().optional().default(true),
  clearTrackMatte: z.boolean().optional().default(true),
  clearParent: z.boolean().optional().default(true),
  resetTransforms: z.boolean().optional().default(false),
  clearExpressions: z.boolean().optional().default(false),
});

export const deleteLayerOpSchema = z.object({
  op: z.literal("delete_layer"),
  target: layerTargetSchema,
});

export const safeDeleteProjectItemOpSchema = z.object({
  op: z.literal("safe_delete_project_item"),
  selector: itemsSelectorSchema,
});

// z.union (not discriminatedUnion): several ops use .refine / .superRefine / .strict (ZodEffects).
export const patchOperationSchema = z.union([
  setTextStyleOpSchema,
  renameLayerOpSchema,
  createFolderOpSchema,
  moveProjectItemOpSchema,
  deleteProjectItemOpSchema,
  renameProjectItemOpSchema,
  setLayerIndexOpSchema,
  createSolidOpSchema,
  createTextOpSchema,
  replaceLayerSourceOpSchema,
  setLayerTimingOpSchema,
  setLayerSwitchesOpSchema,
  setCompSettingsOpSchema,
  setPropertyExpressionOpSchema,
  setLayerTransformOpSchema,
  resetLayerSurfaceOpSchema,
  deleteLayerOpSchema,
  safeDeleteProjectItemOpSchema,
]);

export const patchProjectInputSchema = z.object({
  project: z.object({
    path: z.string().describe("Absolute path guard for the open project (not an open request)"),
    fingerprint: z.string().describe("Fingerprint from ae_project_context"),
  }),
  operations: z.array(patchOperationSchema).min(1),
  allowBroadTargetSet: z
    .boolean()
    .optional()
    .default(false)
    .describe("Required when resolved targets exceed the built-in maximum"),
});

export type SetTextStyleOp = z.infer<typeof setTextStyleOpSchema>;
export type RenameLayerOp = z.infer<typeof renameLayerOpSchema>;
export type CreateFolderOp = z.infer<typeof createFolderOpSchema>;
export type MoveProjectItemOp = z.infer<typeof moveProjectItemOpSchema>;
export type DeleteProjectItemOp = z.infer<typeof deleteProjectItemOpSchema>;
export type RenameProjectItemOp = z.infer<typeof renameProjectItemOpSchema>;
export type SetLayerIndexOp = z.infer<typeof setLayerIndexOpSchema>;
export type CreateSolidOp = z.infer<typeof createSolidOpSchema>;
export type CreateTextOp = z.infer<typeof createTextOpSchema>;
export type ReplaceLayerSourceOp = z.infer<typeof replaceLayerSourceOpSchema>;
export type SetLayerTimingOp = z.infer<typeof setLayerTimingOpSchema>;
export type SetLayerSwitchesOp = z.infer<typeof setLayerSwitchesOpSchema>;
export type SetCompSettingsOp = z.infer<typeof setCompSettingsOpSchema>;
export type SetPropertyExpressionOp = z.infer<typeof setPropertyExpressionOpSchema>;
export type SetLayerTransformOp = z.infer<typeof setLayerTransformOpSchema>;
export type ResetLayerSurfaceOp = z.infer<typeof resetLayerSurfaceOpSchema>;
export type DeleteLayerOp = z.infer<typeof deleteLayerOpSchema>;
export type SafeDeleteProjectItemOp = z.infer<typeof safeDeleteProjectItemOpSchema>;
export type PatchOperation = z.infer<typeof patchOperationSchema>;
export type PatchProjectInput = z.infer<typeof patchProjectInputSchema>;
