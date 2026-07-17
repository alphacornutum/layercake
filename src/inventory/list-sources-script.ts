import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * ExtendScript that inventories all FootageItems in the open project.
 * Returns a JSON string.
 */
const LIST_SOURCES_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function serializeSource(item) {
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

var sources = [];
var items = app.project.items;
for (var i = 1; i <= items.length; i++) {
  var item = items[i];
  if (item instanceof FootageItem) {
    sources.push(serializeSource(item));
  }
}

return JSON.stringify({
  projectName: projectNameOf(),
  sources: sources
});
`.trim();

export const LIST_SOURCES_SCRIPT = `${SHARED_INVENTORY_HELPERS}\n\n${LIST_SOURCES_BODY}`;
