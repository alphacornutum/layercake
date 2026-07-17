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

function serializeLayer(layer) {
  if (layer.id === undefined || layer.id === null) {
    throw new Error(
      "Layer.id is unavailable. After Effects 22 (2022) or newer is required for ae_list_comps."
    );
  }
  var inPoint = layer.inPoint;
  var outPoint = layer.outPoint;
  var payload = {
    id: layer.id,
    index: layer.index,
    name: layer.name,
    type: layerType(layer),
    inPoint: inPoint,
    outPoint: outPoint,
    duration: outPoint - inPoint,
    stretch: layer.stretch,
    motionBlur: motionBlurOf(layer),
    label: layer.label,
    hasEffects: hasEffects(layer)
  };
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
  for (var li = 1; li <= comp.numLayers; li++) {
    layers.push(serializeLayer(comp.layer(li)));
  }
  return {
    id: comp.id,
    name: comp.name,
    duration: comp.duration,
    frameRate: comp.frameRate,
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
