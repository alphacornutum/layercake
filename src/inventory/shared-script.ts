/**
 * Shared ExtendScript helpers for inventory scripts (folder placement, footage kind,
 * compact source refs, project name). Concatenate before script-specific bodies.
 *
 * Relies on JSON.stringify from the extendscript-json polyfill injected by
 * wrapExtendScript (AE ExtendScript has no built-in JSON).
 */
import { COMP_SWITCH_KEYS, COMP_SWITCH_KEYS_ES3 } from "./comp-switches.js";

const readCompSwitchesDefaults = COMP_SWITCH_KEYS.map((k) => `${k}: false`).join(",\n    ");
const readCompSwitchesReads = COMP_SWITCH_KEYS.map(
  (k) => `try {\n    switches.${k} = !!comp.${k};\n  } catch (e) {}`,
).join("\n  ");

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

/**
 * True when seconds land on the integer frame within a tight frame-unit epsilon.
 * Prefer frame units over absolute seconds so non-integer fps (23.976, 29.97) stay fair.
 */
function isOnGridFrame(time, frame, frameRate) {
  if (!frameRate || frameRate <= 0) return false;
  var delta = Math.abs(Number(time) * Number(frameRate) - Number(frame));
  return delta < 1e-6;
}

/** Integer-frame + raw-seconds timing snapshot for a layer (inventory + patch evidence). */
function layerTimingFrames(layer, frameRate) {
  var startTime = layer.startTime;
  var inPoint = layer.inPoint;
  var outPoint = layer.outPoint;
  var inFrame = timeToFrame(inPoint, frameRate);
  var outFrame = timeToFrame(outPoint, frameRate);
  return {
    startTime: startTime,
    inPoint: inPoint,
    outPoint: outPoint,
    startFrame: timeToFrame(startTime, frameRate),
    inFrame: inFrame,
    outFrame: outFrame,
    durationFrames: outFrame - inFrame,
    stretch: layer.stretch
  };
}

/**
 * Semantic 2D Transform key → AE matchName (patch set_layer_transform / resetTransforms).
 * Inspect's broader sample set builds on isCoreTransformMatchName.
 */
function transformMatchName(key) {
  if (key === "anchorPoint") return "ADBE Anchor Point";
  if (key === "position") return "ADBE Position";
  if (key === "scale") return "ADBE Scale";
  if (key === "rotation") return "ADBE Rotate Z";
  if (key === "opacity") return "ADBE Opacity";
  return null;
}

/** Core 2D Transform leaf matchNames shared by patch + inspect. */
function isCoreTransformMatchName(matchName) {
  return (
    matchName === "ADBE Anchor Point" ||
    matchName === "ADBE Position" ||
    matchName === "ADBE Scale" ||
    matchName === "ADBE Rotate Z" ||
    matchName === "ADBE Opacity"
  );
}

function compSwitchKeys() {
  return [${COMP_SWITCH_KEYS_ES3}];
}

/** Composition Advanced-tab / panel switches; unread → false. */
function readCompSwitches(comp) {
  var switches = {
    ${readCompSwitchesDefaults}
  };
  ${readCompSwitchesReads}
  return switches;
}

/** Integer display-start frame; falls back to displayStartTime. */
function readDisplayStartFrame(comp, frameRate) {
  try {
    return Number(comp.displayStartFrame);
  } catch (e) {
    try {
      return timeToFrame(comp.displayStartTime, frameRate);
    } catch (e2) {
      return 0;
    }
  }
}
`.trim();
