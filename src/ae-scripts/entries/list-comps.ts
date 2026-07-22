import {
  layerTimingFrames,
  projectNameOf,
  readCompSwitches,
  readDisplayStartFrame,
  serializeSourceRef,
  timeToFrame,
} from "../shared/inventory";

function layerType(layer: Layer): string {
  const aeLayer = layer as any;
  if (layer.nullLayer) return "null";
  if (layer instanceof CameraLayer) return "camera";
  if (layer instanceof LightLayer) return "light";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof ShapeLayer) return "shape";
  try {
    if (aeLayer.adjustmentLayer) return "adjustment";
  } catch (_e) {}
  try {
    if (aeLayer.guideLayer) return "guide";
  } catch (_e) {}
  if (layer instanceof AVLayer) return "av";
  return "other";
}

function hasEffects(layer: Layer): boolean {
  try {
    const effects = layer.property("ADBE Effect Parade") as any;
    if (effects && effects.numProperties > 0) return true;
  } catch (_e) {}
  return false;
}

function motionBlurOf(layer: Layer): boolean {
  try {
    return !!(layer as any).motionBlur;
  } catch (_e) {
    return false;
  }
}

function trackMatteTypeName(type: TrackMatteType): string {
  try {
    if (type === TrackMatteType.ALPHA) return "ALPHA";
    if (type === TrackMatteType.ALPHA_INVERTED) return "ALPHA_INVERTED";
    if (type === TrackMatteType.LUMA) return "LUMA";
    if (type === TrackMatteType.LUMA_INVERTED) return "LUMA_INVERTED";
    if (type === TrackMatteType.NO_TRACK_MATTE) return "NO_TRACK_MATTE";
  } catch (_e) {}
  return String(type);
}

function serializeLayer(layer: Layer, frameRate: number): Record<string, unknown> {
  const aeLayer = layer as any;
  if (layer.id === undefined || layer.id === null) {
    throw new Error("Layer.id is unavailable. After Effects 24.6+ is required for ae_list_comps.");
  }
  const timing = layerTimingFrames(layer, frameRate);
  const payload: Record<string, unknown> = {
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
    enabled: true,
  };
  try {
    payload.enabled = !!layer.enabled;
  } catch (_e) {}
  try {
    if (layer.hasVideo !== undefined) {
      payload.hasVideo = !!layer.hasVideo;
      payload.videoEnabled = !!aeLayer.videoEnabled;
    }
  } catch (_e) {}
  try {
    if (aeLayer.hasAudio !== undefined) {
      payload.hasAudio = !!aeLayer.hasAudio;
      payload.audioEnabled = !!aeLayer.audioEnabled;
    }
  } catch (_e) {}
  try {
    payload.guideLayer = !!aeLayer.guideLayer;
  } catch (_e) {}
  try {
    payload.adjustmentLayer = !!aeLayer.adjustmentLayer;
  } catch (_e) {}
  try {
    payload.threeDLayer = !!aeLayer.threeDLayer;
  } catch (_e) {}
  try {
    payload.collapseTransformation = !!aeLayer.collapseTransformation;
  } catch (_e) {}
  try {
    payload.frameBlending = !!aeLayer.frameBlending;
  } catch (_e) {}
  try {
    payload.timeRemapEnabled = !!aeLayer.timeRemapEnabled;
  } catch (_e) {}
  try {
    if (layer.parent && layer.parent.id !== undefined && layer.parent.id !== null) {
      payload.parentLayerId = layer.parent.id;
    }
  } catch (_e) {}
  try {
    if (aeLayer.hasTrackMatte) {
      payload.trackMatteType = trackMatteTypeName(aeLayer.trackMatteType);
      try {
        if (aeLayer.trackMatteLayer && aeLayer.trackMatteLayer.id !== undefined) {
          payload.trackMatteLayerId = aeLayer.trackMatteLayer.id;
        }
      } catch (_e2) {}
    }
  } catch (_e) {}
  try {
    if (aeLayer.source) {
      const sourceRef = serializeSourceRef(aeLayer.source);
      if (sourceRef) payload.source = sourceRef;
    }
  } catch (_e) {}
  return payload;
}

function serializeComp(comp: CompItem): Record<string, unknown> {
  const layers: Record<string, unknown>[] = [];
  const frameRate = comp.frameRate;
  for (let layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
    layers.push(serializeLayer(comp.layer(layerIndex), frameRate));
  }
  let renderer = "";
  try {
    renderer = String(comp.renderer || "");
  } catch (_e) {}
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
    layers: layers,
  };
}

export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }

  const compositions: Record<string, unknown>[] = [];
  const items = app.project.items;
  for (let itemIndex = 1; itemIndex <= items.length; itemIndex++) {
    const item = items[itemIndex];
    if (item instanceof CompItem) {
      compositions.push(serializeComp(item));
    }
  }

  return JSON.stringify({
    projectName: projectNameOf(),
    compositions: compositions,
    missing: { compIds: [], compNames: [] },
  });
}
