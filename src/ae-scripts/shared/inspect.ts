import { isCoreTransformMatchName } from "./inventory";
import { projectTextDocument } from "./text-document";

export function inspectFail(code: string, message: string, candidates?: object[] | null): never {
  const payload: any = { code, message };
  if (candidates) payload.candidates = candidates;
  throw new Error("AFX_INSPECT:" + JSON.stringify(payload));
}

export const resolveFail = inspectFail;

function enumName(value: any, options: any, names: string[]): string {
  for (let i = 0; i < names.length; i++) if (value === options[names[i]]) return names[i];
  return String(value);
}
export function propertyValueTypeName(value: any): string {
  return enumName(value, PropertyValueType as any, [
    "NO_VALUE",
    "ThreeD_SPATIAL",
    "ThreeD",
    "TwoD_SPATIAL",
    "TwoD",
    "OneD",
    "COLOR",
    "CUSTOM_VALUE",
    "MARKER",
    "LAYER_INDEX",
    "MASK_INDEX",
    "SHAPE",
    "TEXT_DOCUMENT",
  ]);
}
function interpolationTypeName(value: any): string {
  return enumName(value, KeyframeInterpolationType as any, ["LINEAR", "BEZIER", "HOLD"]);
}
function serializableValueType(value: any): boolean {
  const types: any = PropertyValueType;
  return (
    value === types.OneD ||
    value === types.TwoD ||
    value === types.TwoD_SPATIAL ||
    value === types.ThreeD ||
    value === types.ThreeD_SPATIAL ||
    value === types.COLOR ||
    value === types.LAYER_INDEX ||
    value === types.MASK_INDEX
  );
}
export function serializeAeValue(value: any, propertyValueType: any): any {
  if (propertyValueType === (PropertyValueType as any).TEXT_DOCUMENT)
    return projectTextDocument(value);
  if (!serializableValueType(propertyValueType)) {
    return { unserializable: true, propertyValueType: propertyValueTypeName(propertyValueType) };
  }
  const types: any = PropertyValueType;
  if (
    propertyValueType === types.OneD ||
    propertyValueType === types.LAYER_INDEX ||
    propertyValueType === types.MASK_INDEX
  )
    return value;
  if (value && typeof value === "object" && value.length !== undefined) {
    const result: any[] = [];
    for (let i = 0; i < value.length; i++) result.push(value[i]);
    return result;
  }
  return value;
}
function serializeEaseArray(values: any): any[] | undefined {
  if (!values) return undefined;
  const result: any[] = [];
  for (let i = 0; i < values.length; i++)
    result.push({ speed: values[i].speed, influence: values[i].influence });
  return result;
}
function samplePropertyValue(prop: any, atTime: number, preExpression: boolean): any {
  const type = prop.propertyValueType;
  if (type === (PropertyValueType as any).NO_VALUE)
    return { unserializable: true, propertyValueType: "NO_VALUE" };
  try {
    return serializeAeValue(
      prop.canVaryOverTime || (prop.expression && String(prop.expression).length)
        ? prop.valueAtTime(atTime, preExpression)
        : prop.value,
      type,
    );
  } catch (_e) {
    return { unserializable: true, propertyValueType: propertyValueTypeName(type) };
  }
}
function serializeKeyframes(prop: any, detail: string): any[] {
  const result: any[] = [];
  for (let index = 1; index <= prop.numKeys; index++) {
    const entry: any = {
      time: prop.keyTime(index),
      value: serializeAeValue(prop.keyValue(index), prop.propertyValueType),
    };
    try {
      entry.inInterpolationType = interpolationTypeName(prop.keyInInterpolationType(index));
      entry.outInterpolationType = interpolationTypeName(prop.keyOutInterpolationType(index));
    } catch (_e) {}
    if (detail === "full") {
      try {
        entry.inEase = serializeEaseArray(prop.keyInTemporalEase(index));
        entry.outEase = serializeEaseArray(prop.keyOutTemporalEase(index));
      } catch (_e) {}
      try {
        entry.inSpatialTangent = prop.keyInSpatialTangent(index);
        entry.outSpatialTangent = prop.keyOutSpatialTangent(index);
      } catch (_e) {}
    }
    result.push(entry);
  }
  return result;
}
function hasExpressionText(prop: any): boolean {
  try {
    return (
      prop.expression !== undefined &&
      prop.expression !== null &&
      String(prop.expression).length > 0
    );
  } catch (_e) {
    return false;
  }
}
function isTransformSampleMatchName(matchName: string): boolean {
  return (
    isCoreTransformMatchName(matchName) ||
    matchName === "ADBE Position_0" ||
    matchName === "ADBE Position_1" ||
    matchName === "ADBE Position_2" ||
    matchName === "ADBE Rotate X" ||
    matchName === "ADBE Rotate Y" ||
    matchName === "ADBE Orientation"
  );
}
function matchNameSet(matchNames: string[] | null): { [key: string]: boolean } | null {
  if (!matchNames || !matchNames.length) return null;
  const result: { [key: string]: boolean } = {};
  for (let i = 0; i < matchNames.length; i++) result[String(matchNames[i])] = true;
  return result;
}
function walkProperty(
  prop: any,
  detail: string,
  atTime: number,
  preExpression: boolean,
  matchSet: any,
  inherited: boolean,
): any {
  let matchName = "";
  try {
    matchName = String(prop.matchName);
  } catch (_e) {}
  const matched = !matchSet || inherited || !!matchSet[matchName];
  if (prop.propertyType !== PropertyType.PROPERTY) {
    const properties: any[] = [];
    for (let i = 1; i <= prop.numProperties; i++) {
      try {
        const child = walkProperty(
          prop.property(i),
          detail,
          atTime,
          preExpression,
          matchSet,
          matched,
        );
        if (child) properties.push(child);
      } catch (_e) {}
    }
    if (matchSet && !matched && !properties.length) return null;
    return {
      name: String(prop.name),
      matchName,
      propertyIndex: prop.propertyIndex,
      isGroup: true,
      properties,
    };
  }
  if (matchSet && !matched) return null;
  const node: any = {
    name: String(prop.name),
    matchName,
    propertyIndex: prop.propertyIndex,
    isGroup: false,
    propertyValueType: propertyValueTypeName(prop.propertyValueType),
    numKeys: prop.numKeys,
    hasExpression: hasExpressionText(prop),
  };
  try {
    node.enabled = !!prop.enabled;
  } catch (_e) {}
  try {
    node.active = !!prop.active;
  } catch (_e) {}
  try {
    node.expressionEnabled = !!prop.expressionEnabled;
  } catch (_e) {
    node.expressionEnabled = false;
  }
  if (detail === "extended" || detail === "full") {
    node.value = samplePropertyValue(prop, atTime, preExpression);
    if (node.hasExpression)
      try {
        node.expression = String(prop.expression);
      } catch (_e) {}
    if (prop.numKeys > 0) node.keyframes = serializeKeyframes(prop, detail);
    if (
      (isTransformSampleMatchName(matchName) ||
        prop.propertyValueType === (PropertyValueType as any).TEXT_DOCUMENT) &&
      (node.hasExpression || prop.numKeys > 0)
    ) {
      node.authoredValue = samplePropertyValue(prop, atTime, true);
      node.evaluatedValue = samplePropertyValue(prop, atTime, false);
    }
  }
  return node;
}
export function walkLayerProperties(
  layer: Layer,
  detail: string,
  atTime: number,
  preExpression: boolean,
  matchNames: string[] | null,
): any[] {
  const roots: any[] = [];
  const matches = matchNameSet(matchNames);
  for (let i = 1; i <= layer.numProperties; i++) {
    try {
      const node = walkProperty(layer.property(i), detail, atTime, preExpression, matches, false);
      if (node) roots.push(node);
    } catch (_e) {}
  }
  return roots;
}
export function serializeInterpretSummary(source: any): any {
  const result: any = {};
  try {
    result.hasAlpha = !!source.hasAlpha;
    result.alphaMode = enumName(source.alphaMode, AlphaMode as any, [
      "IGNORE",
      "STRAIGHT",
      "PREMULTIPLIED",
    ]);
    result.invertAlpha = !!source.invertAlpha;
    result.isStill = !!source.isStill;
    if (!source.isStill) result.loop = source.loop;
    result.nativeFrameRate = source.nativeFrameRate;
    result.conformFrameRate = source.conformFrameRate;
    result.displayFrameRate = source.displayFrameRate;
    result.fieldSeparationType = enumName(source.fieldSeparationType, FieldSeparationType as any, [
      "OFF",
      "UPPER_FIELD_FIRST",
      "LOWER_FIELD_FIRST",
    ]);
  } catch (_e) {}
  return result;
}
export function serializeInterpretFull(source: any, kind?: string | null): any {
  const result = serializeInterpretSummary(source);
  result.kind = kind || "file";
  result.file = null;
  result.missingFootagePath = null;
  result.solidColor = null;
  try {
    result.highQualityFieldSeparation = !!source.highQualityFieldSeparation;
    result.removePulldown = String(source.removePulldown);
  } catch (_e) {}
  if (source instanceof FileSource) {
    try {
      result.file = source.file ? source.file.fsName : null;
      result.missingFootagePath = source.missingFootagePath || null;
    } catch (_e) {}
  } else if (source instanceof SolidSource) {
    result.kind = "solid";
    try {
      result.solidColor = [source.color[0], source.color[1], source.color[2]];
    } catch (_e) {}
  } else if (source instanceof PlaceholderSource) result.kind = "placeholder";
  return result;
}
