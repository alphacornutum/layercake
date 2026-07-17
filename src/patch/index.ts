export { applyProjectPatch, parsePatchApplyResult } from "./apply.js";
export { buildPatchApplyScript } from "./apply-script.js";
export { checkBroadTargetGate } from "./broad-gate.js";
export { PATCH_MAX_TARGETS, PATCH_UNDO_GROUP_NAME } from "./constants.js";
export {
  patchOperationSchema,
  patchProjectInputSchema,
  setTextStyleOpSchema,
  type PatchOperation,
  type PatchProjectInput,
  type SetTextStyleOp,
} from "./schema.js";
export { saveProject, type SaveProjectInput, type SaveProjectResult } from "./save.js";
export type { PatchApplyResult, PatchOpStatus } from "./types.js";
