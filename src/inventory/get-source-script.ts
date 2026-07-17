import { SHARED_INSPECT_HELPERS } from "./inspect-script.js";
import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";
import type { GetSourceArgs, SourceInspectDetail } from "./types.js";

export type ResolvedGetSourceArgs = {
  sourceId: number | null;
  sourceName: string | null;
  detail: SourceInspectDetail;
};

/**
 * ExtendScript body for deep footage inspect. Expects `var __args = {...}` beforehand.
 */
const GET_SOURCE_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function serializeSourceRow(item) {
  var placement = folderPlacement(item);
  var kind = footageKindOf(item);
  var main = item.mainSource;
  var file = null;
  var missingFootagePath = null;
  var solidColor = null;
  var isStill = false;

  if (kind === "file" && main) {
    try {
      if (main.file) file = main.file.fsName;
    } catch (e) {}
    try {
      var missing = main.missingFootagePath;
      if (missing !== undefined && missing !== null && missing !== "") {
        missingFootagePath = String(missing);
      }
    } catch (e) {}
  }
  if (kind === "solid" && main) {
    try {
      var c = main.color;
      solidColor = [c[0], c[1], c[2]];
    } catch (e) {}
  }
  try {
    if (main) isStill = !!main.isStill;
  } catch (e) {}

  var usedInCompIds = [];
  try {
    var used = item.usedIn;
    if (used) {
      for (var u = 0; u < used.length; u++) {
        usedInCompIds.push(used[u].id);
      }
    }
  } catch (e) {}

  return {
    id: item.id,
    name: item.name,
    label: item.label,
    comment: item.comment ? String(item.comment) : "",
    footageKind: kind,
    width: item.width,
    height: item.height,
    pixelAspect: item.pixelAspect,
    frameRate: item.frameRate,
    duration: item.duration,
    hasVideo: !!item.hasVideo,
    hasAudio: !!item.hasAudio,
    footageMissing: !!item.footageMissing,
    isStill: isStill,
    useProxy: !!item.useProxy,
    file: file,
    missingFootagePath: missingFootagePath,
    solidColor: solidColor,
    parentFolderId: placement.parentFolderId,
    folderPath: placement.folderPath,
    usedInCompIds: usedInCompIds
  };
}

var item = resolveFootage(__args.sourceId, __args.sourceName);
var detail = __args.detail || "overview";
var source = serializeSourceRow(item);

if (detail === "overview") {
  source.interpret = serializeInterpretSummary(item.mainSource);
} else {
  source.mainSource = serializeInterpretFull(item.mainSource, source.footageKind);
  source.proxySource = null;
  try {
    if (item.useProxy && item.proxySource) {
      source.proxySource = serializeInterpretFull(item.proxySource, null);
    }
  } catch (e) {}
}

return JSON.stringify({
  projectName: projectNameOf(),
  detail: detail,
  source: source
});
`.trim();

export function resolveGetSourceArgs(input: GetSourceArgs): ResolvedGetSourceArgs {
  const hasId = input.sourceId !== undefined;
  const hasName = input.sourceName !== undefined;
  if (hasId === hasName) {
    throw new Error("Provide exactly one of sourceId or sourceName");
  }
  const detail = input.detail ?? "overview";
  if (detail !== "overview" && detail !== "full") {
    throw new Error('detail must be "overview" or "full"');
  }
  return {
    sourceId: hasId ? input.sourceId! : null,
    sourceName: hasName ? input.sourceName! : null,
    detail,
  };
}

export function buildGetSourceScript(input: GetSourceArgs): string {
  const args = resolveGetSourceArgs(input);
  return [
    SHARED_INVENTORY_HELPERS,
    SHARED_INSPECT_HELPERS,
    `var __args = ${JSON.stringify(args)};`,
    GET_SOURCE_BODY,
  ].join("\n\n");
}
