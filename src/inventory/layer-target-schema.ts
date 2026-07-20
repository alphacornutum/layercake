import { z } from "zod";

const EXACTLY_ONE_COMP = "Provide exactly one of compId or compName";

const compTargetFields = z.object({
  compId: z.number().int().optional().describe("Composition Item.id"),
  compName: z.string().optional().describe("Exact composition name (case-sensitive)"),
});

/**
 * Shared comps-only identity (patch ops that target a composition, not a layer).
 * Exactly one of compId|compName.
 */
export const compTargetSchema = compTargetFields.refine(
  (v) => (v.compId !== undefined) !== (v.compName !== undefined),
  { message: EXACTLY_ONE_COMP },
);

/**
 * Shared id|name layer identity (inspect + patch).
 * Exactly one of compId|compName and exactly one of layerId|layerName.
 * Comp fields come from the same object shape as `compTargetSchema`.
 */
export const layerTargetSchema = compTargetFields
  .extend({
    layerId: z.number().int().optional().describe("Layer.id within that composition"),
    layerName: z.string().optional().describe("Exact layer name (case-sensitive)"),
  })
  .refine((v) => (v.compId !== undefined) !== (v.compName !== undefined), {
    message: EXACTLY_ONE_COMP,
  })
  .refine((v) => (v.layerId !== undefined) !== (v.layerName !== undefined), {
    message: "Provide exactly one of layerId or layerName",
  });

/** MCP / typed input for `ae_get_layer` (layer identity + inspect options). */
export const getLayerInputSchema = layerTargetSchema.and(
  z.object({
    detail: z
      .enum(["overview", "extended", "full"])
      .optional()
      .describe('Depth tier (default "overview")'),
    matchNames: z
      .array(z.string())
      .optional()
      .describe("Optional PropertyBase.matchName filters (exact; includes descendants)"),
    atTime: z
      .number()
      .optional()
      .describe("Sample time in composition seconds (default: composition CTI)"),
    preExpression: z.boolean().optional().describe("valueAtTime preExpression flag (default true)"),
  }),
);

export type CompTarget = z.infer<typeof compTargetSchema>;
export type LayerTarget = z.infer<typeof layerTargetSchema>;
export type GetLayerInput = z.infer<typeof getLayerInputSchema>;
