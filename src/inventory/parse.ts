import { COMP_SWITCH_KEYS, type CompSwitchesSnapshot } from "./comp-switches.js";
import type {
  CompInventory,
  FolderInventory,
  FolderTreeLeaf,
  FolderTreeNode,
  FootageKind,
  InspectKeyframe,
  InspectLookupErrorPayload,
  InspectPropertyNode,
  InventoryComposition,
  InventoryLayer,
  InventorySource,
  InventorySourceRef,
  ItemRefEntry,
  ItemRefKind,
  ItemRefsResult,
  LayerInspectDetail,
  LayerInspectLayer,
  LayerInspectResult,
  LayerType,
  ProjectContext,
  ProjectSummary,
  ProjectSummaryMissingFootage,
  SourceInspectDetail,
  SourceInspectResult,
  SourceInventory,
  SourceRefType,
} from "./types.js";
import { classifyEffectOrigin } from "./effect-origin.js";
import { buildFingerprint } from "./fingerprint.js";

const LAYER_TYPES = new Set<LayerType>([
  "av",
  "text",
  "shape",
  "camera",
  "light",
  "null",
  "adjustment",
  "guide",
  "other",
]);

const FOOTAGE_KINDS = new Set<FootageKind>(["file", "solid", "placeholder"]);
const SOURCE_REF_TYPES = new Set<SourceRefType>(["footage", "comp"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid inventory: ${field} must be a finite number`);
  }
  return value;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid inventory: ${field} must be a string`);
  }
  return value;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid inventory: ${field} must be a boolean`);
  }
  return value;
}

function assertFootageKind(value: unknown, field: string): FootageKind {
  const kind = assertString(value, field) as FootageKind;
  if (!FOOTAGE_KINDS.has(kind)) {
    throw new Error(`Invalid inventory: ${field} is not a known footageKind`);
  }
  return kind;
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return assertString(value, field);
}

function parseSolidColor(value: unknown, field: string): [number, number, number] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Invalid inventory: ${field} must be null or an [R,G,B] array`);
  }
  return [
    assertNumber(value[0], `${field}[0]`),
    assertNumber(value[1], `${field}[1]`),
    assertNumber(value[2], `${field}[2]`),
  ];
}

function parseSourceRef(raw: unknown, path: string): InventorySourceRef {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  const type = assertString(raw.type, `${path}.type`) as SourceRefType;
  if (!SOURCE_REF_TYPES.has(type)) {
    throw new Error(`Invalid inventory: ${path}.type is not a known source type`);
  }
  const ref: InventorySourceRef = {
    id: assertNumber(raw.id, `${path}.id`),
    name: assertString(raw.name, `${path}.name`),
    type,
    parentFolderId: assertNumber(raw.parentFolderId, `${path}.parentFolderId`),
    folderPath: assertString(raw.folderPath, `${path}.folderPath`),
  };
  if (type === "footage") {
    ref.footageKind = assertFootageKind(raw.footageKind, `${path}.footageKind`);
  }
  return ref;
}

function parseLayer(raw: unknown, path: string): InventoryLayer {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  const type = assertString(raw.type, `${path}.type`) as LayerType;
  if (!LAYER_TYPES.has(type)) {
    throw new Error(`Invalid inventory: ${path}.type is not a known layer type`);
  }
  const layer: InventoryLayer = {
    id: assertNumber(raw.id, `${path}.id`),
    index: assertNumber(raw.index, `${path}.index`),
    name: assertString(raw.name, `${path}.name`),
    type,
    inPoint: assertNumber(raw.inPoint, `${path}.inPoint`),
    outPoint: assertNumber(raw.outPoint, `${path}.outPoint`),
    duration: assertNumber(raw.duration, `${path}.duration`),
    stretch: assertNumber(raw.stretch, `${path}.stretch`),
    startTime: assertNumber(raw.startTime, `${path}.startTime`),
    startFrame: assertNumber(raw.startFrame, `${path}.startFrame`),
    inFrame: assertNumber(raw.inFrame, `${path}.inFrame`),
    outFrame: assertNumber(raw.outFrame, `${path}.outFrame`),
    durationFrames: assertNumber(raw.durationFrames, `${path}.durationFrames`),
    motionBlur: assertBoolean(raw.motionBlur, `${path}.motionBlur`),
    label: assertNumber(raw.label, `${path}.label`),
    hasEffects: assertBoolean(raw.hasEffects, `${path}.hasEffects`),
    enabled: assertBoolean(raw.enabled, `${path}.enabled`),
  };
  if (raw.hasVideo !== undefined) {
    layer.hasVideo = assertBoolean(raw.hasVideo, `${path}.hasVideo`);
  }
  if (raw.videoEnabled !== undefined) {
    layer.videoEnabled = assertBoolean(raw.videoEnabled, `${path}.videoEnabled`);
  }
  if (raw.hasAudio !== undefined) {
    layer.hasAudio = assertBoolean(raw.hasAudio, `${path}.hasAudio`);
  }
  if (raw.audioEnabled !== undefined) {
    layer.audioEnabled = assertBoolean(raw.audioEnabled, `${path}.audioEnabled`);
  }
  if (raw.guideLayer !== undefined) {
    layer.guideLayer = assertBoolean(raw.guideLayer, `${path}.guideLayer`);
  }
  if (raw.adjustmentLayer !== undefined) {
    layer.adjustmentLayer = assertBoolean(raw.adjustmentLayer, `${path}.adjustmentLayer`);
  }
  if (raw.threeDLayer !== undefined) {
    layer.threeDLayer = assertBoolean(raw.threeDLayer, `${path}.threeDLayer`);
  }
  if (raw.collapseTransformation !== undefined) {
    layer.collapseTransformation = assertBoolean(
      raw.collapseTransformation,
      `${path}.collapseTransformation`,
    );
  }
  if (raw.frameBlending !== undefined) {
    layer.frameBlending = assertBoolean(raw.frameBlending, `${path}.frameBlending`);
  }
  if (raw.timeRemapEnabled !== undefined) {
    layer.timeRemapEnabled = assertBoolean(raw.timeRemapEnabled, `${path}.timeRemapEnabled`);
  }
  if (raw.parentLayerId !== undefined && raw.parentLayerId !== null) {
    layer.parentLayerId = assertNumber(raw.parentLayerId, `${path}.parentLayerId`);
  } else if (raw.parentLayerId === null) {
    layer.parentLayerId = null;
  }
  if (raw.trackMatteType !== undefined && raw.trackMatteType !== null) {
    layer.trackMatteType = assertString(raw.trackMatteType, `${path}.trackMatteType`);
  } else if (raw.trackMatteType === null) {
    layer.trackMatteType = null;
  }
  if (raw.trackMatteLayerId !== undefined && raw.trackMatteLayerId !== null) {
    layer.trackMatteLayerId = assertNumber(raw.trackMatteLayerId, `${path}.trackMatteLayerId`);
  } else if (raw.trackMatteLayerId === null) {
    layer.trackMatteLayerId = null;
  }
  if (raw.source !== undefined) {
    layer.source = parseSourceRef(raw.source, `${path}.source`);
  }
  return layer;
}

function parseCompSwitches(raw: unknown, path: string): CompSwitchesSnapshot {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  const switches = {} as CompSwitchesSnapshot;
  for (const key of COMP_SWITCH_KEYS) {
    switches[key] = assertBoolean(raw[key], `${path}.${key}`);
  }
  return switches;
}

function parseComposition(raw: unknown, path: string): InventoryComposition {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  if (!Array.isArray(raw.layers)) {
    throw new Error(`Invalid inventory: ${path}.layers must be an array`);
  }
  return {
    id: assertNumber(raw.id, `${path}.id`),
    name: assertString(raw.name, `${path}.name`),
    duration: assertNumber(raw.duration, `${path}.duration`),
    frameRate: assertNumber(raw.frameRate, `${path}.frameRate`),
    width: assertNumber(raw.width, `${path}.width`),
    height: assertNumber(raw.height, `${path}.height`),
    pixelAspect: assertNumber(raw.pixelAspect, `${path}.pixelAspect`),
    durationFrames: assertNumber(raw.durationFrames, `${path}.durationFrames`),
    displayStartFrame: assertNumber(raw.displayStartFrame, `${path}.displayStartFrame`),
    workAreaStartFrame: assertNumber(raw.workAreaStartFrame, `${path}.workAreaStartFrame`),
    workAreaDurationFrames: assertNumber(
      raw.workAreaDurationFrames,
      `${path}.workAreaDurationFrames`,
    ),
    renderer: assertString(raw.renderer ?? "", `${path}.renderer`),
    switches: parseCompSwitches(raw.switches, `${path}.switches`),
    numLayers: assertNumber(raw.numLayers, `${path}.numLayers`),
    layers: raw.layers.map((layer, i) => parseLayer(layer, `${path}.layers[${i}]`)),
  };
}

/** Parse and validate the JSON payload returned by the inventory ExtendScript. */
export function parseCompInventory(raw: string): CompInventory {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid inventory: result is not valid JSON`);
  }
  if (!isRecord(data)) {
    throw new Error("Invalid inventory: root must be an object");
  }
  if (!Array.isArray(data.compositions)) {
    throw new Error("Invalid inventory: compositions must be an array");
  }

  const missingRaw = isRecord(data.missing) ? data.missing : { compIds: [], compNames: [] };
  const missingIds = Array.isArray(missingRaw.compIds) ? missingRaw.compIds : [];
  const missingNames = Array.isArray(missingRaw.compNames) ? missingRaw.compNames : [];

  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    compositions: data.compositions.map((comp, i) => parseComposition(comp, `compositions[${i}]`)),
    missing: {
      compIds: missingIds.map((id, i) => assertNumber(id, `missing.compIds[${i}]`)),
      compNames: missingNames.map((name, i) => assertString(name, `missing.compNames[${i}]`)),
    },
  };
}

function parseSource(raw: unknown, path: string): InventorySource {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  if (!Array.isArray(raw.usedInCompIds)) {
    throw new Error(`Invalid inventory: ${path}.usedInCompIds must be an array`);
  }
  return {
    id: assertNumber(raw.id, `${path}.id`),
    name: assertString(raw.name, `${path}.name`),
    label: assertNumber(raw.label, `${path}.label`),
    comment: assertString(raw.comment, `${path}.comment`),
    footageKind: assertFootageKind(raw.footageKind, `${path}.footageKind`),
    width: assertNumber(raw.width, `${path}.width`),
    height: assertNumber(raw.height, `${path}.height`),
    pixelAspect: assertNumber(raw.pixelAspect, `${path}.pixelAspect`),
    frameRate: assertNumber(raw.frameRate, `${path}.frameRate`),
    duration: assertNumber(raw.duration, `${path}.duration`),
    hasVideo: assertBoolean(raw.hasVideo, `${path}.hasVideo`),
    hasAudio: assertBoolean(raw.hasAudio, `${path}.hasAudio`),
    footageMissing: assertBoolean(raw.footageMissing, `${path}.footageMissing`),
    isStill: assertBoolean(raw.isStill, `${path}.isStill`),
    useProxy: assertBoolean(raw.useProxy, `${path}.useProxy`),
    file: parseNullableString(raw.file, `${path}.file`),
    missingFootagePath: parseNullableString(raw.missingFootagePath, `${path}.missingFootagePath`),
    solidColor: parseSolidColor(raw.solidColor, `${path}.solidColor`),
    parentFolderId: assertNumber(raw.parentFolderId, `${path}.parentFolderId`),
    folderPath: assertString(raw.folderPath, `${path}.folderPath`),
    usedInCompIds: raw.usedInCompIds.map((id, i) =>
      assertNumber(id, `${path}.usedInCompIds[${i}]`),
    ),
  };
}

/** Parse and validate the JSON payload returned by the sources ExtendScript. */
export function parseSourceInventory(raw: string): SourceInventory {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid inventory: result is not valid JSON`);
  }
  if (!isRecord(data)) {
    throw new Error("Invalid inventory: root must be an object");
  }
  if (!Array.isArray(data.sources)) {
    throw new Error("Invalid inventory: sources must be an array");
  }
  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    sources: data.sources.map((source, i) => parseSource(source, `sources[${i}]`)),
  };
}

function parseFolderLeaf(raw: Record<string, unknown>, path: string): FolderTreeLeaf {
  const type = assertString(raw.type, `${path}.type`);
  if (type === "comp") {
    return {
      id: assertNumber(raw.id, `${path}.id`),
      name: assertString(raw.name, `${path}.name`),
      type: "comp",
    };
  }
  if (type === "footage") {
    return {
      id: assertNumber(raw.id, `${path}.id`),
      name: assertString(raw.name, `${path}.name`),
      type: "footage",
      footageKind: assertFootageKind(raw.footageKind, `${path}.footageKind`),
    };
  }
  throw new Error(`Invalid inventory: ${path}.type must be folder, footage, or comp`);
}

function parseFolderNode(raw: unknown, path: string): FolderTreeNode {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inventory: ${path} must be an object`);
  }
  const type = assertString(raw.type, `${path}.type`);
  if (type !== "folder") {
    throw new Error(`Invalid inventory: ${path}.type must be "folder"`);
  }
  if (!Array.isArray(raw.children)) {
    throw new Error(`Invalid inventory: ${path}.children must be an array`);
  }
  return {
    id: assertNumber(raw.id, `${path}.id`),
    name: assertString(raw.name, `${path}.name`),
    type: "folder",
    children: raw.children.map((child, i) => {
      const childPath = `${path}.children[${i}]`;
      if (!isRecord(child)) {
        throw new Error(`Invalid inventory: ${childPath} must be an object`);
      }
      const childType = assertString(child.type, `${childPath}.type`);
      if (childType === "folder") {
        return parseFolderNode(child, childPath);
      }
      return parseFolderLeaf(child, childPath);
    }),
  };
}

/** Parse and validate the JSON payload returned by the folders ExtendScript. */
export function parseFolderInventory(raw: string): FolderInventory {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid inventory: result is not valid JSON`);
  }
  if (!isRecord(data)) {
    throw new Error("Invalid inventory: root must be an object");
  }
  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    root: parseFolderNode(data.root, "root"),
  };
}

const LAYER_DETAILS = new Set<LayerInspectDetail>(["overview", "extended", "full"]);
const SOURCE_DETAILS = new Set<SourceInspectDetail>(["overview", "full"]);

/** Rewrite AFX_INSPECT:* ExtendScript errors into readable messages with candidates. */
export function formatInspectScriptError(error: string): string {
  const prefix = "AFX_INSPECT:";
  if (!error.startsWith(prefix)) {
    return error;
  }
  try {
    const payload = JSON.parse(error.slice(prefix.length)) as InspectLookupErrorPayload;
    if (!payload || typeof payload.message !== "string") {
      return error;
    }
    if (payload.candidates && payload.candidates.length > 0) {
      return `${payload.message}: ${JSON.stringify(payload.candidates)}`;
    }
    return payload.message;
  } catch {
    return error;
  }
}

function parseInspectPropertyNode(raw: unknown, path: string): InspectPropertyNode {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inspect: ${path} must be an object`);
  }
  const isGroup = assertBoolean(raw.isGroup, `${path}.isGroup`);
  const node: InspectPropertyNode = {
    name: assertString(raw.name, `${path}.name`),
    matchName: assertString(raw.matchName, `${path}.matchName`),
    propertyIndex: assertNumber(raw.propertyIndex, `${path}.propertyIndex`),
    isGroup,
  };
  if (raw.enabled !== undefined) {
    node.enabled = assertBoolean(raw.enabled, `${path}.enabled`);
  }
  if (raw.active !== undefined) {
    node.active = assertBoolean(raw.active, `${path}.active`);
  }
  if (isGroup) {
    if (!Array.isArray(raw.properties)) {
      throw new Error(`Invalid inspect: ${path}.properties must be an array`);
    }
    node.properties = raw.properties.map((child, i) =>
      parseInspectPropertyNode(child, `${path}.properties[${i}]`),
    );
    return node;
  }
  if (raw.propertyValueType !== undefined) {
    node.propertyValueType = assertString(raw.propertyValueType, `${path}.propertyValueType`);
  }
  if (raw.numKeys !== undefined) {
    node.numKeys = assertNumber(raw.numKeys, `${path}.numKeys`);
  }
  if (raw.hasExpression !== undefined) {
    node.hasExpression = assertBoolean(raw.hasExpression, `${path}.hasExpression`);
  }
  if (raw.expressionEnabled !== undefined) {
    node.expressionEnabled = assertBoolean(raw.expressionEnabled, `${path}.expressionEnabled`);
  }
  if (raw.expression !== undefined) {
    node.expression = assertString(raw.expression, `${path}.expression`);
  }
  if (raw.value !== undefined) {
    node.value = raw.value;
  }
  if (raw.authoredValue !== undefined) {
    node.authoredValue = raw.authoredValue;
  }
  if (raw.evaluatedValue !== undefined) {
    node.evaluatedValue = raw.evaluatedValue;
  }
  if (raw.keyframes !== undefined) {
    if (!Array.isArray(raw.keyframes)) {
      throw new Error(`Invalid inspect: ${path}.keyframes must be an array`);
    }
    node.keyframes = raw.keyframes.map((key, i) =>
      parseInspectKeyframe(key, `${path}.keyframes[${i}]`),
    );
  }
  return node;
}

function parseInspectKeyframe(raw: unknown, path: string): InspectKeyframe {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inspect: ${path} must be an object`);
  }
  const key: InspectKeyframe = {
    time: assertNumber(raw.time, `${path}.time`),
    value: raw.value,
  };
  if (raw.inInterpolationType !== undefined) {
    key.inInterpolationType = assertString(raw.inInterpolationType, `${path}.inInterpolationType`);
  }
  if (raw.outInterpolationType !== undefined) {
    key.outInterpolationType = assertString(
      raw.outInterpolationType,
      `${path}.outInterpolationType`,
    );
  }
  if (raw.inEase !== undefined) {
    key.inEase = raw.inEase as InspectKeyframe["inEase"];
  }
  if (raw.outEase !== undefined) {
    key.outEase = raw.outEase as InspectKeyframe["outEase"];
  }
  if (raw.inSpatialTangent !== undefined) {
    key.inSpatialTangent = raw.inSpatialTangent as number[];
  }
  if (raw.outSpatialTangent !== undefined) {
    key.outSpatialTangent = raw.outSpatialTangent as number[];
  }
  return key;
}

function parseLayerInspectLayer(raw: unknown, path: string): LayerInspectLayer {
  if (!isRecord(raw)) {
    throw new Error(`Invalid inspect: ${path} must be an object`);
  }
  if (!Array.isArray(raw.properties)) {
    throw new Error(`Invalid inspect: ${path}.properties must be an array`);
  }
  const type = assertString(raw.type, `${path}.type`) as LayerType;
  if (!LAYER_TYPES.has(type)) {
    throw new Error(`Invalid inspect: ${path}.type is not a known layer type`);
  }
  const layer: LayerInspectLayer = {
    id: assertNumber(raw.id, `${path}.id`),
    index: assertNumber(raw.index, `${path}.index`),
    name: assertString(raw.name, `${path}.name`),
    type,
    inPoint: assertNumber(raw.inPoint, `${path}.inPoint`),
    outPoint: assertNumber(raw.outPoint, `${path}.outPoint`),
    duration: assertNumber(raw.duration, `${path}.duration`),
    stretch: assertNumber(raw.stretch, `${path}.stretch`),
    startTime: assertNumber(raw.startTime, `${path}.startTime`),
    motionBlur: assertBoolean(raw.motionBlur, `${path}.motionBlur`),
    label: assertNumber(raw.label, `${path}.label`),
    hasEffects: assertBoolean(raw.hasEffects, `${path}.hasEffects`),
    properties: raw.properties.map((prop, i) =>
      parseInspectPropertyNode(prop, `${path}.properties[${i}]`),
    ),
  };
  if (raw.enabled !== undefined) layer.enabled = assertBoolean(raw.enabled, `${path}.enabled`);
  if (raw.solo !== undefined) layer.solo = assertBoolean(raw.solo, `${path}.solo`);
  if (raw.shy !== undefined) layer.shy = assertBoolean(raw.shy, `${path}.shy`);
  if (raw.locked !== undefined) layer.locked = assertBoolean(raw.locked, `${path}.locked`);
  if (raw.source !== undefined) {
    layer.source = parseSourceRef(raw.source, `${path}.source`);
  }
  return layer;
}

/** Parse and validate the JSON payload returned by ae_get_layer. */
export function parseLayerInspect(raw: string): LayerInspectResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid inspect: result is not valid JSON");
  }
  if (!isRecord(data)) {
    throw new Error("Invalid inspect: root must be an object");
  }
  if (!isRecord(data.comp)) {
    throw new Error("Invalid inspect: comp must be an object");
  }
  const detail = assertString(data.detail, "detail") as LayerInspectDetail;
  if (!LAYER_DETAILS.has(detail)) {
    throw new Error('Invalid inspect: detail must be "overview", "extended", or "full"');
  }
  let matchNames: string[] | null = null;
  if (data.matchNames !== null && data.matchNames !== undefined) {
    if (!Array.isArray(data.matchNames)) {
      throw new Error("Invalid inspect: matchNames must be an array or null");
    }
    matchNames = data.matchNames.map((name, i) => assertString(name, `matchNames[${i}]`));
  }
  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    detail,
    atTime: assertNumber(data.atTime, "atTime"),
    preExpression: assertBoolean(data.preExpression, "preExpression"),
    matchNames,
    comp: {
      id: assertNumber(data.comp.id, "comp.id"),
      name: assertString(data.comp.name, "comp.name"),
      duration: assertNumber(data.comp.duration, "comp.duration"),
      frameRate: assertNumber(data.comp.frameRate, "comp.frameRate"),
      time: assertNumber(data.comp.time, "comp.time"),
    },
    layer: parseLayerInspectLayer(data.layer, "layer"),
  };
}

/** Parse and validate the JSON payload returned by ae_get_source. */
export function parseSourceInspect(raw: string): SourceInspectResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid inspect: result is not valid JSON");
  }
  if (!isRecord(data)) {
    throw new Error("Invalid inspect: root must be an object");
  }
  const detail = assertString(data.detail, "detail") as SourceInspectDetail;
  if (!SOURCE_DETAILS.has(detail)) {
    throw new Error('Invalid inspect: detail must be "overview" or "full"');
  }
  if (!isRecord(data.source)) {
    throw new Error("Invalid inspect: source must be an object");
  }
  const base = parseSource(data.source, "source");
  const source: SourceInspectResult["source"] = { ...base };
  if (data.source.interpret !== undefined) {
    if (!isRecord(data.source.interpret)) {
      throw new Error("Invalid inspect: source.interpret must be an object");
    }
    source.interpret = data.source.interpret as SourceInspectResult["source"]["interpret"];
  }
  if (data.source.mainSource !== undefined) {
    if (!isRecord(data.source.mainSource)) {
      throw new Error("Invalid inspect: source.mainSource must be an object");
    }
    source.mainSource = data.source.mainSource as SourceInspectResult["source"]["mainSource"];
  }
  if (data.source.proxySource !== undefined) {
    source.proxySource =
      data.source.proxySource === null
        ? null
        : (data.source.proxySource as SourceInspectResult["source"]["proxySource"]);
  }
  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    detail,
    source,
  };
}

function parseMissingFootage(raw: unknown, path: string): ProjectSummaryMissingFootage {
  if (!isRecord(raw)) {
    throw new Error(`Invalid summary: ${path} must be an object`);
  }
  return {
    id: assertNumber(raw.id, `${path}.id`),
    name: assertString(raw.name, `${path}.name`),
    missingFootagePath: parseNullableString(raw.missingFootagePath, `${path}.missingFootagePath`),
  };
}

/**
 * Parse + classify host JSON from the project-summary ExtendScript.
 * Applies first-party allowlist classification for each effect matchName.
 */
export function parseProjectSummary(json: string): ProjectSummary {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Invalid summary: result is not valid JSON");
  }
  if (!isRecord(data)) {
    throw new Error("Invalid summary: root must be an object");
  }
  if (!Array.isArray(data.effects)) {
    throw new Error("Invalid summary: effects must be an array");
  }
  if (!Array.isArray(data.missingFootage)) {
    throw new Error("Invalid summary: missingFootage must be an array");
  }
  if (!Array.isArray(data.missingOrSubstitutedFonts)) {
    throw new Error("Invalid summary: missingOrSubstitutedFonts must be an array");
  }

  const effects = data.effects.map((raw, i) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid summary: effects[${i}] must be an object`);
    }
    const matchName = assertString(raw.matchName, `effects[${i}].matchName`);
    return {
      matchName,
      displayName: assertString(raw.displayName, `effects[${i}].displayName`),
      origin: classifyEffectOrigin(matchName),
      available: assertBoolean(raw.available, `effects[${i}].available`),
      instanceCount: assertNumber(raw.instanceCount, `effects[${i}].instanceCount`),
    };
  });

  const hasThirdPartyEffects = effects.some((e) => e.origin === "thirdParty");
  const missingFootage = data.missingFootage.map((raw, i) =>
    parseMissingFootage(raw, `missingFootage[${i}]`),
  );
  const missingFootageCount = assertNumber(data.missingFootageCount, "missingFootageCount");
  if (missingFootageCount !== missingFootage.length) {
    throw new Error(
      `Invalid summary: missingFootageCount (${missingFootageCount}) !== missingFootage.length (${missingFootage.length})`,
    );
  }

  return {
    projectName: assertString(data.projectName ?? "", "projectName"),
    projectPath: parseNullableString(data.projectPath, "projectPath"),
    aeVersion: assertString(data.aeVersion, "aeVersion"),
    numComps: assertNumber(data.numComps, "numComps"),
    numFootage: assertNumber(data.numFootage, "numFootage"),
    numFolders: assertNumber(data.numFolders, "numFolders"),
    numLayers: assertNumber(data.numLayers, "numLayers"),
    bitsPerChannel: assertNumber(data.bitsPerChannel, "bitsPerChannel"),
    timeDisplayType: assertString(data.timeDisplayType, "timeDisplayType"),
    hasThirdPartyEffects,
    effects,
    missingFootageCount,
    missingFootage,
    fontsApiAvailable: assertBoolean(data.fontsApiAvailable, "fontsApiAvailable"),
    missingOrSubstitutedFonts: data.missingOrSubstitutedFonts.map((name, i) =>
      assertString(name, `missingOrSubstitutedFonts[${i}]`),
    ),
  };
}

const DIRTY_WARNING =
  "Project has unsaved changes; live state may differ from the last saved file on disk.";

/** Parse lean host JSON from the project-context ExtendScript and attach fingerprint. */
export function parseProjectContext(json: string): ProjectContext {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Invalid context: result is not valid JSON");
  }
  if (!isRecord(data)) {
    throw new Error("Invalid context: root must be an object");
  }

  const projectPath = parseNullableString(data.projectPath, "projectPath");
  const dirty = assertBoolean(data.dirty, "dirty");
  const revision = assertNumber(data.revision, "revision");
  if (!Number.isInteger(revision)) {
    throw new Error("Invalid context: revision must be an integer");
  }

  const context: ProjectContext = {
    projectName: assertString(data.projectName ?? "", "projectName"),
    projectPath,
    dirty,
    revision,
    fingerprint: buildFingerprint(revision, dirty, projectPath),
    aeVersion: assertString(data.aeVersion, "aeVersion"),
  };
  if (dirty) {
    context.warning = DIRTY_WARNING;
  }
  return context;
}

const ITEM_REF_KINDS = new Set<ItemRefKind>([
  "used_in_comp",
  "layer_source",
  "proxy_for",
  "has_proxy",
  "track_matte",
  "parent_link",
  "expression_mention",
]);

const ITEM_REF_TYPES = new Set(["folder", "comp", "footage", "item"]);

function parseItemRefEntry(raw: unknown, path: string): ItemRefEntry {
  if (!isRecord(raw)) {
    throw new Error(`Invalid item refs: ${path} must be an object`);
  }
  const kind = assertString(raw.kind, `${path}.kind`) as ItemRefKind;
  if (!ITEM_REF_KINDS.has(kind)) {
    throw new Error(`Invalid item refs: ${path}.kind is not a known ref kind`);
  }
  const entry: ItemRefEntry = { kind };
  if (raw.compId !== undefined) entry.compId = assertNumber(raw.compId, `${path}.compId`);
  if (raw.compName !== undefined) entry.compName = assertString(raw.compName, `${path}.compName`);
  if (raw.layerId !== undefined) entry.layerId = assertNumber(raw.layerId, `${path}.layerId`);
  if (raw.layerName !== undefined) {
    entry.layerName = assertString(raw.layerName, `${path}.layerName`);
  }
  if (raw.itemId !== undefined) entry.itemId = assertNumber(raw.itemId, `${path}.itemId`);
  if (raw.proxyItemId !== undefined) {
    entry.proxyItemId = assertNumber(raw.proxyItemId, `${path}.proxyItemId`);
  }
  if (raw.matteLayerId !== undefined) {
    entry.matteLayerId = assertNumber(raw.matteLayerId, `${path}.matteLayerId`);
  }
  if (raw.parentLayerId !== undefined) {
    entry.parentLayerId = assertNumber(raw.parentLayerId, `${path}.parentLayerId`);
  }
  if (raw.propertyPath !== undefined) {
    entry.propertyPath = assertString(raw.propertyPath, `${path}.propertyPath`);
  }
  if (raw.confidence !== undefined) {
    const c = assertString(raw.confidence, `${path}.confidence`);
    if (c !== "heuristic") {
      throw new Error(`Invalid item refs: ${path}.confidence must be "heuristic"`);
    }
    entry.confidence = "heuristic";
  }
  return entry;
}

/** Parse and validate the JSON payload from `ae_get_item_refs`. */
export function parseItemRefs(raw: string): ItemRefsResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid item refs: result is not valid JSON");
  }
  if (!isRecord(data)) {
    throw new Error("Invalid item refs: root must be an object");
  }
  if (!isRecord(data.item)) {
    throw new Error("Invalid item refs: item must be an object");
  }
  if (!Array.isArray(data.refs)) {
    throw new Error("Invalid item refs: refs must be an array");
  }
  if (!Array.isArray(data.incompleteReasons)) {
    throw new Error("Invalid item refs: incompleteReasons must be an array");
  }
  const type = assertString(data.item.type, "item.type");
  if (!ITEM_REF_TYPES.has(type)) {
    throw new Error("Invalid item refs: item.type is not a known type");
  }
  // Facts only — never accept a deletionCandidate policy bit from the host.
  if ("deletionCandidate" in data) {
    throw new Error("Invalid item refs: deletionCandidate is not allowed");
  }
  return {
    item: {
      id: assertNumber(data.item.id, "item.id"),
      name: assertString(data.item.name, "item.name"),
      type: type as ItemRefsResult["item"]["type"],
    },
    refs: data.refs.map((ref, i) => parseItemRefEntry(ref, `refs[${i}]`)),
    unknownRefsPossible: assertBoolean(data.unknownRefsPossible, "unknownRefsPossible"),
    incompleteReasons: data.incompleteReasons.map((r, i) =>
      assertString(r, `incompleteReasons[${i}]`),
    ),
  };
}
