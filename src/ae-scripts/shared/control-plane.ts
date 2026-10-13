// @ts-nocheck
import {
  compSwitchKeys,
  frameToTime,
  footageKindOf,
  isOnGridFrame,
  isRootFolder,
  itemById,
  itemTypeName,
  layerTimingFrames,
  readCompSwitches,
  readDisplayStartFrame,
  timeToFrame,
  isCoreTransformMatchName,
  transformMatchName,
  parentFolderInfo,
} from "./inventory";
import { collectItemRefs } from "./item-refs";

/** Control-plane patch helpers, bundled into patch-apply. */
function parsePropertyPathSegments(propertyPath) {
  var s = String(propertyPath || "");
  if (s.indexOf("->") >= 0) {
    return s.split("->");
  }
  return s.split(".");
}

function resolvePropertySegments(layer, segments) {
  var cur = layer;
  var resolved = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = String(segments[i]);
    if (!seg) {
      return {
        error: "Empty property path segment",
        prop: null,
        matchNames: resolved,
      };
    }
    var next;
    try {
      next = cur.property(seg);
    } catch (e) {
      return {
        error: "Property not found for segment: " + seg,
        prop: null,
        matchNames: resolved,
      };
    }
    if (!next) {
      return {
        error: "Property not found for segment: " + seg,
        prop: null,
        matchNames: resolved,
      };
    }
    try {
      resolved.push(String(next.matchName || seg));
    } catch (me) {
      resolved.push(seg);
    }
    cur = next;
  }
  if (cur.propertyType === PropertyType.PROPERTY) {
    return { error: null, prop: cur, matchNames: resolved };
  }
  return {
    error: "Resolved path is not a PropertyBase leaf (PropertyType.PROPERTY)",
    prop: null,
    matchNames: resolved,
  };
}

function resolvePropertySelector(layer, op) {
  var segments;
  if (op.matchNames && op.matchNames.length > 0) {
    segments = op.matchNames;
  } else if (op.propertyPath) {
    segments = parsePropertyPathSegments(op.propertyPath);
  } else {
    return {
      error: "Provide exactly one of matchNames or propertyPath",
      prop: null,
      matchNames: [],
    };
  }
  return resolvePropertySegments(layer, segments);
}

function readLayerTimingFrames(layer, frameRate) {
  return layerTimingFrames(layer, frameRate);
}

function readLayerSwitches(layer) {
  var out = {};
  try {
    out.enabled = !!layer.enabled;
  } catch (e) {}
  try {
    out.audioEnabled = !!layer.audioEnabled;
  } catch (e) {}
  try {
    out.solo = !!layer.solo;
  } catch (e) {}
  try {
    out.shy = !!layer.shy;
  } catch (e) {}
  try {
    out.locked = !!layer.locked;
  } catch (e) {}
  try {
    out.guideLayer = !!layer.guideLayer;
  } catch (e) {}
  try {
    out.adjustmentLayer = !!layer.adjustmentLayer;
  } catch (e) {}
  try {
    out.threeDLayer = !!layer.threeDLayer;
  } catch (e) {}
  try {
    out.collapseTransformation = !!layer.collapseTransformation;
  } catch (e) {}
  try {
    out.frameBlending = !!layer.frameBlending;
  } catch (e) {}
  try {
    out.motionBlur = !!layer.motionBlur;
  } catch (e) {}
  try {
    out.timeRemapEnabled = !!layer.timeRemapEnabled;
  } catch (e) {}
  return out;
}

function setLayerSwitchValue(layer, key, value) {
  var v = !!value;
  if (key === "enabled") {
    layer.enabled = v;
    return;
  }
  if (key === "audioEnabled") {
    layer.audioEnabled = v;
    return;
  }
  if (key === "solo") {
    layer.solo = v;
    return;
  }
  if (key === "shy") {
    layer.shy = v;
    return;
  }
  if (key === "locked") {
    layer.locked = v;
    return;
  }
  if (key === "guideLayer") {
    layer.guideLayer = v;
    return;
  }
  if (key === "adjustmentLayer") {
    layer.adjustmentLayer = v;
    return;
  }
  if (key === "threeDLayer") {
    layer.threeDLayer = v;
    return;
  }
  if (key === "collapseTransformation") {
    layer.collapseTransformation = v;
    return;
  }
  if (key === "frameBlending") {
    layer.frameBlending = v;
    return;
  }
  if (key === "motionBlur") {
    layer.motionBlur = v;
    return;
  }
  if (key === "timeRemapEnabled") {
    layer.timeRemapEnabled = v;
    return;
  }
  throw new Error("Unknown switch key: " + key);
}

function orderedSwitchWriteKeys(switches) {
  var allKeys = [
    "enabled",
    "audioEnabled",
    "solo",
    "shy",
    "locked",
    "guideLayer",
    "adjustmentLayer",
    "threeDLayer",
    "collapseTransformation",
    "frameBlending",
    "motionBlur",
    "timeRemapEnabled",
  ];
  var supplied = [];
  var i;
  for (i = 0; i < allKeys.length; i++) {
    if (switches[allKeys[i]] !== undefined) {
      supplied.push(allKeys[i]);
    }
  }
  var unlockFirst = switches.locked === false;
  var lockLast = switches.locked === true;
  var ordered = [];
  if (unlockFirst) {
    ordered.push("locked");
  }
  for (i = 0; i < supplied.length; i++) {
    if (supplied[i] === "locked") continue;
    ordered.push(supplied[i]);
  }
  if (lockLast) {
    ordered.push("locked");
  }
  return ordered;
}

/** Absolute epsilon for authored transform component compares (spatial/scale/rotation/opacity). */
var TRANSFORM_EPSILON = 0.001;

var TRANSFORM_KEYS = ["anchorPoint", "position", "scale", "rotation", "opacity"];

function isAeArray(v) {
  return typeof v === "object" && v !== null && v.length !== undefined;
}

function getTransformProp(layer, key) {
  var matchName = transformMatchName(key);
  if (!matchName || !isCoreTransformMatchName(matchName)) return null;
  try {
    var xf = layer.property("ADBE Transform Group");
    if (!xf) return null;
    return xf.property(matchName);
  } catch (e) {
    return null;
  }
}

function normalizeTransformValue(raw) {
  if (raw === null || raw === undefined) return undefined;
  if (isAeArray(raw)) {
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      out.push(Number(raw[i]));
    }
    return out;
  }
  var n = Number(raw);
  if (isNaN(n)) return undefined;
  return n;
}

/** Authored/pre-expression sample; prefer valueAtTime(..., true) like inspect. */
function readAuthoredPropValue(prop, atTime) {
  try {
    return normalizeTransformValue(prop.valueAtTime(atTime, true));
  } catch (e) {
    try {
      return normalizeTransformValue(prop.value);
    } catch (e2) {
      return undefined;
    }
  }
}

function readLayerTransform(layer) {
  var atTime = 0;
  try {
    atTime = layer.containingComp.time;
  } catch (e) {}
  var out = {};
  var i;
  for (i = 0; i < TRANSFORM_KEYS.length; i++) {
    var key = TRANSFORM_KEYS[i];
    var prop = getTransformProp(layer, key);
    if (!prop) continue;
    var val = readAuthoredPropValue(prop, atTime);
    if (val !== undefined) out[key] = val;
  }
  return out;
}

function transformValuesEqual(a, b) {
  if (a === undefined || b === undefined) return false;
  var aArr = isAeArray(a);
  var bArr = isAeArray(b);
  if (aArr || bArr) {
    if (!aArr || !bArr) return false;
    if (a.length !== b.length) return false;
    var i;
    for (i = 0; i < a.length; i++) {
      if (Math.abs(Number(a[i]) - Number(b[i])) > TRANSFORM_EPSILON) return false;
    }
    return true;
  }
  return Math.abs(Number(a) - Number(b)) <= TRANSFORM_EPSILON;
}

function orderedTransformWriteKeys(transform) {
  var supplied = [];
  var i;
  for (i = 0; i < TRANSFORM_KEYS.length; i++) {
    if (transform[TRANSFORM_KEYS[i]] !== undefined) {
      supplied.push(TRANSFORM_KEYS[i]);
    }
  }
  return supplied;
}

function keyframedTransformKeys(layer, keys) {
  var list = keys || TRANSFORM_KEYS;
  var keyframed = [];
  var i;
  for (i = 0; i < list.length; i++) {
    var key = list[i];
    var prop = getTransformProp(layer, key);
    if (!prop) continue;
    try {
      if (prop.numKeys > 0) keyframed.push(key);
    } catch (ke) {}
  }
  return keyframed;
}

function defaultTransformValue(layer, comp, key, currentVal) {
  var len = 2;
  if (isAeArray(currentVal)) {
    len = currentVal.length;
  } else {
    try {
      if (layer.threeDLayer) len = 3;
    } catch (e) {}
  }
  if (key === "anchorPoint") {
    var srcW = 0;
    var srcH = 0;
    try {
      if (layer.source) {
        srcW = Number(layer.source.width);
        srcH = Number(layer.source.height);
      }
    } catch (se) {}
    if (len >= 3) return [srcW / 2, srcH / 2, 0];
    return [srcW / 2, srcH / 2];
  }
  if (key === "position") {
    if (len >= 3) return [Number(comp.width) / 2, Number(comp.height) / 2, 0];
    return [Number(comp.width) / 2, Number(comp.height) / 2];
  }
  if (key === "scale") {
    if (len >= 3) return [100, 100, 100];
    return [100, 100];
  }
  if (key === "rotation") return 0;
  return 100; // opacity
}

function defaultLayerTransform(layer, comp) {
  var current = readLayerTransform(layer);
  var out = {};
  var i;
  for (i = 0; i < TRANSFORM_KEYS.length; i++) {
    var key = TRANSFORM_KEYS[i];
    out[key] = defaultTransformValue(layer, comp, key, current[key]);
  }
  return out;
}

function coerceTransformArray(value, currentVal) {
  if (!isAeArray(value)) return value;
  var curLen = isAeArray(currentVal) ? currentVal.length : value.length;
  if (value.length === curLen) return value;
  // AE often exposes Position/Anchor/Scale as length 3 even on 2D layers.
  if (value.length === 2 && curLen === 3) {
    return [Number(value[0]), Number(value[1]), 0];
  }
  if (value.length === 3 && curLen === 2) {
    return [Number(value[0]), Number(value[1])];
  }
  return value;
}

function writeTransformProp(prop, value) {
  prop.setValue(value);
}

/**
 * Write desired transform keys then re-read. Caller must refuse keyframed props first.
 * @returns {{ after: object, mismatched: string[], writeError: string|null }}
 */
function writeAndVerifyTransforms(layer, desiredByKey, keys) {
  var list = keys || TRANSFORM_KEYS;
  var i;
  var key;
  var prop;
  try {
    for (i = 0; i < list.length; i++) {
      key = list[i];
      if (desiredByKey[key] === undefined) continue;
      prop = getTransformProp(layer, key);
      if (!prop) continue;
      writeTransformProp(prop, desiredByKey[key]);
    }
  } catch (we) {
    var afterErr = {};
    try {
      afterErr = readLayerTransform(layer);
    } catch (ae) {}
    return { after: afterErr, mismatched: [], writeError: String(we) };
  }
  var after = readLayerTransform(layer);
  var mismatched = [];
  for (i = 0; i < list.length; i++) {
    key = list[i];
    if (desiredByKey[key] === undefined) continue;
    if (!transformValuesEqual(after[key], desiredByKey[key])) {
      mismatched.push(key);
    }
  }
  return { after: after, mismatched: mismatched, writeError: null };
}

function layerByIdInComp(comp, layerId) {
  for (var i = 1; i <= comp.numLayers; i++) {
    try {
      if (comp.layer(i).id === layerId) return comp.layer(i);
    } catch (e) {}
  }
  return null;
}

function countGroupChildren(layer, matchName) {
  try {
    var g = layer.property(matchName);
    if (g) return g.numProperties;
  } catch (e) {}
  return 0;
}

function clearPropertyKeys(prop) {
  try {
    while (prop.numKeys > 0) {
      prop.removeKey(1);
    }
  } catch (e) {}
}

function walkClearKeysAndExpressions(prop, clearKeys, clearExprs) {
  var isGroup = prop.propertyType !== PropertyType.PROPERTY;
  if (isGroup) {
    for (var i = prop.numProperties; i >= 1; i--) {
      var child;
      try {
        child = prop.property(i);
      } catch (e) {
        continue;
      }
      walkClearKeysAndExpressions(child, clearKeys, clearExprs);
    }
    return;
  }
  if (clearKeys) clearPropertyKeys(prop);
  if (clearExprs) {
    try {
      prop.expression = "";
      prop.expressionEnabled = false;
    } catch (ee) {}
  }
}

export function applyRenameProjectItem(plan, opResult) {
  var item = plan.item;
  var desired = String(plan.op.name);
  var targetResult = {
    itemId: item.id,
    itemName: String(item.name || ""),
    itemType: itemTypeName(item),
    status: "failed",
  };
  var beforeName = String(item.name || "");
  targetResult.before = { name: beforeName };
  if (beforeName === desired) {
    targetResult.status = "already_satisfied";
    targetResult.after = { name: beforeName };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    item.name = desired;
    var afterName = String(item.name || "");
    targetResult.after = { name: afterName };
    targetResult.itemName = afterName;
    if (afterName === desired) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: item name did not match after write";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (re) {
    targetResult.status = "failed";
    targetResult.message = String(re);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(re) };
  }
}

export function applySetLayerIndex(plan, opResult) {
  var t = plan.targets[0];
  var desired = plan.op.index;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    before: { index: t.layer.index },
  };
  if (t.layer.index === desired) {
    targetResult.status = "already_satisfied";
    targetResult.after = { index: t.layer.index };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    t.layer.moveToBeginning();
    // moveToBeginning puts at index 1; then move down if needed
    if (desired > 1) {
      // After moveToBeginning, layer is at 1. Use moveAfter repeatedly.
      var guard = 0;
      while (t.layer.index < desired && guard < 10000) {
        guard++;
        var below = t.comp.layer(t.layer.index + 1);
        if (!below) break;
        t.layer.moveAfter(below);
      }
    }
    // If still not at desired (desired was above original), try moveBefore from end path
    if (t.layer.index !== desired) {
      // Fallback: moveToEnd then move up
      t.layer.moveToEnd();
      var guard2 = 0;
      while (t.layer.index > desired && guard2 < 10000) {
        guard2++;
        var above = t.comp.layer(t.layer.index - 1);
        if (!above) break;
        t.layer.moveBefore(above);
      }
    }
    var afterIndex = t.layer.index;
    targetResult.after = { index: afterIndex };
    if (afterIndex === desired) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message =
      "Post-condition failed: layer index is " + afterIndex + ", expected " + desired;
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (ie) {
    targetResult.status = "failed";
    targetResult.message = String(ie);
    try {
      targetResult.after = { index: t.layer.index };
    } catch (ae) {}
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(ie) };
  }
}

export function applyCreateSolid(plan, opResult) {
  var op = plan.op;
  var parent = plan.parentFolder;
  var requestedName = op.name !== undefined && op.name !== null ? String(op.name) : null;
  // AE addSolid requires a name argument; conventional placeholder when omitted (ADR 0006).
  var createName = requestedName !== null ? requestedName : "Solid";
  var targetResult = {
    itemId: -1,
    itemName: createName,
    itemType: "footage",
    status: "failed",
  };
  var createdItem = null;
  var tempComp = null;
  var solidLayer = null;
  try {
    // addSolid creates FootageItem + layer; remove layer to leave the solid in the project.
    tempComp = app.project.items.addComp(
      "__layercake_solid_tmp__",
      op.width,
      op.height,
      op.pixelAspect,
      1,
      30,
    );
    solidLayer = tempComp.layers.addSolid(
      op.color,
      createName,
      op.width,
      op.height,
      op.pixelAspect,
      1,
    );
    createdItem = solidLayer.source;
    solidLayer.remove();
    tempComp.remove();
    tempComp = null;
    if (parent && createdItem.parentFolder.id !== parent.id) {
      createdItem.parentFolder = parent;
    }
    if (requestedName !== null) {
      createdItem.name = requestedName;
    }
    var parentInfo = parentFolderInfo(createdItem);
    var color = op.color;
    targetResult.itemId = createdItem.id;
    targetResult.itemName = String(createdItem.name);
    targetResult.created = {
      id: createdItem.id,
      name: String(createdItem.name),
      width: createdItem.width,
      height: createdItem.height,
      pixelAspect: createdItem.pixelAspect,
      color: [color[0], color[1], color[2]],
      parentFolderId: parentInfo.id,
    };
    var nameOk = requestedName === null || String(createdItem.name) === requestedName;
    if (
      footageKindOf(createdItem) === "solid" &&
      nameOk &&
      (!parent || parentInfo.id === parent.id)
    ) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: created solid identity did not match request";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (ce) {
    targetResult.message = String(ce);
    if (solidLayer) {
      try {
        solidLayer.remove();
      } catch (e1) {}
    }
    if (tempComp) {
      try {
        tempComp.remove();
      } catch (e2) {}
    }
    if (createdItem) {
      try {
        targetResult.itemId = createdItem.id;
      } catch (e3) {}
    }
    opResult.targets.push(targetResult);
    return {
      anyChanged: !!createdItem,
      anyFailed: true,
      applyError: String(ce),
    };
  }
}

export function applyReplaceLayerSource(plan, opResult) {
  var t = plan.targets[0];
  var sourceItem = plan.sourceItem;
  var fixExpressions = plan.op.fixExpressions !== false;
  var layer = t.layer;
  var oldId = layer.id;
  var beforeSourceId = null;
  try {
    if (layer.source) beforeSourceId = layer.source.id;
  } catch (e) {}
  var targetResult = {
    compId: t.comp.id,
    layerId: oldId,
    compName: t.comp.name,
    layerName: layer.name,
    status: "failed",
    before: { sourceItemId: beforeSourceId },
  };
  if (beforeSourceId === sourceItem.id) {
    targetResult.status = "already_satisfied";
    targetResult.layerIdPreserved = true;
    targetResult.after = { sourceItemId: beforeSourceId };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    if (!(layer instanceof AVLayer)) {
      targetResult.status = "unsupported";
      targetResult.message = "Layer is not an AVLayer; cannot replaceSource";
      opResult.targets.push(targetResult);
      return {
        anyChanged: false,
        anyFailed: true,
        applyError: targetResult.message,
      };
    }
    try {
      layer.replaceSource(sourceItem, fixExpressions);
      var afterId = layer.id;
      var afterSourceId = layer.source ? layer.source.id : null;
      targetResult.after = { sourceItemId: afterSourceId };
      targetResult.layerId = afterId;
      if (afterSourceId === sourceItem.id && afterId === oldId) {
        targetResult.layerIdPreserved = true;
        targetResult.status = "changed";
        opResult.targets.push(targetResult);
        return { anyChanged: true, anyFailed: false, applyError: null };
      }
      if (afterSourceId === sourceItem.id) {
        targetResult.layerIdPreserved = afterId === oldId;
        if (afterId !== oldId) targetResult.newLayerId = afterId;
        targetResult.status = "changed";
        opResult.targets.push(targetResult);
        return { anyChanged: true, anyFailed: false, applyError: null };
      }
    } catch (replaceErr) {
      // Recreate path: capture timing/name/index, add new layer, delete old.
    }
    var name = String(layer.name);
    var idx = layer.index;
    var startTime = layer.startTime;
    var inPoint = layer.inPoint;
    var outPoint = layer.outPoint;
    var stretch = layer.stretch;
    var newLayer = t.comp.layers.add(sourceItem);
    newLayer.name = name;
    newLayer.startTime = startTime;
    newLayer.inPoint = inPoint;
    newLayer.outPoint = outPoint;
    newLayer.stretch = stretch;
    // Move to original index
    newLayer.moveToBeginning();
    var g = 0;
    while (newLayer.index < idx && g < 10000) {
      g++;
      var below = t.comp.layer(newLayer.index + 1);
      if (!below) break;
      newLayer.moveAfter(below);
    }
    layer.remove();
    var newId = newLayer.id;
    var newSourceId = newLayer.source ? newLayer.source.id : null;
    targetResult.layerIdPreserved = false;
    targetResult.newLayerId = newId;
    targetResult.layerId = newId;
    targetResult.layerName = String(newLayer.name);
    targetResult.after = { sourceItemId: newSourceId };
    if (newSourceId === sourceItem.id && !layerByIdInComp(t.comp, oldId)) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed after recreate replace";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (re) {
    targetResult.status = "failed";
    targetResult.message = String(re);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(re) };
  }
}

/** Nearest-frame + on-grid (on-grid alone implies timeToFrame equality within epsilon). */
function timingEdgeOk(seconds, frame, frameRate) {
  return isOnGridFrame(seconds, frame, frameRate);
}

function layerTimingPostConditionError(op, snapshot, preserved, frameRate) {
  if (op.startFrame !== undefined && !timingEdgeOk(snapshot.startTime, op.startFrame, frameRate)) {
    return "Post-condition failed: timing edge off-grid or frames did not match request";
  }
  if (op.inFrame !== undefined && !timingEdgeOk(snapshot.inPoint, op.inFrame, frameRate)) {
    return "Post-condition failed: timing edge off-grid or frames did not match request";
  }
  if (op.outFrame !== undefined && !timingEdgeOk(snapshot.outPoint, op.outFrame, frameRate)) {
    return "Post-condition failed: timing edge off-grid or frames did not match request";
  }
  if (op.stretch !== undefined && snapshot.stretch !== op.stretch) {
    return "Post-condition failed: timing frames did not match request";
  }
  // When both effective edges are determined, require both on-grid (implies exact durationFrames).
  if (op.inFrame !== undefined || op.outFrame !== undefined) {
    var wantIn = null;
    var wantOut = null;
    if (op.inFrame !== undefined) {
      wantIn = op.inFrame;
    } else if (timingEdgeOk(preserved.inPoint, preserved.inFrame, frameRate)) {
      wantIn = preserved.inFrame;
    }
    if (op.outFrame !== undefined) {
      wantOut = op.outFrame;
    } else if (timingEdgeOk(preserved.outPoint, preserved.outFrame, frameRate)) {
      wantOut = preserved.outFrame;
    }
    if (
      wantIn !== null &&
      wantOut !== null &&
      (!timingEdgeOk(snapshot.inPoint, wantIn, frameRate) ||
        !timingEdgeOk(snapshot.outPoint, wantOut, frameRate))
    ) {
      return "Post-condition failed: timing edge off-grid or frames did not match request";
    }
  }
  return null;
}

/** Seconds; catches AE nudges (~0.02s) while tolerating float noise after fps churn. */
var KEY_TIME_EPSILON = 1e-4;
var KEYFRAME_DRIFT_CAP = 8;

function resolvePropByMatchNames(layer, matchNames) {
  var cur = layer;
  for (var i = 0; i < matchNames.length; i++) {
    try {
      cur = cur.property(matchNames[i]);
    } catch (e) {
      return null;
    }
    if (!cur) return null;
  }
  return cur;
}

function keyValuesEqual(a, b) {
  if (a === b) return true;
  try {
    if (typeof a === "number" || typeof b === "number") {
      return Math.abs(Number(a) - Number(b)) <= KEY_TIME_EPSILON;
    }
  } catch (e) {}
  try {
    var aLen = a !== null && a !== undefined && a.length !== undefined && typeof a !== "string";
    var bLen = b !== null && b !== undefined && b.length !== undefined && typeof b !== "string";
    if (aLen && bLen) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (Math.abs(Number(a[i]) - Number(b[i])) > KEY_TIME_EPSILON) return false;
      }
      return true;
    }
  } catch (e2) {}
  try {
    if (a.comment !== undefined || b.comment !== undefined) {
      return String(a.comment || "") === String(b.comment || "");
    }
  } catch (e3) {}
  // Opaque values (TextDocument, Shape, ...): times are the hard contract.
  return true;
}

function snapshotKeyEntry(prop, keyIndex) {
  var entry = {
    time: prop.keyTime(keyIndex),
    value: prop.keyValue(keyIndex),
  };
  try {
    entry.inInterp = prop.keyInInterpolationType(keyIndex);
    entry.outInterp = prop.keyOutInterpolationType(keyIndex);
  } catch (e) {}
  try {
    entry.inEase = prop.keyInTemporalEase(keyIndex);
    entry.outEase = prop.keyOutTemporalEase(keyIndex);
  } catch (e) {}
  try {
    entry.inSpatial = prop.keyInSpatialTangent(keyIndex);
    entry.outSpatial = prop.keyOutSpatialTangent(keyIndex);
  } catch (e) {}
  try {
    entry.temporalContinuous = prop.keyTemporalContinuous(keyIndex);
    entry.temporalAutoBezier = prop.keyTemporalAutoBezier(keyIndex);
  } catch (e) {}
  try {
    entry.spatialContinuous = prop.keySpatialContinuous(keyIndex);
    entry.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
  } catch (e) {}
  try {
    entry.roving = prop.keyRoving(keyIndex);
  } catch (e) {}
  return entry;
}

function walkSnapshotKeyedProp(prop, parentPath, out) {
  var matchName = "";
  try {
    matchName = String(prop.matchName);
  } catch (e) {
    return;
  }
  if (!matchName) return;
  var path = parentPath.concat([matchName]);
  var isGroup = false;
  try {
    isGroup = prop.propertyType !== PropertyType.PROPERTY;
  } catch (e) {
    return;
  }
  if (isGroup) {
    var nProps = 0;
    try {
      nProps = prop.numProperties;
    } catch (e) {
      return;
    }
    for (var i = 1; i <= nProps; i++) {
      try {
        walkSnapshotKeyedProp(prop.property(i), path, out);
      } catch (e) {}
    }
    return;
  }
  var nKeys = 0;
  try {
    nKeys = prop.numKeys;
  } catch (e) {
    return;
  }
  if (!nKeys || nKeys < 1) return;
  var keys = [];
  for (var k = 1; k <= nKeys; k++) {
    try {
      keys.push(snapshotKeyEntry(prop, k));
    } catch (e) {
      return;
    }
  }
  out.push({ matchNames: path, keys: keys });
}

function snapshotLayerKeyframes(layer) {
  var out = [];
  var n = 0;
  try {
    n = layer.numProperties;
  } catch (e) {
    return out;
  }
  for (var i = 1; i <= n; i++) {
    try {
      walkSnapshotKeyedProp(layer.property(i), [], out);
    } catch (e) {}
  }
  return out;
}

function propertyKeysMatchSnapshot(prop, keys) {
  var n = 0;
  try {
    n = prop.numKeys;
  } catch (e) {
    return false;
  }
  if (n !== keys.length) return false;
  for (var k = 0; k < keys.length; k++) {
    try {
      if (Math.abs(Number(prop.keyTime(k + 1)) - Number(keys[k].time)) >= KEY_TIME_EPSILON) {
        return false;
      }
      if (!keyValuesEqual(prop.keyValue(k + 1), keys[k].value)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  return true;
}

function layerKeysMatchSnapshot(layer, snapshot) {
  for (var i = 0; i < snapshot.length; i++) {
    var prop = resolvePropByMatchNames(layer, snapshot[i].matchNames);
    if (!prop || !propertyKeysMatchSnapshot(prop, snapshot[i].keys)) return false;
  }
  return true;
}

function collectKeyframeDrift(layer, snapshot) {
  var drift = [];
  var truncated = false;
  for (var i = 0; i < snapshot.length; i++) {
    var entry = snapshot[i];
    var prop = resolvePropByMatchNames(layer, entry.matchNames);
    var beforeTime = entry.keys.length ? entry.keys[0].time : null;
    var afterTime = null;
    var drifted = false;
    if (!prop) {
      drifted = true;
    } else {
      try {
        if (prop.numKeys !== entry.keys.length) {
          drifted = true;
          if (prop.numKeys > 0) afterTime = prop.keyTime(1);
        } else {
          for (var k = 0; k < entry.keys.length; k++) {
            var gotTime = prop.keyTime(k + 1);
            if (
              Math.abs(Number(gotTime) - Number(entry.keys[k].time)) >= KEY_TIME_EPSILON ||
              !keyValuesEqual(prop.keyValue(k + 1), entry.keys[k].value)
            ) {
              drifted = true;
              beforeTime = entry.keys[k].time;
              afterTime = gotTime;
              break;
            }
          }
        }
      } catch (e) {
        drifted = true;
      }
    }
    if (!drifted) continue;
    if (drift.length < KEYFRAME_DRIFT_CAP) {
      drift.push({
        matchNames: entry.matchNames,
        beforeTime: beforeTime,
        afterTime: afterTime,
      });
    } else {
      truncated = true;
    }
  }
  return { drift: drift, truncated: truncated };
}

function restorePropertyKeys(prop, keys) {
  clearPropertyKeys(prop);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var idx = prop.addKey(key.time);
    try {
      prop.setValueAtKey(idx, key.value);
    } catch (e) {
      try {
        prop.setValueAtTime(key.time, key.value);
        idx = prop.nearestKeyIndex(key.time);
      } catch (e2) {}
    }
    try {
      if (key.inInterp !== undefined && key.outInterp !== undefined) {
        prop.setInterpolationTypeAtKey(idx, key.inInterp, key.outInterp);
      }
    } catch (e) {}
    try {
      if (key.inEase !== undefined && key.outEase !== undefined) {
        prop.setTemporalEaseAtKey(idx, key.inEase, key.outEase);
      }
    } catch (e) {}
    try {
      if (key.inSpatial !== undefined && key.outSpatial !== undefined) {
        prop.setSpatialTangentsAtKey(idx, key.inSpatial, key.outSpatial);
      }
    } catch (e) {}
    try {
      if (key.temporalContinuous !== undefined) {
        prop.setTemporalContinuousAtKey(idx, key.temporalContinuous);
      }
    } catch (e) {}
    try {
      if (key.temporalAutoBezier !== undefined) {
        prop.setTemporalAutoBezierAtKey(idx, key.temporalAutoBezier);
      }
    } catch (e) {}
    try {
      if (key.spatialContinuous !== undefined) {
        prop.setSpatialContinuousAtKey(idx, key.spatialContinuous);
      }
    } catch (e) {}
    try {
      if (key.spatialAutoBezier !== undefined) {
        prop.setSpatialAutoBezierAtKey(idx, key.spatialAutoBezier);
      }
    } catch (e) {}
    try {
      if (key.roving !== undefined) {
        prop.setRovingAtKey(idx, key.roving);
      }
    } catch (e) {}
  }
}

function restoreLayerKeyframes(layer, snapshot) {
  for (var i = 0; i < snapshot.length; i++) {
    var prop = resolvePropByMatchNames(layer, snapshot[i].matchNames);
    if (!prop) continue;
    if (!propertyKeysMatchSnapshot(prop, snapshot[i].keys)) {
      restorePropertyKeys(prop, snapshot[i].keys);
    }
  }
}

export function applySetLayerTiming(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var frameRate = t.comp.frameRate;
  var before = readLayerTimingFrames(t.layer, frameRate);
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    before: before,
  };
  if (layerTimingPostConditionError(op, before, before, frameRate) === null) {
    targetResult.status = "already_satisfied";
    targetResult.after = before;
    targetResult.keyframesPreserved = true;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  var keySnapshot = snapshotLayerKeyframes(t.layer);
  try {
    if (op.startFrame !== undefined) {
      t.layer.startTime = frameToTime(op.startFrame, frameRate);
    }
    if (op.inFrame !== undefined) {
      t.layer.inPoint = frameToTime(op.inFrame, frameRate);
    }
    if (op.outFrame !== undefined) {
      t.layer.outPoint = frameToTime(op.outFrame, frameRate);
    }
    if (op.stretch !== undefined) {
      t.layer.stretch = op.stretch;
    }
    if (keySnapshot.length > 0 && !layerKeysMatchSnapshot(t.layer, keySnapshot)) {
      restoreLayerKeyframes(t.layer, keySnapshot);
    }
    var after = readLayerTimingFrames(t.layer, frameRate);
    targetResult.after = after;
    var postErr = layerTimingPostConditionError(op, after, before, frameRate);
    if (postErr !== null) {
      targetResult.status = "failed";
      targetResult.message = postErr;
      targetResult.keyframesPreserved =
        keySnapshot.length === 0 || layerKeysMatchSnapshot(t.layer, keySnapshot);
      opResult.targets.push(targetResult);
      return {
        anyChanged: true,
        anyFailed: true,
        applyError: targetResult.message,
      };
    }
    if (keySnapshot.length > 0 && !layerKeysMatchSnapshot(t.layer, keySnapshot)) {
      var driftInfo = collectKeyframeDrift(t.layer, keySnapshot);
      targetResult.status = "failed";
      targetResult.message = "Post-condition failed: keyframes not preserved after timing write";
      targetResult.keyframesPreserved = false;
      targetResult.keyframeDrift = driftInfo.drift;
      if (driftInfo.truncated) targetResult.keyframeDriftTruncated = true;
      opResult.targets.push(targetResult);
      return {
        anyChanged: true,
        anyFailed: true,
        applyError: targetResult.message,
      };
    }
    targetResult.status = "changed";
    targetResult.keyframesPreserved = true;
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: false, applyError: null };
  } catch (te) {
    targetResult.status = "failed";
    targetResult.message = String(te);
    targetResult.keyframesPreserved = false;
    var timingMutated = true;
    try {
      targetResult.after = readLayerTimingFrames(t.layer, frameRate);
      timingMutated = JSON.stringify(targetResult.after) !== JSON.stringify(before);
    } catch (ae) {
      timingMutated = true;
    }
    opResult.targets.push(targetResult);
    return {
      anyChanged: timingMutated,
      anyFailed: true,
      applyError: String(te),
    };
  }
}

export function applySetLayerSwitches(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var switches = op.switches || {};
  var before = readLayerSwitches(t.layer);
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    before: before,
  };
  var writeKeys = orderedSwitchWriteKeys(switches);
  if (writeKeys.length === 0) {
    targetResult.message = "No switch keys supplied";
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var inapplicable = [];
  var i;
  for (i = 0; i < writeKeys.length; i++) {
    if (before[writeKeys[i]] === undefined) {
      inapplicable.push(writeKeys[i]);
    }
  }
  if (inapplicable.length > 0) {
    targetResult.after = before;
    targetResult.message = "Switch key(s) not applicable on this layer: " + inapplicable.join(", ");
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var already = true;
  for (i = 0; i < writeKeys.length; i++) {
    if (before[writeKeys[i]] !== !!switches[writeKeys[i]]) {
      already = false;
      break;
    }
  }
  if (already) {
    targetResult.status = "already_satisfied";
    targetResult.after = before;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    for (i = 0; i < writeKeys.length; i++) {
      setLayerSwitchValue(t.layer, writeKeys[i], switches[writeKeys[i]]);
    }
    var after = readLayerSwitches(t.layer);
    targetResult.after = after;
    var mismatched = [];
    for (i = 0; i < writeKeys.length; i++) {
      var key = writeKeys[i];
      if (after[key] === undefined || after[key] !== !!switches[key]) {
        mismatched.push(key);
      }
    }
    if (mismatched.length === 0) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message =
      "Post-condition failed: switch(es) did not match request: " + mismatched.join(", ");
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (se) {
    targetResult.status = "failed";
    targetResult.message = String(se);
    var switchMutated = true;
    try {
      targetResult.after = readLayerSwitches(t.layer);
      switchMutated = JSON.stringify(targetResult.after) !== JSON.stringify(before);
    } catch (ae) {
      switchMutated = true;
    }
    opResult.targets.push(targetResult);
    return {
      anyChanged: switchMutated,
      anyFailed: true,
      applyError: String(se),
    };
  }
}

export function applySetLayerTransform(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var transform = op.transform || {};
  var before = readLayerTransform(t.layer);
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    before: before,
  };
  var writeKeys = orderedTransformWriteKeys(transform);
  if (writeKeys.length === 0) {
    targetResult.message = "No transform keys supplied";
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var i;
  var key;
  var prop;
  var inapplicable = [];
  var lengthMismatch = [];
  var coerced = {};
  for (i = 0; i < writeKeys.length; i++) {
    key = writeKeys[i];
    prop = getTransformProp(t.layer, key);
    if (!prop || before[key] === undefined) {
      inapplicable.push(key);
      continue;
    }
    var want = transform[key];
    var cur = before[key];
    var wantArr = isAeArray(want);
    var curArr = isAeArray(cur);
    if (wantArr !== curArr) {
      lengthMismatch.push(key);
      continue;
    }
    if (wantArr && curArr) {
      var coercedWant = coerceTransformArray(want, cur);
      if (!isAeArray(coercedWant) || coercedWant.length !== cur.length) {
        lengthMismatch.push(key);
        continue;
      }
      coerced[key] = coercedWant;
    } else {
      coerced[key] = want;
    }
  }
  if (inapplicable.length > 0) {
    targetResult.after = before;
    targetResult.message =
      "Transform key(s) not applicable on this layer: " + inapplicable.join(", ");
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var keyframed = keyframedTransformKeys(t.layer, writeKeys);
  if (keyframed.length > 0) {
    targetResult.after = before;
    targetResult.message =
      "Refusing keyframed transform propert" +
      (keyframed.length === 1 ? "y" : "ies") +
      " (numKeys > 0): " +
      keyframed.join(", ") +
      "; clear keys first via reset_layer_surface (clearKeyframes)";
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  if (lengthMismatch.length > 0) {
    targetResult.after = before;
    targetResult.message = "Transform array length mismatch for: " + lengthMismatch.join(", ");
    opResult.targets.push(targetResult);
    return {
      anyChanged: false,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var already = true;
  for (i = 0; i < writeKeys.length; i++) {
    key = writeKeys[i];
    if (!transformValuesEqual(before[key], coerced[key])) {
      already = false;
      break;
    }
  }
  if (already) {
    targetResult.status = "already_satisfied";
    targetResult.after = before;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    var written = writeAndVerifyTransforms(t.layer, coerced, writeKeys);
    targetResult.after = written.after;
    if (written.writeError) {
      targetResult.status = "failed";
      targetResult.message = written.writeError;
      var xfMutated = JSON.stringify(written.after) !== JSON.stringify(before);
      opResult.targets.push(targetResult);
      return {
        anyChanged: xfMutated,
        anyFailed: true,
        applyError: targetResult.message,
      };
    }
    if (written.mismatched.length === 0) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message =
      "Post-condition failed: transform key(s) did not match request: " +
      written.mismatched.join(", ");
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (xe) {
    targetResult.status = "failed";
    targetResult.message = String(xe);
    // Mid-loop AE errors may have already mutated some keys -- mark mutated so batch undo runs.
    var xfCatchMutated = true;
    try {
      targetResult.after = readLayerTransform(t.layer);
      xfCatchMutated = JSON.stringify(targetResult.after) !== JSON.stringify(before);
    } catch (ae) {
      xfCatchMutated = true;
    }
    opResult.targets.push(targetResult);
    return {
      anyChanged: xfCatchMutated,
      anyFailed: true,
      applyError: String(xe),
    };
  }
}

export function applySetPropertyExpression(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    selector: {},
  };
  if (op.matchNames && op.matchNames.length > 0) {
    targetResult.selector.matchNames = op.matchNames;
  }
  if (op.propertyPath) {
    targetResult.selector.propertyPath = op.propertyPath;
  }
  var resolved = resolvePropertySelector(t.layer, op);
  if (resolved.error) {
    targetResult.message = resolved.error;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: resolved.error };
  }
  var prop = resolved.prop;
  targetResult.resolvedMatchNames = resolved.matchNames;
  var beforeExpr = "";
  var beforeEnabled = false;
  try {
    beforeExpr = String(prop.expression || "");
  } catch (e) {}
  try {
    beforeEnabled = !!prop.expressionEnabled;
  } catch (e2) {}
  targetResult.before = {
    expression: beforeExpr,
    expressionEnabled: beforeEnabled,
  };
  var wantClear = op.expression === null;
  var wantExpr = wantClear ? "" : String(op.expression);
  var wantEnabled = wantClear ? false : op.expressionEnabled !== false;
  if (beforeExpr === wantExpr && beforeEnabled === wantEnabled) {
    targetResult.status = "already_satisfied";
    targetResult.after = {
      expression: beforeExpr,
      expressionEnabled: beforeEnabled,
    };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  try {
    if (wantClear) {
      prop.expression = "";
      prop.expressionEnabled = false;
    } else {
      prop.expression = wantExpr;
      prop.expressionEnabled = wantEnabled;
    }
    var afterExpr = "";
    var afterEnabled = false;
    try {
      afterExpr = String(prop.expression || "");
    } catch (ae) {}
    try {
      afterEnabled = !!prop.expressionEnabled;
    } catch (ae2) {}
    targetResult.after = {
      expression: afterExpr,
      expressionEnabled: afterEnabled,
    };
    if (afterExpr === wantExpr && afterEnabled === wantEnabled) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: authored expression fields did not match";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (xe) {
    targetResult.status = "failed";
    targetResult.message = String(xe);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(xe) };
  }
}

// ===== set_property_keyframes: guarded property-scoped keyframe management =====
// Bounds mirror src/patch/schema.ts (PROPERTY_KEYFRAME_MAX_KEYS / _MAX_PATH_SEGMENTS).

var PKF_MAX_KEYS = 1024;
var PKF_MAX_PATH_SEGMENTS = 32;
var PKF_MAX_PRESERVATION_NODES = 4096;
var PKF_MAX_PRESERVATION_KEYS = 4096;
var PKF_TIME_EPSILON = 1e-7;
var PKF_VALUE_EPSILON = 1e-6;
var PKF_DRIFT_CAP = 8;

function pkfInterpEnum(name) {
  if (name === "LINEAR") return KeyframeInterpolationType.LINEAR;
  if (name === "BEZIER") return KeyframeInterpolationType.BEZIER;
  return KeyframeInterpolationType.HOLD;
}

function pkfInterpName(value) {
  if (value === KeyframeInterpolationType.LINEAR) return "LINEAR";
  if (value === KeyframeInterpolationType.BEZIER) return "BEZIER";
  if (value === KeyframeInterpolationType.HOLD) return "HOLD";
  return null;
}

function pkfValueTypeName(t) {
  var PVT = PropertyValueType;
  if (t === PVT.OneD) return "OneD";
  if (t === PVT.TwoD) return "TwoD";
  if (t === PVT.ThreeD) return "ThreeD";
  if (t === PVT.TwoD_SPATIAL) return "TwoD_SPATIAL";
  if (t === PVT.ThreeD_SPATIAL) return "ThreeD_SPATIAL";
  if (t === PVT.COLOR) return "COLOR";
  if (t === PVT.NO_VALUE) return "NO_VALUE";
  if (t === PVT.TEXT_DOCUMENT) return "TEXT_DOCUMENT";
  if (t === PVT.MARKER) return "MARKER";
  if (t === PVT.SHAPE) return "SHAPE";
  if (t === PVT.MASK_INDEX) return "MASK_INDEX";
  if (t === PVT.LAYER_INDEX) return "LAYER_INDEX";
  return "UNSUPPORTED";
}

// Supported numeric domains. easeDim follows the Scripting Guide: TwoD -> 2 ease
// objects, ThreeD -> 3, all other supported types (including spatial) -> 1.
function pkfValueTypeInfo(prop) {
  var t = null;
  try {
    t = prop.propertyValueType;
  } catch (e) {
    return null;
  }
  var PVT = PropertyValueType;
  if (t === PVT.OneD) return { typeName: "OneD", dim: 1, easeDim: 1, spatial: false };
  if (t === PVT.TwoD) return { typeName: "TwoD", dim: 2, easeDim: 2, spatial: false };
  if (t === PVT.ThreeD) return { typeName: "ThreeD", dim: 3, easeDim: 3, spatial: false };
  if (t === PVT.TwoD_SPATIAL)
    return { typeName: "TwoD_SPATIAL", dim: 2, easeDim: 1, spatial: true };
  if (t === PVT.ThreeD_SPATIAL)
    return { typeName: "ThreeD_SPATIAL", dim: 3, easeDim: 1, spatial: true };
  if (t === PVT.COLOR) return { typeName: "COLOR", dim: 4, easeDim: 1, spatial: false };
  return null;
}

function pkfNormalizeNumericValue(raw) {
  if (typeof raw === "number") {
    return isNaN(raw) ? null : raw;
  }
  if (raw !== null && raw !== undefined && raw.length !== undefined && typeof raw !== "string") {
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var n = Number(raw[i]);
      if (isNaN(n)) return null;
      out.push(n);
    }
    return out;
  }
  return null;
}

// Value shape rules: AE normalizes extra vector components per property (Scale keeps
// its default z on 2D layers; Position/Anchor use z 0), so callers supply a scalar or a
// 2/3-component vector (exactly 4 for COLOR) and LayerCake verifies the supplied
// components rather than an AE-normalized tail.
function pkfValueShapeOk(value, info) {
  if (typeof value === "number") return info.dim === 1;
  if (value === null || value === undefined || value.length === undefined) return false;
  if (info.dim === 1) return false;
  if (info.typeName === "COLOR") return value.length === 4;
  return value.length === 2 || value.length === 3;
}

// Compare only the components the caller supplied (AE may append/normalize the tail).
function pkfValuePrefixMatches(actual, want, epsilon) {
  if (typeof want === "number")
    return typeof actual === "number" ? Math.abs(actual - want) <= epsilon : false;
  if (actual === null || actual === undefined || actual.length === undefined) return false;
  if (actual.length < want.length) return false;
  for (var i = 0; i < want.length; i++) {
    if (Math.abs(Number(actual[i]) - Number(want[i])) > epsilon) return false;
  }
  return true;
}

function pkfValuesEqual(a, b, epsilon) {
  var aNum = typeof a === "number";
  var bNum = typeof b === "number";
  if (aNum !== bNum) return false;
  if (aNum) return Math.abs(a - b) <= epsilon;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (Math.abs(Number(a[i]) - Number(b[i])) > epsilon) return false;
  }
  return true;
}

function pkfEaseArraysEqual(a, b) {
  var aMissing = a === undefined || a === null;
  var bMissing = b === undefined || b === null;
  if (aMissing && bMissing) return true;
  if (aMissing || bMissing) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (Math.abs(Number(a[i].speed) - Number(b[i].speed)) > PKF_VALUE_EPSILON) return false;
    if (Math.abs(Number(a[i].influence) - Number(b[i].influence)) > PKF_VALUE_EPSILON) return false;
  }
  return true;
}

function pkfTangentsNormalized(tangent) {
  if (!tangent || tangent.length === 0) return false;
  for (var i = 0; i < tangent.length; i++) {
    if (Math.abs(Number(tangent[i])) > PKF_VALUE_EPSILON) return false;
  }
  return true;
}

function pkfSerializeEase(ease) {
  if (!ease) return null;
  var out = [];
  try {
    for (var i = 0; i < ease.length; i++) {
      out.push({
        speed: Number(ease[i].speed),
        influence: Number(ease[i].influence),
      });
    }
  } catch (e) {
    return null;
  }
  return out;
}

function pkfEaseObjects(points) {
  var out = [];
  for (var i = 0; i < points.length; i++) {
    out.push(new KeyframeEase(Number(points[i].speed), Number(points[i].influence)));
  }
  return out;
}

// Strict unique property walk: each segment resolves to exactly one child by
// exact matchName or exact display name. Ambiguity and misses fail before mutation.
function pkfResolveSegments(layer, segments) {
  var cur = layer;
  var identity = [];
  var matchNames = [];
  var indexPath = [];
  var i;
  var c;
  for (i = 0; i < segments.length; i++) {
    var seg = String(segments[i]);
    if (!seg) {
      return {
        error: "Empty property path segment at position " + (i + 1),
        prop: null,
        identity: identity,
        matchNames: matchNames,
        indexPath: indexPath,
      };
    }
    var count = 0;
    try {
      count = cur.numProperties;
    } catch (ne) {
      return {
        error: "Property segment parent is not a group: " + seg,
        prop: null,
        identity: identity,
        matchNames: matchNames,
        indexPath: indexPath,
      };
    }
    var matches = [];
    var matchPositions = [];
    for (c = 1; c <= count; c++) {
      var child = null;
      try {
        child = cur.property(c);
      } catch (ce) {
        continue;
      }
      if (!child) continue;
      var matched = false;
      try {
        if (String(child.matchName) === seg) matched = true;
      } catch (me) {}
      if (!matched) {
        try {
          if (String(child.name) === seg) matched = true;
        } catch (ne2) {}
      }
      if (matched) {
        matches.push(child);
        matchPositions.push(c);
      }
    }
    if (matches.length === 0) {
      return {
        error: "Property not found for segment: " + seg,
        prop: null,
        identity: identity,
        matchNames: matchNames,
        indexPath: indexPath,
      };
    }
    if (matches.length > 1) {
      return {
        error:
          "Ambiguous property segment '" +
          seg +
          "' matched " +
          matches.length +
          " children; use a unique segment (effect display name or deeper path)",
        prop: null,
        identity: identity,
        matchNames: matchNames,
        indexPath: indexPath,
      };
    }
    cur = matches[0];
    var pos = matchPositions[0];
    var id = { matchName: "", name: "", index: pos };
    try {
      id.matchName = String(cur.matchName || "");
    } catch (e) {}
    try {
      id.name = String(cur.name || "");
    } catch (e2) {}
    identity.push(id);
    matchNames.push(id.matchName);
    indexPath.push(pos);
  }
  var isLeaf = false;
  try {
    isLeaf = cur.propertyType === PropertyType.PROPERTY;
  } catch (pe) {
    return {
      error: "Resolved property could not be inspected",
      prop: null,
      identity: identity,
      matchNames: matchNames,
      indexPath: indexPath,
    };
  }
  if (!isLeaf) {
    return {
      error: "Resolved path is not a property leaf (PropertyType.PROPERTY)",
      prop: null,
      identity: identity,
      matchNames: matchNames,
      indexPath: indexPath,
    };
  }
  return {
    error: null,
    prop: cur,
    identity: identity,
    matchNames: matchNames,
    indexPath: indexPath,
  };
}

function pkfReadKeyEntry(prop, index, info) {
  var entry = null;
  try {
    entry = {
      time: Number(prop.keyTime(index)),
      value: pkfNormalizeNumericValue(prop.keyValue(index)),
    };
  } catch (e) {
    return null;
  }
  if (!entry || entry.value === null) return null;
  try {
    entry.inInterpolationType = pkfInterpName(prop.keyInInterpolationType(index));
  } catch (e2) {}
  try {
    entry.outInterpolationType = pkfInterpName(prop.keyOutInterpolationType(index));
  } catch (e3) {}
  try {
    entry.inEase = pkfSerializeEase(prop.keyInTemporalEase(index));
  } catch (e4) {}
  try {
    entry.outEase = pkfSerializeEase(prop.keyOutTemporalEase(index));
  } catch (e5) {}
  try {
    entry.temporalContinuous = !!prop.keyTemporalContinuous(index);
  } catch (e6) {}
  try {
    entry.temporalAutoBezier = !!prop.keyTemporalAutoBezier(index);
  } catch (e7) {}
  if (info.spatial) {
    try {
      entry.inSpatialTangent = pkfNormalizeNumericValue(prop.keyInSpatialTangent(index));
    } catch (e8) {}
    try {
      entry.outSpatialTangent = pkfNormalizeNumericValue(prop.keyOutSpatialTangent(index));
    } catch (e9) {}
    try {
      entry.spatialContinuous = !!prop.keySpatialContinuous(index);
    } catch (e10) {}
    try {
      entry.spatialAutoBezier = !!prop.keySpatialAutoBezier(index);
    } catch (e11) {}
    try {
      entry.roving = !!prop.keyRoving(index);
    } catch (e12) {}
  }
  return entry;
}

function pkfReadTimelineSnapshot(prop, info) {
  var numKeys = 0;
  try {
    numKeys = prop.numKeys;
  } catch (e) {
    return null;
  }
  var entries = [];
  for (var k = 1; k <= numKeys; k++) {
    var entry = pkfReadKeyEntry(prop, k, info);
    if (!entry) return null;
    entries.push(entry);
  }
  return { numKeys: numKeys, keyframes: entries };
}

// Authored-animation equality for stale detection and sibling preservation.
// Compares key times, values, interpolation types, and ease only on Bezier sides.
// AE-derived metadata (auto ease on linear keys, spatial tangents/continuity/roving
// flags) is excluded: AE may recompute it during evaluation, and it is not something
// the caller authored. Full metadata still appears in before/after evidence.
function pkfKeyEntriesEqual(ka, kb) {
  if (Math.abs(ka.time - kb.time) > PKF_TIME_EPSILON) return false;
  if (!pkfValuesEqual(ka.value, kb.value, PKF_VALUE_EPSILON)) return false;
  if (ka.inInterpolationType !== kb.inInterpolationType) return false;
  if (ka.outInterpolationType !== kb.outInterpolationType) return false;
  if (ka.inInterpolationType === "BEZIER" && !pkfEaseArraysEqual(ka.inEase, kb.inEase)) {
    return false;
  }
  if (ka.outInterpolationType === "BEZIER" && !pkfEaseArraysEqual(ka.outEase, kb.outEase)) {
    return false;
  }
  return true;
}

function pkfSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.numKeys !== b.numKeys) return false;
  for (var i = 0; i < a.numKeys; i++) {
    if (!pkfKeyEntriesEqual(a.keyframes[i], b.keyframes[i])) return false;
  }
  return true;
}

// Read the property's current static value. Returns null when AE refuses the
// read or yields a non-numeric value; clear-mode evidence stays honest either way.
function pkfReadStaticValue(prop) {
  var v = null;
  try {
    v = pkfNormalizeNumericValue(prop.value);
  } catch (e) {}
  return v;
}

// In-place recreation of an earlier timeline after a refused write (AE refuses
// setValue on a hidden property once its keys are gone). Field writes are
// best-effort; the re-read comparison is the contract, so a partial or refused
// write reports verified:false instead of claiming a restoration that did not land.
function pkfRestoreTimeline(prop, snapshot, info) {
  try {
    for (var removeIndex = prop.numKeys; removeIndex >= 1; removeIndex--) {
      prop.removeKey(removeIndex);
    }
  } catch (e0) {}
  for (var i = 0; i < snapshot.keyframes.length; i++) {
    var entry = snapshot.keyframes[i];
    var idx = null;
    try {
      idx = prop.addKey(entry.time);
    } catch (ea) {
      break;
    }
    try {
      prop.setValueAtKey(idx, entry.value);
    } catch (ev) {}
    try {
      if (entry.inInterpolationType) {
        var inEnum = pkfInterpEnum(entry.inInterpolationType);
        var outEnum = entry.outInterpolationType
          ? pkfInterpEnum(entry.outInterpolationType)
          : inEnum;
        prop.setInterpolationTypeAtKey(idx, inEnum, outEnum);
      }
    } catch (ei) {}
    try {
      if (entry.inInterpolationType === "BEZIER" && entry.inEase && entry.outEase) {
        prop.setTemporalEaseAtKey(idx, pkfEaseObjects(entry.inEase), pkfEaseObjects(entry.outEase));
      }
    } catch (ee) {}
    try {
      if (entry.temporalContinuous !== undefined) {
        prop.setTemporalContinuousAtKey(idx, entry.temporalContinuous);
      }
    } catch (tc) {}
    try {
      if (entry.temporalAutoBezier !== undefined) {
        prop.setTemporalAutoBezierAtKey(idx, entry.temporalAutoBezier);
      }
    } catch (ta) {}
    if (info.spatial) {
      try {
        if (entry.inSpatialTangent && entry.outSpatialTangent) {
          prop.setSpatialTangentsAtKey(idx, entry.inSpatialTangent, entry.outSpatialTangent);
        }
      } catch (st) {}
      try {
        if (entry.spatialContinuous !== undefined) {
          prop.setSpatialContinuousAtKey(idx, entry.spatialContinuous);
        }
      } catch (sc) {}
      try {
        if (entry.spatialAutoBezier !== undefined) {
          prop.setSpatialAutoBezierAtKey(idx, entry.spatialAutoBezier);
        }
      } catch (sa) {}
      try {
        if (entry.roving !== undefined) prop.setRovingAtKey(idx, entry.roving);
      } catch (ro) {}
    }
  }
  var now = pkfReadTimelineSnapshot(prop, info);
  return {
    attempted: true,
    verified: !!now && pkfSnapshotsEqual(now, snapshot),
  };
}

// Desired-state comparison: deterministic timeline including normalization flags
// (temporal continuous/auto-Bezier off; spatial keys normalized to straight paths).
function pkfTimelineMatchesDesired(snapshot, desiredEntries, info) {
  if (!snapshot) return false;
  if (snapshot.numKeys !== desiredEntries.length) return false;
  for (var i = 0; i < desiredEntries.length; i++) {
    var want = desiredEntries[i];
    var got = snapshot.keyframes[i];
    if (Math.abs(got.time - want.time) > PKF_TIME_EPSILON) return false;
    if (!pkfValuePrefixMatches(got.value, want.value, PKF_VALUE_EPSILON)) return false;
    if (got.inInterpolationType !== want.inType) return false;
    if (got.outInterpolationType !== want.outType) return false;
    if (want.inType === "BEZIER" && (!got.inEase || !pkfEaseArraysEqual(got.inEase, want.inEase))) {
      return false;
    }
    if (
      want.outType === "BEZIER" &&
      (!got.outEase || !pkfEaseArraysEqual(got.outEase, want.outEase))
    ) {
      return false;
    }
    if (got.temporalContinuous !== false) return false;
    if (got.temporalAutoBezier !== false) return false;
    if (info.spatial) {
      if (!pkfTangentsNormalized(got.inSpatialTangent)) return false;
      if (!pkfTangentsNormalized(got.outSpatialTangent)) return false;
      if (got.spatialContinuous !== false) return false;
      if (got.spatialAutoBezier !== false) return false;
      if (got.roving !== false) return false;
    }
  }
  return true;
}

function pkfReadExpressionState(prop) {
  var state = { expression: "", expressionEnabled: false };
  try {
    state.expression = String(prop.expression || "");
  } catch (e) {}
  try {
    state.expressionEnabled = !!prop.expressionEnabled;
  } catch (e2) {}
  return state;
}

function pkfExpressionStatesEqual(a, b) {
  return a.expression === b.expression && a.expressionEnabled === b.expressionEnabled;
}

function pkfInterpolationSupported(prop, name) {
  try {
    return !!prop.isInterpolationTypeValid(pkfInterpEnum(name));
  } catch (e) {
    return false;
  }
}

function pkfWalkPreservation(group, indexPath, matchPath, targetIndexPath, state) {
  var count = 0;
  try {
    count = group.numProperties;
  } catch (e) {
    return;
  }
  for (var i = 1; i <= count; i++) {
    if (state.error) return;
    state.nodes++;
    if (state.nodes > PKF_MAX_PRESERVATION_NODES) {
      state.error =
        "Preservation walk exceeded " +
        PKF_MAX_PRESERVATION_NODES +
        " property nodes on the target layer";
      return;
    }
    var child = null;
    try {
      child = group.property(i);
    } catch (ce) {
      continue;
    }
    if (!child) continue;
    var childIndex = indexPath.concat([i]);
    var childMatch = "";
    try {
      childMatch = String(child.matchName || "");
    } catch (me) {}
    var childMatchPath = matchPath.concat([childMatch]);
    var isGroup = false;
    try {
      isGroup = child.propertyType !== PropertyType.PROPERTY;
    } catch (pe) {
      continue;
    }
    if (isGroup) {
      pkfWalkPreservation(child, childIndex, childMatchPath, targetIndexPath, state);
      continue;
    }
    var numKeys = 0;
    try {
      numKeys = child.numKeys;
    } catch (ke) {
      continue;
    }
    if (!numKeys) continue;
    if (pkfIndexPathsEqual(childIndex, targetIndexPath)) continue;
    var info = pkfValueTypeInfo(child);
    if (!info) {
      var t = null;
      try {
        t = child.propertyValueType;
      } catch (te) {}
      state.error =
        "Cannot faithfully compare keyed sibling property (unsupported value type " +
        pkfValueTypeName(t) +
        "): " +
        childMatchPath.join("/");
      return;
    }
    state.checkedKeys += numKeys;
    if (state.checkedKeys > PKF_MAX_PRESERVATION_KEYS) {
      state.error =
        "Preservation walk exceeded " +
        PKF_MAX_PRESERVATION_KEYS +
        " sibling keys on the target layer";
      return;
    }
    var keys = [];
    for (var k = 1; k <= numKeys; k++) {
      var entry = pkfReadKeyEntry(child, k, info);
      if (!entry) {
        state.error = "Could not read sibling keyframes for: " + childMatchPath.join("/");
        return;
      }
      keys.push(entry);
    }
    state.entries.push({
      key: childIndex.join("."),
      matchNames: childMatchPath,
      numKeys: numKeys,
      keys: keys,
    });
    state.checkedProperties++;
  }
}

function pkfIndexPathsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Snapshot keyed siblings of the target leaf (position-based index paths are
// unique even under duplicate effect instances). Opaque keyed siblings fail
// closed; budgets bound the walk before any evidence is built.
function pkfCapturePreservation(layer, targetIndexPath) {
  var state = {
    error: null,
    entries: [],
    checkedProperties: 0,
    checkedKeys: 0,
    nodes: 0,
  };
  pkfWalkPreservation(layer, [], [], targetIndexPath, state);
  return state;
}

function pkfPreservationsEqual(baseline, after) {
  var drift = [];
  var truncated = false;
  function pushDrift(matchNames, beforeTime, afterTime) {
    if (drift.length >= PKF_DRIFT_CAP) {
      truncated = true;
      return;
    }
    drift.push({
      matchNames: matchNames,
      beforeTime: beforeTime,
      afterTime: afterTime,
    });
  }
  var afterByKey = {};
  var baselineByKey = {};
  var ai;
  var bi;
  for (ai = 0; ai < after.entries.length; ai++) {
    afterByKey[after.entries[ai].key] = after.entries[ai];
  }
  for (bi = 0; bi < baseline.entries.length; bi++) {
    baselineByKey[baseline.entries[bi].key] = baseline.entries[bi];
  }
  for (bi = 0; bi < baseline.entries.length; bi++) {
    var entry = baseline.entries[bi];
    var afterEntry = afterByKey[entry.key];
    if (!afterEntry) {
      pushDrift(entry.matchNames, entry.keys.length ? entry.keys[0].time : null, null);
      continue;
    }
    if (entry.numKeys !== afterEntry.numKeys) {
      pushDrift(
        entry.matchNames,
        entry.keys.length ? entry.keys[0].time : null,
        afterEntry.keys.length ? afterEntry.keys[0].time : null,
      );
      continue;
    }
    for (var k = 0; k < entry.keys.length; k++) {
      if (!pkfKeyEntriesEqual(entry.keys[k], afterEntry.keys[k])) {
        pushDrift(
          entry.matchNames,
          entry.keys[k].time,
          afterEntry.keys[k] ? afterEntry.keys[k].time : null,
        );
        break;
      }
    }
  }
  for (ai = 0; ai < after.entries.length; ai++) {
    var extra = after.entries[ai];
    if (!baselineByKey[extra.key]) {
      pushDrift(extra.matchNames, null, extra.keys.length ? extra.keys[0].time : null);
    }
  }
  return { unchanged: drift.length === 0, drift: drift, truncated: truncated };
}

// Full no-write preflight: runs at resolve time, before the batch undo group,
// so an invalid keyframe op never lets earlier batch ops mutate first.
export function preflightSetPropertyKeyframes(op, comp, layer) {
  var segments = null;
  if (op.matchNames && op.matchNames.length > 0) {
    segments = op.matchNames;
  } else if (op.propertyPath) {
    segments = parsePropertyPathSegments(op.propertyPath);
  } else {
    return { error: "Provide exactly one of matchNames or propertyPath" };
  }
  if (segments.length > PKF_MAX_PATH_SEGMENTS) {
    return {
      error: "Property path exceeds " + PKF_MAX_PATH_SEGMENTS + " segments",
    };
  }
  var resolved = pkfResolveSegments(layer, segments);
  if (resolved.error) return { error: resolved.error };
  var prop = resolved.prop;
  var leafMatchName = resolved.matchNames[resolved.matchNames.length - 1];
  if (leafMatchName === "ADBE Time Remap") {
    return {
      error: "Time Remap is not supported by set_property_keyframes (structural side effects)",
    };
  }
  try {
    if (prop.isSeparationFollower) {
      return {
        error: "Separation follower properties are not supported: " + leafMatchName,
      };
    }
  } catch (se) {}
  try {
    if (prop.isSeparationLeader && prop.dimensionsSeparated) {
      return {
        error: "Property has separated dimensions; consolidate them first: " + leafMatchName,
      };
    }
  } catch (se2) {}
  var canVary = false;
  try {
    canVary = !!prop.canVaryOverTime;
  } catch (ce) {}
  if (!canVary) {
    return {
      error: "Property cannot vary over time (not keyframeable): " + leafMatchName,
    };
  }
  var info = pkfValueTypeInfo(prop);
  if (!info) {
    var vt = null;
    try {
      vt = prop.propertyValueType;
    } catch (ve) {}
    return {
      error: "Unsupported property value type (" + pkfValueTypeName(vt) + "): " + leafMatchName,
    };
  }
  var expressionState = pkfReadExpressionState(prop);
  var wantClear = op.expressionHandling === "clear";
  if (!wantClear && expressionState.expressionEnabled && expressionState.expression.length > 0) {
    return {
      error:
        'Target property has an enabled expression; pass expressionHandling "clear" or clear it via set_property_expression: ' +
        leafMatchName,
    };
  }
  var snapshot = pkfReadTimelineSnapshot(prop, info);
  if (!snapshot) return { error: "Could not read current keyframes for: " + leafMatchName };
  if (snapshot.numKeys > PKF_MAX_KEYS) {
    return {
      error: "Observed timeline exceeds " + PKF_MAX_KEYS + " keys: " + leafMatchName,
    };
  }
  // Expected-state guards run before idempotence so a stale guard refuses even
  // when the desired state is already present.
  var expected = op.expected;
  if (expected) {
    if (expected.numKeys !== undefined && expected.numKeys !== snapshot.numKeys) {
      return {
        error:
          "Expected-state guard failed: " +
          leafMatchName +
          " has " +
          snapshot.numKeys +
          " keys, expected " +
          expected.numKeys,
      };
    }
    if (expected.keyframes) {
      if (expected.keyframes.length !== snapshot.numKeys) {
        return {
          error:
            "Expected-state guard failed: " +
            leafMatchName +
            " has " +
            snapshot.numKeys +
            " keys, expected timeline has " +
            expected.keyframes.length,
        };
      }
      for (var ei = 0; ei < expected.keyframes.length; ei++) {
        var want = expected.keyframes[ei];
        var got = snapshot.keyframes[ei];
        if (Math.abs(got.time - want.time) > PKF_TIME_EPSILON) {
          return {
            error:
              "Expected-state guard failed: key " +
              (ei + 1) +
              " time is " +
              got.time +
              ", expected " +
              want.time,
          };
        }
        if (!pkfValuePrefixMatches(got.value, want.value, PKF_VALUE_EPSILON)) {
          return {
            error:
              "Expected-state guard failed: key " + (ei + 1) + " value does not match expectation",
          };
        }
        if (
          want.inInterpolationType !== undefined &&
          got.inInterpolationType !== want.inInterpolationType
        ) {
          return {
            error:
              "Expected-state guard failed: key " +
              (ei + 1) +
              " inInterpolationType is " +
              got.inInterpolationType +
              ", expected " +
              want.inInterpolationType,
          };
        }
        if (
          want.outInterpolationType !== undefined &&
          got.outInterpolationType !== want.outInterpolationType
        ) {
          return {
            error:
              "Expected-state guard failed: key " +
              (ei + 1) +
              " outInterpolationType is " +
              got.outInterpolationType +
              ", expected " +
              want.outInterpolationType,
          };
        }
        if (want.inEase !== undefined && !pkfEaseArraysEqual(got.inEase, want.inEase)) {
          return {
            error:
              "Expected-state guard failed: key " + (ei + 1) + " inEase does not match expectation",
          };
        }
        if (want.outEase !== undefined && !pkfEaseArraysEqual(got.outEase, want.outEase)) {
          return {
            error:
              "Expected-state guard failed: key " +
              (ei + 1) +
              " outEase does not match expectation",
          };
        }
      }
    }
  }
  // Desired state validation.
  var mode = "timeline";
  if (op.clearKeys === true) {
    mode = "clear";
  } else if (op.keyframes === undefined || op.keyframes === null) {
    mode = "static";
  }
  var desiredEntries = [];
  var sampleTime = null;
  var sample = null;
  var i;
  if (mode === "timeline") {
    if (op.keyframes.length > PKF_MAX_KEYS) {
      return { error: "Desired timeline exceeds " + PKF_MAX_KEYS + " keys" };
    }
    var prevTime = null;
    for (i = 0; i < op.keyframes.length; i++) {
      var d = op.keyframes[i];
      if (prevTime !== null && !(d.time > prevTime + PKF_TIME_EPSILON)) {
        return {
          error: "Desired key times must be strictly increasing at index " + i,
        };
      }
      prevTime = d.time;
      if (!pkfValueShapeOk(d.value, info)) {
        return {
          error:
            "Unsupported value shape at key time " +
            d.time +
            " for " +
            info.typeName +
            " (expected " +
            (info.dim === 1
              ? "a number"
              : info.typeName === "COLOR"
                ? "4 components"
                : "2 or 3 components") +
            ")",
        };
      }
      var inType = d.inInterpolationType || "LINEAR";
      var outType = d.outInterpolationType || "LINEAR";
      if (!pkfInterpolationSupported(prop, inType)) {
        return {
          error: leafMatchName + " does not support " + inType + " interpolation",
        };
      }
      if (!pkfInterpolationSupported(prop, outType)) {
        return {
          error: leafMatchName + " does not support " + outType + " interpolation",
        };
      }
      var inEase = null;
      var outEase = null;
      // AE forces BOTH sides to BEZIER when ease is applied; mirror the schema guard.
      if (
        (d.inEase !== undefined || d.outEase !== undefined) &&
        (inType !== "BEZIER" || outType !== "BEZIER")
      ) {
        return {
          error:
            "Temporal ease requires BEZIER interpolation on both sides (AE forces this): " +
            leafMatchName,
        };
      }
      if (inType === "BEZIER") {
        if (!d.inEase || d.inEase.length !== info.easeDim) {
          return {
            error: "inEase must contain " + info.easeDim + " ease point(s) for this property type",
          };
        }
        inEase = d.inEase;
      }
      if (outType === "BEZIER") {
        if (!d.outEase || d.outEase.length !== info.easeDim) {
          return {
            error: "outEase must contain " + info.easeDim + " ease point(s) for this property type",
          };
        }
        outEase = d.outEase;
      }
      desiredEntries.push({
        time: d.time,
        value: d.value,
        inType: inType,
        outType: outType,
        inEase: inEase,
        outEase: outEase,
      });
    }
  } else if (mode === "static") {
    sampleTime = op.staticValueAtTime;
    try {
      sample = pkfNormalizeNumericValue(prop.valueAtTime(sampleTime, true));
    } catch (serr) {}
    if (sample === null || sample === undefined) {
      return {
        error:
          "Could not sample the authored value at time " + sampleTime + " for: " + leafMatchName,
      };
    }
  }
  var expressionNeedsClear =
    wantClear && (expressionState.expression.length > 0 || expressionState.expressionEnabled);
  var alreadySatisfied = false;
  if (mode === "static" || mode === "clear") {
    alreadySatisfied = snapshot.numKeys === 0 && !expressionNeedsClear;
  } else {
    alreadySatisfied =
      pkfTimelineMatchesDesired(snapshot, desiredEntries, info) && !expressionNeedsClear;
  }
  // Preservation walkability: refuse before mutation when sibling keyframes
  // cannot be faithfully compared or budgets are exceeded.
  var pres = pkfCapturePreservation(layer, resolved.indexPath);
  if (pres.error) return { error: pres.error };
  return {
    error: null,
    prop: prop,
    identity: resolved.identity,
    matchNames: resolved.matchNames,
    requestedSegments: segments,
    indexPath: resolved.indexPath,
    info: info,
    before: {
      numKeys: snapshot.numKeys,
      keyframes: snapshot.keyframes,
      expression: expressionState,
    },
    mode: mode,
    desiredEntries: desiredEntries,
    sampleTime: sampleTime,
    sample: sample,
    wantClear: wantClear,
    alreadySatisfied: alreadySatisfied,
  };
}

export function applySetPropertyKeyframes(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var kf = plan.kf;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    selector: {},
  };
  if (op.matchNames && op.matchNames.length > 0) targetResult.selector.matchNames = op.matchNames;
  if (op.propertyPath) targetResult.selector.propertyPath = op.propertyPath;
  targetResult.resolvedMatchNames = kf.matchNames;
  targetResult.resolvedPath = kf.identity;
  targetResult.propertyValueType = kf.info.typeName;
  targetResult.mode = kf.mode;
  if (kf.mode === "static") targetResult.sampleTime = kf.sampleTime;
  targetResult.before = kf.before;

  function readAfterEvidence(prop) {
    var snap = null;
    try {
      snap = pkfReadTimelineSnapshot(prop, kf.info);
    } catch (e) {}
    var expr = null;
    try {
      expr = pkfReadExpressionState(prop);
    } catch (e2) {}
    if (!snap) {
      var unavailableEvidence = { expression: expr };
      if (kf.mode === "clear") unavailableEvidence.valueWritten = false;
      return unavailableEvidence;
    }
    var evidence = {
      numKeys: snap.numKeys,
      keyframes: snap.keyframes,
      expression: expr,
    };
    if (kf.mode === "static" || kf.mode === "clear") {
      var sv = pkfReadStaticValue(prop);
      if (kf.mode === "static" && sv !== null) evidence.staticValue = sv;
      if (kf.mode === "clear") {
        evidence.valueWritten = false;
        if (sv !== null) evidence.retainedValue = sv;
      }
    }
    return evidence;
  }

  function fail(message, mutated) {
    targetResult.status = "failed";
    targetResult.message = message;
    opResult.targets.push(targetResult);
    return { anyChanged: mutated, anyFailed: true, applyError: message };
  }

  // Revalidate the plan: another batch op may have touched this property. Walk the
  // caller's original segments (a resolved matchNames path can be ambiguous when
  // two effect instances share a matchName).
  var reResolved = pkfResolveSegments(t.layer, kf.requestedSegments);
  if (reResolved.error) {
    return fail("Planned property changed before apply: " + reResolved.error, false);
  }
  var prop = reResolved.prop;
  var exprNow = pkfReadExpressionState(prop);
  if (!kf.wantClear && exprNow.expressionEnabled && exprNow.expression.length > 0) {
    return fail("Target property gained an enabled expression after preflight", false);
  }
  var snapshotNow = pkfReadTimelineSnapshot(prop, kf.info);
  if (!snapshotNow) {
    return fail("Could not re-read the planned property before apply", false);
  }
  if (!pkfSnapshotsEqual(snapshotNow, kf.before)) {
    return fail(
      "Planned property changed before apply (stale plan); re-inspect and retry in a separate call",
      false,
    );
  }
  if (!pkfExpressionStatesEqual(exprNow, kf.before.expression)) {
    return fail(
      "Planned property changed before apply: expression state differs from preflight",
      false,
    );
  }
  if (kf.mode === "static") {
    var sampleNow = null;
    try {
      sampleNow = pkfNormalizeNumericValue(prop.valueAtTime(kf.sampleTime, true));
    } catch (se) {}
    if (sampleNow === null || !pkfValuesEqual(sampleNow, kf.sample, PKF_VALUE_EPSILON)) {
      return fail("Planned static sample changed before apply (stale plan)", false);
    }
  }
  if (kf.alreadySatisfied) {
    var baselineNoop = pkfCapturePreservation(t.layer, kf.indexPath);
    if (baselineNoop.error) {
      return fail(baselineNoop.error, false);
    }
    targetResult.status = "already_satisfied";
    targetResult.after = {
      numKeys: snapshotNow.numKeys,
      keyframes: snapshotNow.keyframes,
      expression: exprNow,
    };
    if (kf.mode === "static") targetResult.after.staticValue = kf.sample;
    if (kf.mode === "clear") {
      var retainedNoop = pkfReadStaticValue(prop);
      targetResult.after.valueWritten = false;
      if (retainedNoop !== null) targetResult.after.retainedValue = retainedNoop;
    }
    targetResult.preservation = {
      scope: "other_keyframes_on_target_layer",
      checkedProperties: baselineNoop.checkedProperties,
      checkedKeys: baselineNoop.checkedKeys,
      unchanged: true,
    };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  // Fresh preservation baseline immediately before this op's writes, so
  // legitimate edits by preceding batch ops are not counted as this op's damage.
  var baseline = pkfCapturePreservation(t.layer, kf.indexPath);
  if (baseline.error) {
    return fail(baseline.error, false);
  }
  var mutated = false;
  var writeError = null;
  try {
    if (kf.wantClear && (exprNow.expression.length > 0 || exprNow.expressionEnabled)) {
      prop.expression = "";
      prop.expressionEnabled = false;
      mutated = true;
    }
    if (kf.mode === "static") {
      var hadKeys = false;
      try {
        hadKeys = prop.numKeys > 0;
      } catch (hk) {}
      for (var clearRemoveIndex = prop.numKeys; clearRemoveIndex >= 1; clearRemoveIndex--) {
        prop.removeKey(clearRemoveIndex);
        mutated = true;
      }
      if (hadKeys) {
        try {
          prop.setValue(kf.sample);
          mutated = true;
        } catch (setErr) {
          // AE refuses setValue once a hidden property's keys are gone. Restore
          // the removed keys in place and report the refusal honestly instead of
          // leaving the property partially mutated for batch undo to recover.
          var restored = pkfRestoreTimeline(prop, kf.before, kf.info);
          targetResult.restore = {
            attempted: true,
            verified: restored.verified,
          };
          targetResult.message =
            "Static restore refused after removing keys: " +
            String(setErr) +
            (restored.verified
              ? " (removed keys restored in place)"
              : " (could not verify restoration of removed keys)");
          targetResult.after = readAfterEvidence(prop);
          targetResult.status = "failed";
          opResult.targets.push(targetResult);
          return {
            anyChanged: mutated,
            anyFailed: true,
            applyError: targetResult.message,
          };
        }
      }
    } else if (kf.mode === "clear") {
      for (
        var timelineRemoveIndex = prop.numKeys;
        timelineRemoveIndex >= 1;
        timelineRemoveIndex--
      ) {
        prop.removeKey(timelineRemoveIndex);
        mutated = true;
      }
    } else {
      while (prop.numKeys > 0) {
        prop.removeKey(1);
        mutated = true;
      }
      for (var wi = 0; wi < kf.desiredEntries.length; wi++) {
        var d = kf.desiredEntries[wi];
        var idx = prop.addKey(d.time);
        mutated = true;
        prop.setValueAtKey(idx, d.value);
        prop.setInterpolationTypeAtKey(idx, pkfInterpEnum(d.inType), pkfInterpEnum(d.outType));
        if (d.inType === "BEZIER" || d.outType === "BEZIER") {
          if (d.inEase && d.outEase) {
            prop.setTemporalEaseAtKey(idx, pkfEaseObjects(d.inEase), pkfEaseObjects(d.outEase));
          } else if (d.inEase) {
            prop.setTemporalEaseAtKey(idx, pkfEaseObjects(d.inEase));
          } else {
            prop.setTemporalEaseAtKey(idx, pkfEaseObjects(d.outEase));
          }
        }
        // Deterministic normalization flags; readback verification decides success.
        try {
          prop.setTemporalContinuousAtKey(idx, false);
        } catch (tc) {}
        try {
          prop.setTemporalAutoBezierAtKey(idx, false);
        } catch (ta) {}
        if (kf.info.spatial) {
          var zeroTangent = [0, 0, 0];
          try {
            prop.setSpatialTangentsAtKey(idx, zeroTangent, zeroTangent);
          } catch (st) {}
          try {
            prop.setSpatialContinuousAtKey(idx, false);
          } catch (sc) {}
          try {
            prop.setSpatialAutoBezierAtKey(idx, false);
          } catch (sa) {}
          try {
            prop.setRovingAtKey(idx, false);
          } catch (ro) {}
        }
      }
    }
  } catch (writeErr) {
    writeError = String(writeErr);
  }
  if (writeError !== null) {
    targetResult.message = writeError;
    targetResult.after = readAfterEvidence(prop);
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return { anyChanged: mutated, anyFailed: true, applyError: writeError };
  }
  var exprAfter = pkfReadExpressionState(prop);
  if (kf.wantClear && (exprAfter.expression.length > 0 || exprAfter.expressionEnabled)) {
    targetResult.message = "Post-condition failed: expression was not cleared";
    targetResult.after = readAfterEvidence(prop);
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  if (!kf.wantClear && !pkfExpressionStatesEqual(exprAfter, exprNow)) {
    targetResult.message = "Post-condition failed: expression state changed unexpectedly";
    targetResult.after = readAfterEvidence(prop);
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var afterSnapshot = pkfReadTimelineSnapshot(prop, kf.info);
  if (!afterSnapshot) {
    targetResult.message = "Post-condition failed: could not re-read the target property";
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var postOk = false;
  if (kf.mode === "static") {
    postOk = afterSnapshot.numKeys === 0;
    var afterStatic = null;
    try {
      afterStatic = pkfNormalizeNumericValue(prop.value);
    } catch (ave) {}
    if (afterStatic !== null) {
      postOk = postOk && pkfValuesEqual(afterStatic, kf.sample, PKF_VALUE_EPSILON);
    } else {
      postOk = false;
    }
  } else if (kf.mode === "clear") {
    postOk = afterSnapshot.numKeys === 0;
  } else {
    postOk = pkfTimelineMatchesDesired(afterSnapshot, kf.desiredEntries, kf.info);
  }
  if (!postOk) {
    targetResult.message =
      "Post-condition failed: " +
      (kf.mode === "static"
        ? "keys were not removed or the static value does not match the sample"
        : kf.mode === "clear"
          ? "keys were not removed from the property"
          : "written keyframes do not match the requested timeline");
    targetResult.after = readAfterEvidence(prop);
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var afterPres = pkfCapturePreservation(t.layer, kf.indexPath);
  if (afterPres.error) {
    targetResult.message = "Post-condition failed: " + afterPres.error;
    targetResult.after = readAfterEvidence(prop);
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  var presDiff = pkfPreservationsEqual(baseline, afterPres);
  if (!presDiff.unchanged) {
    targetResult.message = "Post-condition failed: unrelated keyframes on the target layer changed";
    targetResult.after = readAfterEvidence(prop);
    targetResult.preservation = {
      scope: "other_keyframes_on_target_layer",
      checkedProperties: baseline.checkedProperties,
      checkedKeys: baseline.checkedKeys,
      unchanged: false,
      drift: presDiff.drift,
    };
    if (presDiff.truncated) targetResult.preservation.driftTruncated = true;
    targetResult.status = "failed";
    opResult.targets.push(targetResult);
    return {
      anyChanged: mutated,
      anyFailed: true,
      applyError: targetResult.message,
    };
  }
  targetResult.status = "changed";
  targetResult.after = {
    numKeys: afterSnapshot.numKeys,
    keyframes: afterSnapshot.keyframes,
    expression: exprAfter,
  };
  if (kf.mode === "static") targetResult.after.staticValue = kf.sample;
  if (kf.mode === "clear") {
    var retainedFinal = pkfReadStaticValue(prop);
    targetResult.after.valueWritten = false;
    if (retainedFinal !== null) targetResult.after.retainedValue = retainedFinal;
  }
  targetResult.preservation = {
    scope: "other_keyframes_on_target_layer",
    checkedProperties: afterPres.checkedProperties,
    checkedKeys: afterPres.checkedKeys,
    unchanged: true,
  };
  opResult.targets.push(targetResult);
  return { anyChanged: true, anyFailed: false, applyError: null };
}

export function applyResetLayerSurface(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var clearKeyframes = op.clearKeyframes !== false;
  var clearEffects = op.clearEffects !== false;
  var clearMasks = op.clearMasks !== false;
  var clearLayerStyles = op.clearLayerStyles !== false;
  var clearMarkers = op.clearMarkers !== false;
  var clearTrackMatte = op.clearTrackMatte !== false;
  var clearParent = op.clearParent !== false;
  var resetTransforms = !!op.resetTransforms;
  var clearExpressions = !!op.clearExpressions;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    cleared: {},
  };
  var transformBefore = null;
  var desiredTransforms = null;
  if (resetTransforms) {
    transformBefore = readLayerTransform(t.layer);
    targetResult.before = { transforms: transformBefore };
    desiredTransforms = defaultLayerTransform(t.layer, t.comp);
  }
  try {
    if (clearEffects) {
      try {
        var effects = t.layer.property("ADBE Effect Parade");
        if (effects) {
          for (var ei = effects.numProperties; ei >= 1; ei--) {
            effects.property(ei).remove();
          }
        }
        targetResult.cleared.effects = true;
      } catch (ee) {
        targetResult.cleared.effects = false;
      }
    }
    if (clearMasks) {
      try {
        var masks = t.layer.property("ADBE Mask Parade");
        if (masks) {
          for (var mi = masks.numProperties; mi >= 1; mi--) {
            masks.property(mi).remove();
          }
        }
        targetResult.cleared.masks = true;
      } catch (me) {
        targetResult.cleared.masks = false;
      }
    }
    if (clearLayerStyles) {
      try {
        var styles = t.layer.property("ADBE Layer Styles");
        if (styles && styles.canSetEnabled) {
          styles.enabled = false;
        }
        targetResult.cleared.layerStyles = true;
      } catch (se) {
        targetResult.cleared.layerStyles = false;
      }
    }
    if (clearMarkers) {
      try {
        var markers = t.layer.property("ADBE Marker");
        if (markers) {
          while (markers.numKeys > 0) markers.removeKey(1);
        }
        targetResult.cleared.markers = true;
      } catch (mke) {
        targetResult.cleared.markers = false;
      }
    }
    if (clearTrackMatte) {
      try {
        if (t.layer.hasTrackMatte) {
          if (typeof t.layer.setTrackMatte === "function") {
            t.layer.setTrackMatte(null, TrackMatteType.NO_TRACK_MATTE);
          } else {
            t.layer.trackMatteType = TrackMatteType.NO_TRACK_MATTE;
          }
        }
        targetResult.cleared.trackMatte = true;
      } catch (tme) {
        targetResult.cleared.trackMatte = false;
      }
    }
    if (clearParent) {
      try {
        t.layer.parent = null;
        targetResult.cleared.parent = true;
      } catch (pe) {
        targetResult.cleared.parent = false;
      }
    }
    if (clearKeyframes || clearExpressions) {
      for (var pi = 1; pi <= t.layer.numProperties; pi++) {
        var root;
        try {
          root = t.layer.property(pi);
        } catch (re) {
          continue;
        }
        walkClearKeysAndExpressions(root, clearKeyframes, clearExpressions);
      }
      if (clearKeyframes) targetResult.cleared.keyframes = true;
      if (clearExpressions) targetResult.cleared.expressions = true;
    }
    var transformOk = true;
    var transformMessage = null;
    var transformWrite = null;
    if (resetTransforms) {
      var keyframed = keyframedTransformKeys(t.layer);
      if (keyframed.length > 0) {
        transformOk = false;
        transformMessage =
          "resetTransforms refused: keyframed transform propert" +
          (keyframed.length === 1 ? "y" : "ies") +
          " remain (numKeys > 0): " +
          keyframed.join(", ") +
          "; enable clearKeyframes or clear keys first";
      } else {
        transformWrite = writeAndVerifyTransforms(t.layer, desiredTransforms);
        if (transformWrite.writeError) {
          transformOk = false;
          transformMessage = "resetTransforms write failed: " + transformWrite.writeError;
        } else if (transformWrite.mismatched.length > 0) {
          transformOk = false;
          transformMessage =
            "Post-condition failed: resetTransforms did not match AE defaults: " +
            transformWrite.mismatched.join(", ");
        }
      }
    }
    var after = {
      effectCount: countGroupChildren(t.layer, "ADBE Effect Parade"),
      maskCount: countGroupChildren(t.layer, "ADBE Mask Parade"),
      markerCount: 0,
      hasParent: false,
      hasTrackMatte: false,
    };
    try {
      var mk = t.layer.property("ADBE Marker");
      if (mk) after.markerCount = mk.numKeys;
    } catch (mce) {}
    try {
      after.hasParent = !!t.layer.parent;
    } catch (hpe) {}
    try {
      after.hasTrackMatte = !!t.layer.hasTrackMatte;
    } catch (hte) {}
    if (resetTransforms) {
      if (transformWrite) {
        after.transforms = transformWrite.after;
      } else {
        try {
          after.transforms = readLayerTransform(t.layer);
        } catch (rte) {}
      }
    }
    targetResult.after = after;
    var ok = true;
    if (clearEffects && after.effectCount !== 0) ok = false;
    if (clearMasks && after.maskCount !== 0) ok = false;
    if (clearMarkers && after.markerCount !== 0) ok = false;
    if (clearParent && after.hasParent) ok = false;
    if (clearTrackMatte && after.hasTrackMatte) ok = false;
    if (resetTransforms && !transformOk) ok = false;
    if (ok) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    if (resetTransforms && !transformOk && transformMessage) {
      targetResult.message = transformMessage;
    } else {
      targetResult.message = "Post-condition failed: layer surface counts/flags not cleared";
    }
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (rse) {
    targetResult.status = "failed";
    targetResult.message = String(rse);
    if (resetTransforms) {
      try {
        if (!targetResult.after) targetResult.after = {};
        targetResult.after.transforms = readLayerTransform(t.layer);
      } catch (ae) {}
    }
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(rse) };
  }
}

export function applyDeleteLayer(plan, opResult) {
  var t = plan.targets[0];
  var layerId = t.layer.id;
  var comp = t.comp;
  var targetResult = {
    compId: comp.id,
    layerId: layerId,
    compName: comp.name,
    layerName: t.layer.name,
    status: "failed",
  };
  try {
    t.layer.remove();
    if (!layerByIdInComp(comp, layerId)) {
      targetResult.status = "changed";
      targetResult.deleted = true;
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: layer id still present after delete";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (de) {
    targetResult.status = "failed";
    targetResult.message = String(de);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(de) };
  }
}

function snapshotNonMissingFootageIds() {
  var ids = [];
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    var it = items[i];
    if (!(it instanceof FootageItem)) continue;
    try {
      if (!it.footageMissing) ids.push(it.id);
    } catch (e) {}
  }
  return ids;
}

function findNewlyMissingFootage(beforeIds) {
  var newly = [];
  for (var i = 0; i < beforeIds.length; i++) {
    var id = beforeIds[i];
    var it = itemById(id);
    if (!it) continue;
    try {
      if (it instanceof FootageItem && it.footageMissing) newly.push(id);
    } catch (e) {}
  }
  return newly;
}

export function applySafeDeleteProjectItem(plan, opResult) {
  var anyChanged = false;
  var anyFailed = false;
  var applyError = null;
  var beforeNonMissing = snapshotNonMissingFootageIds();

  for (var ti = 0; ti < plan.targets.length; ti++) {
    var item = plan.targets[ti].item;
    var itemId = item.id;
    var targetResult = {
      itemId: itemId,
      itemName: String(item.name || ""),
      itemType: itemTypeName(item),
      status: "failed",
    };

    if (isRootFolder(item)) {
      targetResult.status = "failed";
      targetResult.message = "Refusing to delete the project root folder";
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = targetResult.message;
      break;
    }

    if (item instanceof FolderItem) {
      if (item.numItems > 0) {
        targetResult.status = "failed";
        targetResult.message = "Refusing to delete non-empty folder (safe_delete is non-recursive)";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
    } else {
      var collected = collectItemRefs(item);
      targetResult.preDeleteRefs = {
        refs: collected.refs,
        unknownRefsPossible: collected.unknownRefsPossible,
        incompleteReasons: collected.incompleteReasons,
      };
      if (collected.refs.length > 0 || collected.unknownRefsPossible) {
        targetResult.status = "failed";
        targetResult.message = collected.unknownRefsPossible
          ? "Refusing delete: unknownRefsPossible is true"
          : "Refusing delete: item has known inbound refs (" + collected.refs.length + ")";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
    }

    try {
      item.remove();
      anyChanged = true;
      if (itemById(itemId)) {
        targetResult.status = "failed";
        targetResult.message = "Post-condition failed: item still present after remove";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
      var newlyMissing = findNewlyMissingFootage(beforeNonMissing);
      targetResult.newlyMissingFootageIds = newlyMissing;
      if (newlyMissing.length > 0) {
        targetResult.status = "failed";
        targetResult.message =
          "Post-check failed: retained footage newly missing: " + newlyMissing.join(",");
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
    } catch (de) {
      targetResult.status = "failed";
      targetResult.message = String(de);
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = String(de);
      break;
    }
  }

  return {
    anyChanged: anyChanged,
    anyFailed: anyFailed,
    applyError: applyError,
  };
}

function readCompSettingsSnapshot(comp) {
  var frameRate = Number(comp.frameRate);
  var renderer = "";
  try {
    renderer = String(comp.renderer || "");
  } catch (e) {}
  return {
    width: Number(comp.width),
    height: Number(comp.height),
    pixelAspect: Number(comp.pixelAspect),
    frameRate: frameRate,
    durationFrames: timeToFrame(comp.duration, frameRate),
    displayStartFrame: readDisplayStartFrame(comp, frameRate),
    workAreaStartFrame: timeToFrame(comp.workAreaStart, frameRate),
    workAreaDurationFrames: timeToFrame(comp.workAreaDuration, frameRate),
    renderer: renderer,
    switches: readCompSwitches(comp),
  };
}

function clampWorkAreaToDuration(comp, rate, newDurFrames) {
  var curWaStart = timeToFrame(comp.workAreaStart, rate);
  var curWaDur = timeToFrame(comp.workAreaDuration, rate);
  if (curWaStart + curWaDur <= newDurFrames) return;
  var clampStart = curWaStart;
  var clampDur = curWaDur;
  if (clampStart < newDurFrames) {
    clampDur = newDurFrames - clampStart;
  } else {
    clampStart = 0;
    clampDur = newDurFrames;
  }
  comp.workAreaStart = frameToTime(clampStart, rate);
  comp.workAreaDuration = frameToTime(clampDur, rate);
}

/** Shared already-satisfied + post-condition check for supplied settings keys. */
function compSettingsMatchRequest(snapshot, settings) {
  if (settings.width !== undefined && snapshot.width !== settings.width) return false;
  if (settings.height !== undefined && snapshot.height !== settings.height) return false;
  if (settings.pixelAspect !== undefined && snapshot.pixelAspect !== settings.pixelAspect) {
    return false;
  }
  if (settings.frameRate !== undefined && snapshot.frameRate !== settings.frameRate) return false;
  if (
    settings.durationFrames !== undefined &&
    snapshot.durationFrames !== settings.durationFrames
  ) {
    return false;
  }
  if (
    settings.displayStartFrame !== undefined &&
    snapshot.displayStartFrame !== settings.displayStartFrame
  ) {
    return false;
  }
  if (
    settings.workAreaStartFrame !== undefined &&
    snapshot.workAreaStartFrame !== settings.workAreaStartFrame
  ) {
    return false;
  }
  if (
    settings.workAreaDurationFrames !== undefined &&
    snapshot.workAreaDurationFrames !== settings.workAreaDurationFrames
  ) {
    return false;
  }
  if (settings.renderer !== undefined && snapshot.renderer !== settings.renderer) return false;
  if (settings.switches) {
    var sw = settings.switches;
    var keys = compSwitchKeys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (sw[key] !== undefined && snapshot.switches[key] !== !!sw[key]) {
        return false;
      }
    }
  }
  return true;
}

export function applySetCompSettings(plan, opResult) {
  var comp = plan.comp;
  var settings = plan.op.settings;
  var before = readCompSettingsSnapshot(comp);
  var targetResult = {
    compId: comp.id,
    compName: comp.name,
    status: "failed",
    before: before,
  };
  if (compSettingsMatchRequest(before, settings)) {
    targetResult.status = "already_satisfied";
    targetResult.after = before;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
  if (settings.renderer !== undefined) {
    var rendererOk = false;
    try {
      var rlist = comp.renderers;
      if (rlist && rlist.length) {
        for (var ri = 0; ri < rlist.length; ri++) {
          if (String(rlist[ri]) === String(settings.renderer)) {
            rendererOk = true;
            break;
          }
        }
      }
    } catch (re) {
      rendererOk = false;
    }
    if (!rendererOk) {
      targetResult.status = "failed";
      targetResult.message = "renderer is not in comp.renderers: " + settings.renderer;
      targetResult.after = before;
      opResult.targets.push(targetResult);
      return {
        anyChanged: false,
        anyFailed: true,
        applyError: targetResult.message,
      };
    }
  }
  try {
    var rate = before.frameRate;
    if (settings.frameRate !== undefined) {
      comp.frameRate = settings.frameRate;
      rate = Number(comp.frameRate);
    }
    if (settings.durationFrames !== undefined) {
      var newDurFrames = settings.durationFrames;
      // Clamp current/preserved work area before duration shrink; explicit WA applied after.
      clampWorkAreaToDuration(comp, rate, newDurFrames);
      comp.duration = frameToTime(newDurFrames, rate);
    }
    if (settings.width !== undefined) comp.width = settings.width;
    if (settings.height !== undefined) comp.height = settings.height;
    if (settings.pixelAspect !== undefined) comp.pixelAspect = settings.pixelAspect;
    if (settings.displayStartFrame !== undefined) {
      try {
        comp.displayStartFrame = settings.displayStartFrame;
      } catch (dse) {
        throw new Error("displayStartFrame is not writable on this host: " + String(dse));
      }
    }
    if (settings.renderer !== undefined) {
      comp.renderer = settings.renderer;
    }
    if (settings.switches) {
      var sw = settings.switches;
      var switchKeys = compSwitchKeys();
      for (var ski = 0; ski < switchKeys.length; ski++) {
        var sk = switchKeys[ski];
        if (sw[sk] !== undefined) {
          comp[sk] = !!sw[sk];
        }
      }
    }
    if (
      settings.workAreaStartFrame !== undefined ||
      settings.workAreaDurationFrames !== undefined
    ) {
      rate = Number(comp.frameRate);
      var durFrames = timeToFrame(comp.duration, rate);
      var waStart =
        settings.workAreaStartFrame !== undefined
          ? settings.workAreaStartFrame
          : timeToFrame(comp.workAreaStart, rate);
      var waDur =
        settings.workAreaDurationFrames !== undefined
          ? settings.workAreaDurationFrames
          : timeToFrame(comp.workAreaDuration, rate);
      if (waStart + waDur > durFrames) {
        throw new Error(
          "work area would end past composition duration (" +
            (waStart + waDur) +
            " > " +
            durFrames +
            " frames)",
        );
      }
      if (settings.workAreaStartFrame !== undefined) {
        comp.workAreaStart = frameToTime(settings.workAreaStartFrame, rate);
      }
      if (settings.workAreaDurationFrames !== undefined) {
        comp.workAreaDuration = frameToTime(settings.workAreaDurationFrames, rate);
      }
    }
    var after = readCompSettingsSnapshot(comp);
    targetResult.after = after;
    if (compSettingsMatchRequest(after, settings)) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: composition settings did not match request";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message,
    };
  } catch (ce) {
    targetResult.status = "failed";
    targetResult.message = String(ce);
    var mutated = true;
    try {
      targetResult.after = readCompSettingsSnapshot(comp);
      mutated = JSON.stringify(targetResult.after) !== JSON.stringify(before);
    } catch (ae) {
      mutated = true;
    }
    opResult.targets.push(targetResult);
    return { anyChanged: mutated, anyFailed: true, applyError: String(ce) };
  }
}

export {};
