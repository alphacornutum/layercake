import { SHARED_RESOLVE_HELPERS } from "./resolve-script.js";

/**
 * Shared ExtendScript helpers for inspect tools (lookup, property walk, value serialize).
 * Concatenate after SHARED_INVENTORY_HELPERS and before script-specific bodies.
 */
const SHARED_INSPECT_PREFIX = `
function inspectFail(code, message, candidates) {
  var payload = { code: code, message: message };
  if (candidates) payload.candidates = candidates;
  throw new Error("AFX_INSPECT:" + JSON.stringify(payload));
}

var resolveFail = inspectFail;
`.trim();

const SHARED_INSPECT_SUFFIX = `
function matchNameSet(matchNames) {
  if (!matchNames || matchNames.length === 0) return null;
  var set = {};
  for (var i = 0; i < matchNames.length; i++) {
    set[String(matchNames[i])] = true;
  }
  return set;
}

function propertyValueTypeName(pvt) {
  if (pvt === PropertyValueType.NO_VALUE) return "NO_VALUE";
  if (pvt === PropertyValueType.ThreeD_SPATIAL) return "ThreeD_SPATIAL";
  if (pvt === PropertyValueType.ThreeD) return "ThreeD";
  if (pvt === PropertyValueType.TwoD_SPATIAL) return "TwoD_SPATIAL";
  if (pvt === PropertyValueType.TwoD) return "TwoD";
  if (pvt === PropertyValueType.OneD) return "OneD";
  if (pvt === PropertyValueType.COLOR) return "COLOR";
  if (pvt === PropertyValueType.CUSTOM_VALUE) return "CUSTOM_VALUE";
  if (pvt === PropertyValueType.MARKER) return "MARKER";
  if (pvt === PropertyValueType.LAYER_INDEX) return "LAYER_INDEX";
  if (pvt === PropertyValueType.MASK_INDEX) return "MASK_INDEX";
  if (pvt === PropertyValueType.SHAPE) return "SHAPE";
  if (pvt === PropertyValueType.TEXT_DOCUMENT) return "TEXT_DOCUMENT";
  return "UNKNOWN";
}

function interpolationTypeName(t) {
  if (t === KeyframeInterpolationType.LINEAR) return "LINEAR";
  if (t === KeyframeInterpolationType.BEZIER) return "BEZIER";
  if (t === KeyframeInterpolationType.HOLD) return "HOLD";
  return String(t);
}

function isSerializableValueType(pvt) {
  return (
    pvt === PropertyValueType.OneD ||
    pvt === PropertyValueType.TwoD ||
    pvt === PropertyValueType.TwoD_SPATIAL ||
    pvt === PropertyValueType.ThreeD ||
    pvt === PropertyValueType.ThreeD_SPATIAL ||
    pvt === PropertyValueType.COLOR ||
    pvt === PropertyValueType.LAYER_INDEX ||
    pvt === PropertyValueType.MASK_INDEX
  );
}

function serializeAeValue(value, pvt) {
  if (!isSerializableValueType(pvt)) {
    return { unserializable: true, propertyValueType: propertyValueTypeName(pvt) };
  }
  if (pvt === PropertyValueType.OneD || pvt === PropertyValueType.LAYER_INDEX || pvt === PropertyValueType.MASK_INDEX) {
    return value;
  }
  if (value && typeof value === "object" && value.length !== undefined) {
    var arr = [];
    for (var i = 0; i < value.length; i++) arr.push(value[i]);
    return arr;
  }
  return value;
}

function serializeEaseArray(easeArr) {
  if (!easeArr) return undefined;
  var out = [];
  for (var i = 0; i < easeArr.length; i++) {
    out.push({ speed: easeArr[i].speed, influence: easeArr[i].influence });
  }
  return out;
}

function serializeSpatialTangent(arr) {
  if (!arr) return undefined;
  var out = [];
  for (var i = 0; i < arr.length; i++) out.push(arr[i]);
  return out;
}

function samplePropertyValue(prop, atTime, preExpression) {
  var pvt = prop.propertyValueType;
  if (pvt === PropertyValueType.NO_VALUE) {
    return { unserializable: true, propertyValueType: "NO_VALUE" };
  }
  try {
    var raw;
    if (prop.canVaryOverTime || (prop.expression && String(prop.expression).length > 0)) {
      raw = prop.valueAtTime(atTime, preExpression);
    } else {
      raw = prop.value;
    }
    return serializeAeValue(raw, pvt);
  } catch (e) {
    return { unserializable: true, propertyValueType: propertyValueTypeName(pvt) };
  }
}

function serializeKeyframes(prop, detail) {
  var keys = [];
  var n = prop.numKeys;
  var pvt = prop.propertyValueType;
  for (var k = 1; k <= n; k++) {
    var entry = {
      time: prop.keyTime(k),
      value: serializeAeValue(prop.keyValue(k), pvt)
    };
    try {
      entry.inInterpolationType = interpolationTypeName(prop.keyInInterpolationType(k));
      entry.outInterpolationType = interpolationTypeName(prop.keyOutInterpolationType(k));
    } catch (e) {}
    if (detail === "full") {
      try {
        entry.inEase = serializeEaseArray(prop.keyInTemporalEase(k));
        entry.outEase = serializeEaseArray(prop.keyOutTemporalEase(k));
      } catch (e) {}
      try {
        if (pvt === PropertyValueType.TwoD_SPATIAL || pvt === PropertyValueType.ThreeD_SPATIAL) {
          entry.inSpatialTangent = serializeSpatialTangent(prop.keyInSpatialTangent(k));
          entry.outSpatialTangent = serializeSpatialTangent(prop.keyOutSpatialTangent(k));
        }
      } catch (e) {}
    }
    keys.push(entry);
  }
  return keys;
}

function hasExpressionText(prop) {
  try {
    var expr = prop.expression;
    return expr !== undefined && expr !== null && String(expr).length > 0;
  } catch (e) {
    return false;
  }
}

function walkProperty(prop, detail, atTime, preExpression, matchSet, inMatch) {
  var matchName = "";
  try {
    matchName = String(prop.matchName);
  } catch (e) {}
  var selfMatched = !matchSet || inMatch || !!matchSet[matchName];
  var isGroup = prop.propertyType !== PropertyType.PROPERTY;

  if (isGroup) {
    var children = [];
    var num = prop.numProperties;
    for (var i = 1; i <= num; i++) {
      var child;
      try {
        child = prop.property(i);
      } catch (e) {
        continue;
      }
      var childNode = walkProperty(child, detail, atTime, preExpression, matchSet, selfMatched);
      if (childNode) children.push(childNode);
    }
    if (matchSet && !selfMatched && children.length === 0) return null;
    var groupNode = {
      name: String(prop.name),
      matchName: matchName,
      propertyIndex: prop.propertyIndex,
      isGroup: true,
      properties: children
    };
    try {
      groupNode.enabled = !!prop.enabled;
    } catch (e) {}
    try {
      groupNode.active = !!prop.active;
    } catch (e) {}
    return groupNode;
  }

  if (matchSet && !selfMatched) return null;

  var pvt = prop.propertyValueType;
  var node = {
    name: String(prop.name),
    matchName: matchName,
    propertyIndex: prop.propertyIndex,
    isGroup: false,
    propertyValueType: propertyValueTypeName(pvt),
    numKeys: prop.numKeys,
    hasExpression: hasExpressionText(prop)
  };
  try {
    node.enabled = !!prop.enabled;
  } catch (e) {}
  try {
    node.active = !!prop.active;
  } catch (e) {}
  try {
    node.expressionEnabled = !!prop.expressionEnabled;
  } catch (e) {
    node.expressionEnabled = false;
  }

  if (detail === "extended" || detail === "full") {
    node.value = samplePropertyValue(prop, atTime, preExpression);
    if (node.hasExpression) {
      try {
        node.expression = String(prop.expression);
      } catch (e) {}
    }
    if (prop.numKeys > 0) {
      node.keyframes = serializeKeyframes(prop, detail);
    }
  }
  return node;
}

function walkLayerProperties(layer, detail, atTime, preExpression, matchNames) {
  var matchSet = matchNameSet(matchNames);
  var roots = [];
  for (var i = 1; i <= layer.numProperties; i++) {
    var prop;
    try {
      prop = layer.property(i);
    } catch (e) {
      continue;
    }
    var node = walkProperty(prop, detail, atTime, preExpression, matchSet, false);
    if (node) roots.push(node);
  }
  return roots;
}

function alphaModeName(v) {
  if (v === AlphaMode.IGNORE) return "IGNORE";
  if (v === AlphaMode.STRAIGHT) return "STRAIGHT";
  if (v === AlphaMode.PREMULTIPLIED) return "PREMULTIPLIED";
  return String(v);
}

function fieldSeparationName(v) {
  if (v === FieldSeparationType.OFF) return "OFF";
  if (v === FieldSeparationType.UPPER_FIELD_FIRST) return "UPPER_FIELD_FIRST";
  if (v === FieldSeparationType.LOWER_FIELD_FIRST) return "LOWER_FIELD_FIRST";
  return String(v);
}

function pulldownPhaseName(v) {
  try {
    if (v === PulldownPhase.OFF) return "OFF";
  } catch (e) {}
  return String(v);
}

function serializeInterpretSummary(src) {
  if (!src) return null;
  var out = {};
  try { out.hasAlpha = !!src.hasAlpha; } catch (e) {}
  try { out.alphaMode = alphaModeName(src.alphaMode); } catch (e) {}
  try { out.invertAlpha = !!src.invertAlpha; } catch (e) {}
  try { out.isStill = !!src.isStill; } catch (e) {}
  try {
    if (!src.isStill) out.loop = src.loop;
  } catch (e) {}
  try { out.nativeFrameRate = src.nativeFrameRate; } catch (e) {}
  try { out.conformFrameRate = src.conformFrameRate; } catch (e) {}
  try { out.displayFrameRate = src.displayFrameRate; } catch (e) {}
  try { out.fieldSeparationType = fieldSeparationName(src.fieldSeparationType); } catch (e) {}
  return out;
}

function serializeInterpretFull(src, kind) {
  var out = serializeInterpretSummary(src) || {};
  out.kind = kind || "file";
  try {
    if (src.hasAlpha && src.alphaMode === AlphaMode.PREMULTIPLIED) {
      var c = src.premulColor;
      out.premulColor = [c[0], c[1], c[2]];
    } else {
      out.premulColor = null;
    }
  } catch (e) {
    out.premulColor = null;
  }
  try { out.highQualityFieldSeparation = !!src.highQualityFieldSeparation; } catch (e) {}
  try { out.removePulldown = pulldownPhaseName(src.removePulldown); } catch (e) {}
  out.file = null;
  out.missingFootagePath = null;
  out.solidColor = null;
  if (src instanceof FileSource) {
    out.kind = "file";
    try {
      if (src.file) out.file = src.file.fsName;
    } catch (e) {}
    try {
      var missing = src.missingFootagePath;
      if (missing !== undefined && missing !== null && missing !== "") {
        out.missingFootagePath = String(missing);
      }
    } catch (e) {}
  } else if (src instanceof SolidSource) {
    out.kind = "solid";
    try {
      var sc = src.color;
      out.solidColor = [sc[0], sc[1], sc[2]];
    } catch (e) {}
  } else if (src instanceof PlaceholderSource) {
    out.kind = "placeholder";
  }
  return out;
}
`.trim();

export const SHARED_INSPECT_HELPERS = [
  SHARED_INSPECT_PREFIX,
  SHARED_RESOLVE_HELPERS,
  SHARED_INSPECT_SUFFIX,
].join("\n\n");
