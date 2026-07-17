import { SHARED_INSPECT_HELPERS } from "./inspect-script.js";
import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";
import type { GetLayerArgs, LayerInspectDetail } from "./types.js";

export type ResolvedGetLayerArgs = {
  compId: number | null;
  compName: string | null;
  layerId: number | null;
  layerName: string | null;
  detail: LayerInspectDetail;
  matchNames: string[] | null;
  atTime: number | null;
  preExpression: boolean;
};

/**
 * ExtendScript body for deep layer inspect. Expects `var __args = {...}` beforehand.
 */
const GET_LAYER_BODY = `
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

var comp = resolveComp(__args.compId, __args.compName);
var layer = resolveLayer(comp, __args.layerId, __args.layerName);

if (layer.id === undefined || layer.id === null) {
  throw new Error(
    "Layer.id is unavailable. After Effects 22 (2022) or newer is required for ae_get_layer."
  );
}

var detail = __args.detail || "overview";
var preExpression = __args.preExpression !== false;
var atTime = __args.atTime;
if (atTime === undefined || atTime === null) {
  atTime = comp.time;
}
var matchNames = __args.matchNames;

var inPoint = layer.inPoint;
var outPoint = layer.outPoint;
var layerPayload = {
  id: layer.id,
  index: layer.index,
  name: layer.name,
  type: layerType(layer),
  inPoint: inPoint,
  outPoint: outPoint,
  duration: outPoint - inPoint,
  stretch: layer.stretch,
  startTime: layer.startTime,
  motionBlur: motionBlurOf(layer),
  label: layer.label,
  hasEffects: hasEffects(layer),
  properties: walkLayerProperties(layer, detail, atTime, preExpression, matchNames)
};

try { layerPayload.enabled = !!layer.enabled; } catch (e) {}
try { layerPayload.solo = !!layer.solo; } catch (e) {}
try { layerPayload.shy = !!layer.shy; } catch (e) {}
try { layerPayload.locked = !!layer.locked; } catch (e) {}

try {
  if (layer.source) {
    var sourceRef = serializeSourceRef(layer.source);
    if (sourceRef) layerPayload.source = sourceRef;
  }
} catch (e) {}

return JSON.stringify({
  projectName: projectNameOf(),
  detail: detail,
  atTime: atTime,
  preExpression: preExpression,
  matchNames: matchNames,
  comp: {
    id: comp.id,
    name: comp.name,
    duration: comp.duration,
    frameRate: comp.frameRate,
    time: comp.time
  },
  layer: layerPayload
});
`.trim();

export function resolveGetLayerArgs(input: GetLayerArgs): ResolvedGetLayerArgs {
  const hasCompId = input.compId !== undefined;
  const hasCompName = input.compName !== undefined;
  if (hasCompId === hasCompName) {
    throw new Error("Provide exactly one of compId or compName");
  }
  const hasLayerId = input.layerId !== undefined;
  const hasLayerName = input.layerName !== undefined;
  if (hasLayerId === hasLayerName) {
    throw new Error("Provide exactly one of layerId or layerName");
  }
  const detail = input.detail ?? "overview";
  if (detail !== "overview" && detail !== "extended" && detail !== "full") {
    throw new Error('detail must be "overview", "extended", or "full"');
  }
  return {
    compId: hasCompId ? input.compId! : null,
    compName: hasCompName ? input.compName! : null,
    layerId: hasLayerId ? input.layerId! : null,
    layerName: hasLayerName ? input.layerName! : null,
    detail,
    matchNames: input.matchNames && input.matchNames.length > 0 ? input.matchNames : null,
    atTime: input.atTime !== undefined ? input.atTime : null,
    preExpression: input.preExpression !== undefined ? input.preExpression : true,
  };
}

export function buildGetLayerScript(input: GetLayerArgs): string {
  const args = resolveGetLayerArgs(input);
  return [
    SHARED_INVENTORY_HELPERS,
    SHARED_INSPECT_HELPERS,
    `var __args = ${JSON.stringify(args)};`,
    GET_LAYER_BODY,
  ].join("\n\n");
}
