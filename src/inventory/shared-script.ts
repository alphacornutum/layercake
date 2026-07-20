/**
 * Shared ExtendScript helpers for inventory scripts (folder placement, footage kind,
 * compact source refs, project name). Concatenate before script-specific bodies.
 *
 * Relies on JSON.stringify from the extendscript-json polyfill injected by
 * wrapExtendScript (AE ExtendScript has no built-in JSON).
 */
export const SHARED_INVENTORY_HELPERS = `
function projectNameOf() {
  var projectName = "";
  try {
    projectName = app.project.file ? File.decode(app.project.file.name) : app.project.name;
  } catch (e) {
    projectName = app.project.name || "";
  }
  return projectName;
}

function footageKindOf(footageItem) {
  var src = footageItem.mainSource;
  if (src instanceof SolidSource) return "solid";
  if (src instanceof PlaceholderSource) return "placeholder";
  if (src instanceof FileSource) return "file";
  return "file";
}

function folderPlacement(item) {
  var root = app.project.rootFolder;
  var parent = item.parentFolder;
  var parentFolderId = parent ? parent.id : root.id;
  var parts = [];
  var folder = parent;
  while (folder && folder.id !== root.id) {
    parts.unshift(folder.name);
    var next = folder.parentFolder;
    if (!next || next.id === folder.id) break;
    folder = next;
  }
  return {
    parentFolderId: parentFolderId,
    folderPath: parts.join("/")
  };
}

function serializeSourceRef(avItem) {
  if (!avItem) return null;
  var placement = folderPlacement(avItem);
  var ref = {
    id: avItem.id,
    name: avItem.name,
    type: avItem instanceof CompItem ? "comp" : "footage",
    parentFolderId: placement.parentFolderId,
    folderPath: placement.folderPath
  };
  if (ref.type === "footage") {
    ref.footageKind = footageKindOf(avItem);
  }
  return ref;
}

/** Nearest integer frame from seconds using containing-comp frameRate. */
function timeToFrame(time, frameRate) {
  if (!frameRate || frameRate <= 0) return 0;
  return Math.round(Number(time) * Number(frameRate));
}

/** Seconds from integer frame using containing-comp frameRate. */
function frameToTime(frame, frameRate) {
  if (!frameRate || frameRate <= 0) return 0;
  return Number(frame) / Number(frameRate);
}
`.trim();
