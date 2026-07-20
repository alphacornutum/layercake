import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * ExtendScript that inventories all compositions and layers in the open project.
 * Returns a JSON string (filters are applied in TypeScript after eval).
 *
 * Relies on JSON.stringify from the extendscript-json polyfill injected by
 * wrapExtendScript (AE ExtendScript has no built-in JSON).
 */
const LIST_COMPS_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function layerType(layer) {
  if (layer.nullLayer) return "null";
  if (layer instanceof CameraLayer) return "camera";
  if (layer instanceof LightLayer) return "light";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof ShapeLayer) return "shape";
  try {
    if (layer.adjustmentLayer) return "adjustment";
  } catch (e) {}
  try {
    if (layer.guideLayer) return "guide";
  } catch (e) {}
  if (layer instanceof AVLayer) return "av";
  return "other";
}

function hasEffects(layer) {
  try {
    var effects = layer.property("ADBE Effect Parade");
    if (effects && effects.numProperties > 0) return true;
  } catch (e) {}
  return false;
}

function motionBlurOf(layer) {
  try {
    return !!layer.motionBlur;
  } catch (e) {
    return false;
  }
}

function trackMatteTypeName(t) {
  try {
    if (t === TrackMatteType.ALPHA) return "ALPHA";
    if (t === TrackMatteType.ALPHA_INVERTED) return "ALPHA_INVERTED";
    if (t === TrackMatteType.LUMA) return "LUMA";
    if (t === TrackMatteType.LUMA_INVERTED) return "LUMA_INVERTED";
    if (t === TrackMatteType.NO_TRACK_MATTE) return "NO_TRACK_MATTE";
  } catch (e) {}
  return String(t);
}

function serializeLayer(layer, frameRate) {
  if (layer.id === undefined || layer.id === null) {
    throw new Error(
      "Layer.id is unavailable. After Effects 22 (2022) or newer is required for ae_list_comps."
    );
  }
  var timing = layerTimingFrames(layer, frameRate);
  var payload = {
    id: layer.id,
    index: layer.index,
    name: layer.name,
    type: layerType(layer),
    inPoint: timing.inPoint,
    outPoint: timing.outPoint,
    duration: timing.outPoint - timing.inPoint,
    stretch: timing.stretch,
    startTime: timing.startTime,
    startFrame: timing.startFrame,
    inFrame: timing.inFrame,
    outFrame: timing.outFrame,
    durationFrames: timing.durationFrames,
    motionBlur: motionBlurOf(layer),
    label: layer.label,
    hasEffects: hasEffects(layer),
    enabled: true
  };
  try {
    payload.enabled = !!layer.enabled;
  } catch (e) {}
  try {
    if (layer.hasVideo !== undefined) {
      payload.hasVideo = !!layer.hasVideo;
      payload.videoEnabled = !!layer.videoEnabled;
    }
  } catch (e) {}
  try {
    if (layer.hasAudio !== undefined) {
      payload.hasAudio = !!layer.hasAudio;
      payload.audioEnabled = !!layer.audioEnabled;
    }
  } catch (e) {}
  try {
    payload.guideLayer = !!layer.guideLayer;
  } catch (e) {}
  try {
    payload.adjustmentLayer = !!layer.adjustmentLayer;
  } catch (e) {}
  try {
    payload.threeDLayer = !!layer.threeDLayer;
  } catch (e) {}
  try {
    payload.collapseTransformation = !!layer.collapseTransformation;
  } catch (e) {}
  try {
    payload.frameBlending = !!layer.frameBlending;
  } catch (e) {}
  try {
    payload.timeRemapEnabled = !!layer.timeRemapEnabled;
  } catch (e) {}
  try {
    if (layer.parent && layer.parent.id !== undefined && layer.parent.id !== null) {
      payload.parentLayerId = layer.parent.id;
    }
  } catch (e) {}
  try {
    if (layer.hasTrackMatte) {
      payload.trackMatteType = trackMatteTypeName(layer.trackMatteType);
      try {
        if (layer.trackMatteLayer && layer.trackMatteLayer.id !== undefined) {
          payload.trackMatteLayerId = layer.trackMatteLayer.id;
        }
      } catch (e2) {}
    }
  } catch (e) {}
  try {
    if (layer.source) {
      var sourceRef = serializeSourceRef(layer.source);
      if (sourceRef) payload.source = sourceRef;
    }
  } catch (e) {}
  return payload;
}

function serializeComp(comp) {
  var layers = [];
  var frameRate = comp.frameRate;
  for (var li = 1; li <= comp.numLayers; li++) {
    layers.push(serializeLayer(comp.layer(li), frameRate));
  }
  var renderer = "";
  try {
    renderer = String(comp.renderer || "");
  } catch (e) {}
  return {
    id: comp.id,
    name: comp.name,
    duration: comp.duration,
    frameRate: frameRate,
    width: comp.width,
    height: comp.height,
    pixelAspect: comp.pixelAspect,
    durationFrames: timeToFrame(comp.duration, frameRate),
    displayStartFrame: readDisplayStartFrame(comp, frameRate),
    workAreaStartFrame: timeToFrame(comp.workAreaStart, frameRate),
    workAreaDurationFrames: timeToFrame(comp.workAreaDuration, frameRate),
    renderer: renderer,
    switches: readCompSwitches(comp),
    numLayers: comp.numLayers,
    layers: layers
  };
}

var compositions = [];
var items = app.project.items;
for (var i = 1; i <= items.length; i++) {
  var item = items[i];
  if (item instanceof CompItem) {
    compositions.push(serializeComp(item));
  }
}

return JSON.stringify({
  projectName: projectNameOf(),
  compositions: compositions,
  missing: { compIds: [], compNames: [] }
});
`.trim();

export const LIST_COMPS_SCRIPT = `${SHARED_INVENTORY_HELPERS}\n\n${LIST_COMPS_BODY}`;
