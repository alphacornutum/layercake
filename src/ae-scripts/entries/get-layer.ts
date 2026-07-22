import { projectNameOf, serializeSourceRef } from "../shared/inventory";
import { resolveComp, resolveLayer } from "../shared/resolve";
import { inspectFail, walkLayerProperties } from "../shared/inspect";

declare const __args: any;

function layerType(layer: Layer): string {
  const value: any = layer;
  if (layer.nullLayer) return "null";
  if (layer instanceof CameraLayer) return "camera";
  if (layer instanceof LightLayer) return "light";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof ShapeLayer) return "shape";
  try {
    if (value.adjustmentLayer) return "adjustment";
  } catch (_e) {}
  try {
    if (value.guideLayer) return "guide";
  } catch (_e) {}
  return layer instanceof AVLayer ? "av" : "other";
}
function hasEffects(layer: Layer): boolean {
  try {
    const effects: any = layer.property("ADBE Effect Parade");
    return !!effects && effects.numProperties > 0;
  } catch (_e) {
    return false;
  }
}
function motionBlurOf(layer: Layer): boolean {
  try {
    return !!(layer as any).motionBlur;
  } catch (_e) {
    return false;
  }
}
export function main(): string {
  if (!app.project)
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  const comp = resolveComp(__args.compId, __args.compName, inspectFail);
  const layer = resolveLayer(comp, __args.layerId, __args.layerName, inspectFail);
  if (layer.id === undefined || layer.id === null)
    throw new Error(
      "Layer.id is unavailable. After Effects 22 (2022) or newer is required for ae_get_layer.",
    );
  const detail = __args.detail || "overview";
  const preExpression = __args.preExpression !== false;
  const atTime = __args.atTime === undefined || __args.atTime === null ? comp.time : __args.atTime;
  const payload: any = {
    id: layer.id,
    index: layer.index,
    name: layer.name,
    type: layerType(layer),
    inPoint: layer.inPoint,
    outPoint: layer.outPoint,
    duration: layer.outPoint - layer.inPoint,
    stretch: layer.stretch,
    startTime: layer.startTime,
    motionBlur: motionBlurOf(layer),
    label: layer.label,
    hasEffects: hasEffects(layer),
    properties: walkLayerProperties(layer, detail, atTime, preExpression, __args.matchNames),
  };
  try {
    payload.enabled = !!layer.enabled;
    payload.solo = !!layer.solo;
    payload.shy = !!layer.shy;
    payload.locked = !!layer.locked;
  } catch (_e) {}
  try {
    if ((layer as any).source) payload.source = serializeSourceRef((layer as any).source);
  } catch (_e) {}
  return JSON.stringify({
    projectName: projectNameOf(),
    detail,
    atTime,
    preExpression,
    matchNames: __args.matchNames,
    comp: {
      id: comp.id,
      name: comp.name,
      duration: comp.duration,
      frameRate: comp.frameRate,
      time: comp.time,
    },
    layer: payload,
  });
}
