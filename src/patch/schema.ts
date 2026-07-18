import { z } from "zod";

const layerRefSchema = z.object({
  compId: z.number().int().describe("Composition Item.id"),
  layerId: z.number().int().describe("Layer.id within that composition"),
});

const textSelectorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("layers"),
    layers: z.array(layerRefSchema).min(1),
  }),
  z.object({
    kind: z.literal("comps"),
    compIds: z.array(z.number().int()).min(1),
  }),
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

export const setTextStyleOpSchema = z.object({
  op: z.literal("set_text_style"),
  selector: textSelectorSchema,
  style: z.object({
    font: z.string().min(1).describe("Exact ExtendScript TextDocument/CharacterRange font string"),
  }),
  allStyleRuns: z.boolean().optional().default(true),
  preserveUnspecified: z.boolean().optional().default(true),
});

export const createFolderOpSchema = z.object({
  op: z.literal("create_folder"),
  name: z.string().min(1).describe("Folder name in the Project panel"),
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

export const patchOperationSchema = z.discriminatedUnion("op", [
  setTextStyleOpSchema,
  createFolderOpSchema,
  moveProjectItemOpSchema,
  deleteProjectItemOpSchema,
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
export type CreateFolderOp = z.infer<typeof createFolderOpSchema>;
export type MoveProjectItemOp = z.infer<typeof moveProjectItemOpSchema>;
export type DeleteProjectItemOp = z.infer<typeof deleteProjectItemOpSchema>;
export type PatchOperation = z.infer<typeof patchOperationSchema>;
export type PatchProjectInput = z.infer<typeof patchProjectInputSchema>;
