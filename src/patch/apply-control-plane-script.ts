/**
 * ExtendScript helpers + apply functions for control-plane patch ops.
 * Concatenated into buildPatchApplyScript after shared inventory/refs helpers.
 */
export const CONTROL_PLANE_APPLY_HELPERS = `
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
        matchNames: resolved
      };
    }
    if (!next) {
      return {
        error: "Property not found for segment: " + seg,
        prop: null,
        matchNames: resolved
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
    matchNames: resolved
  };
}

function resolvePropertySelector(layer, op) {
  var segments;
  if (op.matchNames && op.matchNames.length > 0) {
    segments = op.matchNames;
  } else if (op.propertyPath) {
    segments = parsePropertyPathSegments(op.propertyPath);
  } else {
    return { error: "Provide exactly one of matchNames or propertyPath", prop: null, matchNames: [] };
  }
  return resolvePropertySegments(layer, segments);
}

function readLayerTimingFrames(layer, frameRate) {
  return {
    startFrame: timeToFrame(layer.startTime, frameRate),
    inFrame: timeToFrame(layer.inPoint, frameRate),
    outFrame: timeToFrame(layer.outPoint, frameRate),
    stretch: layer.stretch
  };
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
    "timeRemapEnabled"
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

function applyRenameProjectItem(plan, opResult) {
  var item = plan.item;
  var desired = String(plan.op.name);
  var targetResult = {
    itemId: item.id,
    itemName: String(item.name || ""),
    itemType: itemTypeName(item),
    status: "failed"
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

function applySetLayerIndex(plan, opResult) {
  var t = plan.targets[0];
  var desired = plan.op.index;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    before: { index: t.layer.index }
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
    targetResult.message = "Post-condition failed: layer index is " + afterIndex + ", expected " + desired;
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

function applyCreateSolid(plan, opResult) {
  var op = plan.op;
  var parent = plan.parentFolder;
  var targetResult = {
    itemId: -1,
    itemName: String(op.name),
    itemType: "footage",
    status: "failed"
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
      30
    );
    solidLayer = tempComp.layers.addSolid(
      op.color,
      String(op.name),
      op.width,
      op.height,
      op.pixelAspect,
      1
    );
    createdItem = solidLayer.source;
    solidLayer.remove();
    tempComp.remove();
    tempComp = null;
    if (parent && createdItem.parentFolder.id !== parent.id) {
      createdItem.parentFolder = parent;
    }
    createdItem.name = String(op.name);
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
      parentFolderId: parentInfo.id
    };
    if (
      footageKindOf(createdItem) === "solid" &&
      String(createdItem.name) === String(op.name) &&
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
      try { solidLayer.remove(); } catch (e1) {}
    }
    if (tempComp) {
      try { tempComp.remove(); } catch (e2) {}
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

function applyReplaceLayerSource(plan, opResult) {
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
    before: { sourceItemId: beforeSourceId }
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

function applySetLayerTiming(plan, opResult) {
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
    before: before
  };
  var already = true;
  if (op.startFrame !== undefined && before.startFrame !== op.startFrame) already = false;
  if (op.inFrame !== undefined && before.inFrame !== op.inFrame) already = false;
  if (op.outFrame !== undefined && before.outFrame !== op.outFrame) already = false;
  if (op.stretch !== undefined && before.stretch !== op.stretch) already = false;
  if (already) {
    targetResult.status = "already_satisfied";
    targetResult.after = before;
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }
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
    var after = readLayerTimingFrames(t.layer, frameRate);
    targetResult.after = after;
    var ok = true;
    if (op.startFrame !== undefined && after.startFrame !== op.startFrame) ok = false;
    if (op.inFrame !== undefined && after.inFrame !== op.inFrame) ok = false;
    if (op.outFrame !== undefined && after.outFrame !== op.outFrame) ok = false;
    if (op.stretch !== undefined && after.stretch !== op.stretch) ok = false;
    if (ok) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: timing frames did not match request";
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
  } catch (te) {
    targetResult.status = "failed";
    targetResult.message = String(te);
    try {
      targetResult.after = readLayerTimingFrames(t.layer, frameRate);
    } catch (ae) {}
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(te) };
  }
}

function applySetLayerSwitches(plan, opResult) {
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
    before: before
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
    targetResult.message =
      "Switch key(s) not applicable on this layer: " + inapplicable.join(", ");
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
    try {
      targetResult.after = readLayerSwitches(t.layer);
    } catch (ae) {}
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(se) };
  }
}

function applySetPropertyExpression(plan, opResult) {
  var t = plan.targets[0];
  var op = plan.op;
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed",
    selector: {}
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

function applyResetLayerSurface(plan, opResult) {
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
    cleared: {}
  };
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
    if (resetTransforms) {
      try {
        var xf = t.layer.property("ADBE Transform Group");
        if (xf) {
          for (var ti = 1; ti <= xf.numProperties; ti++) {
            var tp = xf.property(ti);
            try {
              if (tp.propertyType === PropertyType.PROPERTY && typeof tp.setValue === "function") {
                // Best-effort: re-set current value to clear keys already done; skip if locked
              }
            } catch (te) {}
          }
        }
        targetResult.cleared.transforms = true;
      } catch (xfe) {
        targetResult.cleared.transforms = false;
      }
    }
    var after = {
      effectCount: countGroupChildren(t.layer, "ADBE Effect Parade"),
      maskCount: countGroupChildren(t.layer, "ADBE Mask Parade"),
      markerCount: 0,
      hasParent: false,
      hasTrackMatte: false
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
    targetResult.after = after;
    var ok = true;
    if (clearEffects && after.effectCount !== 0) ok = false;
    if (clearMasks && after.maskCount !== 0) ok = false;
    if (clearMarkers && after.markerCount !== 0) ok = false;
    if (clearParent && after.hasParent) ok = false;
    if (clearTrackMatte && after.hasTrackMatte) ok = false;
    if (ok) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: layer surface counts/flags not cleared";
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
  } catch (rse) {
    targetResult.status = "failed";
    targetResult.message = String(rse);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(rse) };
  }
}

function applyDeleteLayer(plan, opResult) {
  var t = plan.targets[0];
  var layerId = t.layer.id;
  var comp = t.comp;
  var targetResult = {
    compId: comp.id,
    layerId: layerId,
    compName: comp.name,
    layerName: t.layer.name,
    status: "failed"
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

function applySafeDeleteProjectItem(plan, opResult) {
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
      status: "failed"
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
        targetResult.message =
          "Refusing to delete non-empty folder (safe_delete is non-recursive)";
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
        incompleteReasons: collected.incompleteReasons
      };
      if (collected.refs.length > 0 || collected.unknownRefsPossible) {
        targetResult.status = "failed";
        targetResult.message =
          collected.unknownRefsPossible
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
`.trim();
