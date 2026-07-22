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
      return { error: "Empty property path segment", prop: null, matchNames: resolved };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: !!createdItem, anyFailed: true, applyError: String(ce) };
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
      return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
      return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
    }
    if (keySnapshot.length > 0 && !layerKeysMatchSnapshot(t.layer, keySnapshot)) {
      var driftInfo = collectKeyframeDrift(t.layer, keySnapshot);
      targetResult.status = "failed";
      targetResult.message = "Post-condition failed: keyframes not preserved after timing write";
      targetResult.keyframesPreserved = false;
      targetResult.keyframeDrift = driftInfo.drift;
      if (driftInfo.truncated) targetResult.keyframeDriftTruncated = true;
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: timingMutated, anyFailed: true, applyError: String(te) };
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
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: switchMutated, anyFailed: true, applyError: String(se) };
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
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
  }
  if (lengthMismatch.length > 0) {
    targetResult.after = before;
    targetResult.message = "Transform array length mismatch for: " + lengthMismatch.join(", ");
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
      return { anyChanged: xfMutated, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: xfCatchMutated, anyFailed: true, applyError: String(xe) };
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
  targetResult.before = { expression: beforeExpr, expressionEnabled: beforeEnabled };
  var wantClear = op.expression === null;
  var wantExpr = wantClear ? "" : String(op.expression);
  var wantEnabled = wantClear ? false : op.expressionEnabled !== false;
  if (beforeExpr === wantExpr && beforeEnabled === wantEnabled) {
    targetResult.status = "already_satisfied";
    targetResult.after = { expression: beforeExpr, expressionEnabled: beforeEnabled };
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
    targetResult.after = { expression: afterExpr, expressionEnabled: afterEnabled };
    if (afterExpr === wantExpr && afterEnabled === wantEnabled) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: authored expression fields did not match";
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
  } catch (xe) {
    targetResult.status = "failed";
    targetResult.message = String(xe);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(xe) };
  }
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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

  return { anyChanged: anyChanged, anyFailed: anyFailed, applyError: applyError };
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
      return { anyChanged: false, anyFailed: true, applyError: targetResult.message };
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
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
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
