import { loadAeScript } from "../host/load-ae-script.js";
import { PATCH_MAX_TARGETS, PATCH_UNDO_GROUP_NAME } from "./constants.js";

/**
 * Build apply ExtendScript with an injected JSON payload.
 * Payload shape matches PatchProjectInput plus maxTargets.
 */
export function buildPatchApplyScript(payloadJson: string): string {
  const escaped = escapeExtendScriptStringLiteral(payloadJson);
  return `
var __payloadJson = "${escaped}";
var payload = JSON.parse(__payloadJson);
var MAX_TARGETS = ${PATCH_MAX_TARGETS};
var UNDO_NAME = ${JSON.stringify(PATCH_UNDO_GROUP_NAME)};
${loadAeScript("patch-apply")}
`.trim();
}

function escapeExtendScriptStringLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
