import { z } from "zod";

/**
 * Shared id|name layer identity (inspect + patch).
 * Exactly one of compId|compName and exactly one of layerId|layerName.
 */
export const layerTargetSchema = z
  .object({
    compId: z.number().int().optional().describe("Composition Item.id"),
    compName: z.string().optional().describe("Exact composition name (case-sensitive)"),
    layerId: z.number().int().optional().describe("Layer.id within that composition"),
    layerName: z.string().optional().describe("Exact layer name (case-sensitive)"),
  })
  .refine((v) => (v.compId !== undefined) !== (v.compName !== undefined), {
    message: "Provide exactly one of compId or compName",
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

export type LayerTarget = z.infer<typeof layerTargetSchema>;
export type GetLayerInput = z.infer<typeof getLayerInputSchema>;
