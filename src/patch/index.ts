export { applyProjectPatch, parsePatchApplyResult } from "./apply.js";
export { buildPatchApplyScript } from "./apply-script.js";
export { checkBroadTargetGate } from "./broad-gate.js";
export { PATCH_MAX_TARGETS, PATCH_UNDO_GROUP_NAME } from "./constants.js";
export {
  createFolderOpSchema,
  deleteProjectItemOpSchema,
  layerTargetSchema,
  moveProjectItemOpSchema,
  patchOperationSchema,
  patchProjectInputSchema,
  renameLayerOpSchema,
  setTextStyleOpSchema,
  type CreateFolderOp,
  type DeleteProjectItemOp,
  type LayerTarget,
  type MoveProjectItemOp,
  type PatchOperation,
  type PatchProjectInput,
  type RenameLayerOp,
  type SetTextStyleOp,
} from "./schema.js";
export { saveProject, type SaveProjectInput, type SaveProjectResult } from "./save.js";
export type {
  CreateFolderTargetResult,
  DeleteProjectItemTargetResult,
  MoveProjectItemTargetResult,
  PanelFolderPlacement,
  PanelTargetResult,
  PatchApplyResult,
  PatchOpStatus,
  PatchTargetResult,
  RenameLayerTargetResult,
  TextStyleTargetResult,
} from "./types.js";
