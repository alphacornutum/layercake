import { SHARED_RESOLVE_HELPERS } from "../inventory/resolve-script.js";
import { PATCH_MAX_TARGETS, PATCH_UNDO_GROUP_NAME } from "./constants.js";

/**
 * Build apply ExtendScript with an injected JSON payload.
 * Payload shape matches PatchProjectInput plus maxTargets.
 */
export function buildPatchApplyScript(payloadJson: string): string {
  const escaped = escapeExtendScriptStringLiteral(payloadJson);
  const maxTargets = PATCH_MAX_TARGETS;
  const undoName = PATCH_UNDO_GROUP_NAME;

  return `
var __payloadJson = "${escaped}";
var payload = JSON.parse(__payloadJson);
var MAX_TARGETS = ${maxTargets};
var UNDO_NAME = ${JSON.stringify(undoName)};

function resolveFail(code, message, candidates) {
  var payload = { code: code, message: message };
  if (candidates) payload.candidates = candidates;
  throw new Error("AFX_RESOLVE:" + JSON.stringify(payload));
}

${SHARED_RESOLVE_HELPERS}

function formatResolveError(err) {
  var msg = String(err);
  var prefix = "AFX_RESOLVE:";
  var idx = msg.indexOf(prefix);
  if (idx < 0) return msg;
  try {
    var raw = msg.substring(idx + prefix.length);
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.message !== "string") return msg;
    if (parsed.candidates && parsed.candidates.length > 0) {
      return parsed.message + ": " + JSON.stringify(parsed.candidates);
    }
    return parsed.message;
  } catch (e) {
    return msg;
  }
}

function projectPathOf() {
  try {
    if (app.project.file) return app.project.file.fsName;
  } catch (e) {}
  return null;
}

function normalizePathKey(p) {
  if (p === null || p === undefined) return null;
  var s = String(p).replace(/\\\\/g, "/");
  while (s.length > 1 && s.charAt(s.length - 1) === "/") {
    s = s.substring(0, s.length - 1);
  }
  return s.toLowerCase();
}

function buildFingerprint(revision, dirty, projectPath) {
  var pathPart = projectPath && String(projectPath).length > 0 ? String(projectPath) : "unsaved";
  return "rev:" + revision + "|dirty:" + (dirty ? "1" : "0") + "|path:" + pathPart;
}

function readContext() {
  var revision = app.project.revision;
  var dirty = !!app.project.dirty;
  var projectPath = projectPathOf();
  return {
    projectName: app.project.file ? File.decode(app.project.file.name) : app.project.name,
    projectPath: projectPath,
    dirty: dirty,
    revision: revision,
    fingerprint: buildFingerprint(revision, dirty, projectPath),
    aeVersion: String(app.version)
  };
}

function itemById(itemId) {
  // rootFolder is not in app.project.items; match by real root id (often 0).
  if (app.project.rootFolder && app.project.rootFolder.id === itemId) {
    return app.project.rootFolder;
  }
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    if (items[i].id === itemId) return items[i];
  }
  return null;
}

function folderById(folderId) {
  var item = itemById(folderId);
  if (item && item instanceof FolderItem) return item;
  return null;
}

function isRootFolder(item) {
  return !!(item && item.id === app.project.rootFolder.id);
}

function itemTypeName(item) {
  if (item instanceof FolderItem) return "folder";
  if (item instanceof CompItem) return "comp";
  if (item instanceof FootageItem) return "footage";
  return "item";
}

function parentFolderInfo(item) {
  try {
    if (item.parentFolder) {
      return { id: item.parentFolder.id, name: String(item.parentFolder.name || "") };
    }
  } catch (e) {}
  return { id: app.project.rootFolder.id, name: String(app.project.rootFolder.name || "Root") };
}

/** Walk destination's parent chain; refuse if movingFolder appears (cycle). */
function wouldCreateFolderCycle(movingFolder, destinationFolder) {
  if (!movingFolder || !(movingFolder instanceof FolderItem)) return false;
  if (destinationFolder.id === movingFolder.id) return true;
  var walk = destinationFolder;
  var guard = 0;
  while (walk && guard < 10000) {
    guard++;
    if (walk.id === movingFolder.id) return true;
    try {
      if (!walk.parentFolder || walk.id === app.project.rootFolder.id) break;
      walk = walk.parentFolder;
    } catch (e) {
      break;
    }
  }
  return false;
}

function countNestedDescendants(folder) {
  var count = 0;
  function walk(node) {
    for (var i = 1; i <= node.numItems; i++) {
      count++;
      var child = node.item(i);
      if (child instanceof FolderItem) walk(child);
    }
  }
  walk(folder);
  return count;
}

function collectUsedInCompIds(item) {
  var ids = [];
  // AVItem is not a real ExtendScript class — use CompItem/FootageItem (see scripting guide).
  if (!(item instanceof CompItem) && !(item instanceof FootageItem)) return ids;
  try {
    var used = item.usedIn;
    if (!used) return ids;
    for (var i = 0; i < used.length; i++) {
      var c = used[i];
      if (c && c instanceof CompItem) ids.push(c.id);
    }
  } catch (e) {}
  return ids;
}

function collectTextLayersInComp(comp, out) {
  for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);
    if (layer instanceof TextLayer) {
      out.push({ comp: comp, layer: layer });
    }
  }
}

function resolveLayerTarget(ref) {
  var compId = ref.compId !== undefined ? ref.compId : null;
  var compName = ref.compName !== undefined ? ref.compName : null;
  var layerId = ref.layerId !== undefined ? ref.layerId : null;
  var layerName = ref.layerName !== undefined ? ref.layerName : null;
  var comp = resolveComp(compId, compName);
  var layer = resolveLayer(comp, layerId, layerName);
  return { comp: comp, layer: layer };
}

function resolveTextSelector(selector) {
  var targets = [];
  var kind = selector.kind;
  if (kind === "layers") {
    for (var li = 0; li < selector.layers.length; li++) {
      var pair;
      try {
        pair = resolveLayerTarget(selector.layers[li]);
      } catch (re) {
        return { error: formatResolveError(re), targets: [] };
      }
      if (!(pair.layer instanceof TextLayer)) {
        return {
          error: "Layer is not a text layer: layerId=" + pair.layer.id,
          targets: []
        };
      }
      targets.push(pair);
    }
  } else if (kind === "comps") {
    var seenCompIds = {};
    var compIds = selector.compIds || [];
    var compNames = selector.compNames || [];
    for (var ci = 0; ci < compIds.length; ci++) {
      var byId;
      try {
        byId = resolveComp(compIds[ci], null);
      } catch (ce) {
        return { error: formatResolveError(ce), targets: [] };
      }
      if (!seenCompIds[byId.id]) {
        seenCompIds[byId.id] = true;
        collectTextLayersInComp(byId, targets);
      }
    }
    for (var cn = 0; cn < compNames.length; cn++) {
      var byName;
      try {
        byName = resolveComp(null, compNames[cn]);
      } catch (cne) {
        return { error: formatResolveError(cne), targets: [] };
      }
      if (!seenCompIds[byName.id]) {
        seenCompIds[byName.id] = true;
        collectTextLayersInComp(byName, targets);
      }
    }
  } else if (kind === "all_text_layers") {
    var items = app.project.items;
    for (var i = 1; i <= items.length; i++) {
      if (items[i] instanceof CompItem) {
        collectTextLayersInComp(items[i], targets);
      }
    }
  } else {
    return { error: "Unsupported selector kind: " + kind, targets: [] };
  }
  return { error: null, targets: targets };
}

function resolveItemsSelector(selector) {
  if (!selector || selector.kind !== "items" || !selector.itemIds || selector.itemIds.length < 1) {
    return { error: "items selector requires a non-empty itemIds list", targets: [] };
  }
  var targets = [];
  for (var i = 0; i < selector.itemIds.length; i++) {
    var id = selector.itemIds[i];
    var item = itemById(id);
    if (!item) {
      return { error: "Project item not found: " + id, targets: [] };
    }
    targets.push({ item: item });
  }
  return { error: null, targets: targets };
}

function readFonts(doc, allStyleRuns) {
  var fonts = [];
  var seen = {};
  function add(f) {
    var s = String(f);
    if (!seen[s]) {
      seen[s] = true;
      fonts.push(s);
    }
  }
  if (allStyleRuns) {
    try {
      if (typeof doc.characterRange === "function" && doc.text && doc.text.length > 0) {
        var n = doc.text.length;
        var i = 0;
        while (i < n) {
          var cr = doc.characterRange(i, i + 1);
          var f = String(cr.font);
          add(f);
          var j = i + 1;
          while (j < n) {
            var cr2 = doc.characterRange(j, j + 1);
            if (String(cr2.font) !== f) break;
            j++;
          }
          i = j;
        }
        if (fonts.length > 0) return fonts;
      }
    } catch (e) {}
  }
  try {
    add(doc.font);
  } catch (e2) {
    return null;
  }
  return fonts;
}

function applyFontToDoc(doc, font, allStyleRuns) {
  if (allStyleRuns) {
    try {
      if (typeof doc.characterRange === "function" && doc.text && doc.text.length > 0) {
        var cr = doc.characterRange(0, doc.text.length);
        cr.font = font;
        return true;
      }
    } catch (e) {}
  }
  doc.font = font;
  return true;
}

function fontsAllMatch(fonts, font) {
  if (!fonts || fonts.length === 0) return false;
  for (var i = 0; i < fonts.length; i++) {
    if (fonts[i] !== font) return false;
  }
  return true;
}

function applySetTextStyle(plan, opResult) {
  var font = plan.op.style.font;
  var allStyleRuns = plan.op.allStyleRuns !== false;
  var anyChanged = false;
  var anyFailed = false;
  var applyError = null;

  for (var ti = 0; ti < plan.targets.length; ti++) {
    var t = plan.targets[ti];
    var targetResult = {
      compId: t.comp.id,
      layerId: t.layer.id,
      compName: t.comp.name,
      layerName: t.layer.name,
      status: "failed"
    };
    try {
      var textProp = t.layer.property("Source Text");
      if (!textProp) {
        targetResult.status = "unsupported";
        targetResult.message = "Layer has no Source Text property";
        anyFailed = true;
        opResult.targets.push(targetResult);
        continue;
      }
      var doc = textProp.value;
      var beforeFonts = readFonts(doc, allStyleRuns);
      if (!beforeFonts) {
        targetResult.status = "unsupported";
        targetResult.message = "Could not read TextDocument.font / CharacterRange";
        anyFailed = true;
        opResult.targets.push(targetResult);
        continue;
      }
      targetResult.before = { fonts: beforeFonts };
      if (fontsAllMatch(beforeFonts, font)) {
        targetResult.status = "already_satisfied";
        targetResult.after = { fonts: beforeFonts };
        opResult.targets.push(targetResult);
        continue;
      }
      applyFontToDoc(doc, font, allStyleRuns);
      textProp.setValue(doc);
      anyChanged = true;
      var afterDoc = textProp.value;
      var afterFonts = readFonts(afterDoc, allStyleRuns);
      if (afterFonts) {
        targetResult.after = { fonts: afterFonts };
      }
      if (afterFonts && fontsAllMatch(afterFonts, font)) {
        targetResult.status = "changed";
        opResult.targets.push(targetResult);
      } else {
        targetResult.status = "failed";
        targetResult.message =
          afterFonts
            ? "Post-condition failed: font did not match after write"
            : "Post-condition failed: could not re-read fonts after write";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
    } catch (te) {
      targetResult.status = "failed";
      targetResult.message = String(te);
      try {
        var failProp = t.layer.property("Source Text");
        if (failProp) {
          var failFonts = readFonts(failProp.value, allStyleRuns);
          if (failFonts) targetResult.after = { fonts: failFonts };
        }
      } catch (re) {}
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = String(te);
      break;
    }
  }

  return { anyChanged: anyChanged, anyFailed: anyFailed, applyError: applyError };
}

function applyRenameLayer(plan, opResult) {
  var desired = String(plan.op.layerName);
  var t = plan.targets[0];
  var targetResult = {
    compId: t.comp.id,
    layerId: t.layer.id,
    compName: t.comp.name,
    layerName: t.layer.name,
    status: "failed"
  };
  var beforeName = String(t.layer.name);
  targetResult.before = { name: beforeName };

  if (beforeName === desired) {
    targetResult.status = "already_satisfied";
    targetResult.after = { name: beforeName };
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: false, applyError: null };
  }

  try {
    t.layer.name = desired;
    var afterName = String(t.layer.name);
    targetResult.after = { name: afterName };
    if (afterName === desired) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message = "Post-condition failed: layer name did not match after write";
    opResult.targets.push(targetResult);
    return {
      anyChanged: true,
      anyFailed: true,
      applyError: targetResult.message
    };
  } catch (re) {
    targetResult.status = "failed";
    targetResult.message = String(re);
    try {
      targetResult.after = { name: String(t.layer.name) };
    } catch (ae) {}
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(re) };
  }
}

function applyCreateFolder(plan, opResult) {
  var parent = plan.parentFolder;
  var name = String(plan.op.name);
  var targetResult = {
    itemId: -1,
    itemName: name,
    itemType: "folder",
    status: "failed"
  };
  // Track addFolder success so mid-step failures still set anyChanged and trigger undo.
  var created = null;
  try {
    created = app.project.items.addFolder(name);
    if (created.parentFolder.id !== parent.id) {
      created.parentFolder = parent;
    }
    var parentInfo = parentFolderInfo(created);
    targetResult.itemId = created.id;
    targetResult.itemName = String(created.name);
    targetResult.created = {
      id: created.id,
      name: String(created.name),
      parentFolderId: parentInfo.id
    };
    targetResult.after = {
      parentFolderId: parentInfo.id,
      parentFolderName: parentInfo.name
    };
    if (
      String(created.name) === name &&
      parentInfo.id === parent.id
    ) {
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
      return { anyChanged: true, anyFailed: false, applyError: null };
    }
    targetResult.status = "failed";
    targetResult.message =
      "Post-condition failed: created folder name/parent did not match request";
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: true, applyError: targetResult.message };
  } catch (ce) {
    targetResult.message = String(ce);
    if (created) {
      try {
        targetResult.itemId = created.id;
        targetResult.itemName = String(created.name || name);
        var failParent = parentFolderInfo(created);
        targetResult.after = {
          parentFolderId: failParent.id,
          parentFolderName: failParent.name
        };
        targetResult.created = {
          id: created.id,
          name: String(created.name || name),
          parentFolderId: failParent.id
        };
      } catch (ne) {}
    }
    opResult.targets.push(targetResult);
    return { anyChanged: !!created, anyFailed: true, applyError: String(ce) };
  }
}

function applyMoveProjectItem(plan, opResult) {
  // Root refuse is validated in resolveOp; cycle checks stay here (tree may change mid-batch).
  var destination = plan.destinationFolder;
  var anyChanged = false;
  var anyFailed = false;
  var applyError = null;

  for (var ti = 0; ti < plan.targets.length; ti++) {
    var item = plan.targets[ti].item;
    var before = parentFolderInfo(item);
    var targetResult = {
      itemId: item.id,
      itemName: String(item.name || ""),
      itemType: itemTypeName(item),
      status: "failed",
      before: { parentFolderId: before.id, parentFolderName: before.name }
    };

    if (item instanceof FolderItem && wouldCreateFolderCycle(item, destination)) {
      targetResult.status = "failed";
      targetResult.message =
        "Refusing folder move that would create a cycle (destination is the folder or a descendant)";
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = targetResult.message;
      break;
    }

    if (before.id === destination.id) {
      targetResult.status = "already_satisfied";
      targetResult.after = {
        parentFolderId: before.id,
        parentFolderName: before.name
      };
      opResult.targets.push(targetResult);
      continue;
    }

    try {
      item.parentFolder = destination;
      anyChanged = true;
      var after = parentFolderInfo(item);
      targetResult.after = { parentFolderId: after.id, parentFolderName: after.name };
      if (after.id === destination.id) {
        targetResult.status = "changed";
        opResult.targets.push(targetResult);
      } else {
        targetResult.status = "failed";
        targetResult.message =
          "Post-condition failed: parentFolderId did not match destination after move";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
    } catch (me) {
      targetResult.status = "failed";
      targetResult.message = String(me);
      try {
        var failAfter = parentFolderInfo(item);
        targetResult.after = {
          parentFolderId: failAfter.id,
          parentFolderName: failAfter.name
        };
      } catch (rae) {}
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = String(me);
      break;
    }
  }

  return { anyChanged: anyChanged, anyFailed: anyFailed, applyError: applyError };
}

function applyDeleteProjectItem(plan, opResult) {
  // Root refuse is validated in resolveOp before the undo group.
  var anyChanged = false;
  var anyFailed = false;
  var applyError = null;

  for (var ti = 0; ti < plan.targets.length; ti++) {
    var item = plan.targets[ti].item;
    var itemId = item.id;
    var targetResult = {
      itemId: itemId,
      itemName: String(item.name || ""),
      itemType: itemTypeName(item),
      status: "failed",
      nestedItemCount: 0,
      usedInCompIds: [],
      usedInCompCount: 0
    };

    if (item instanceof FolderItem) {
      targetResult.nestedItemCount = countNestedDescendants(item);
    }
    var usedIds = collectUsedInCompIds(item);
    targetResult.usedInCompIds = usedIds;
    targetResult.usedInCompCount = usedIds.length;

    try {
      item.remove();
      anyChanged = true;
      var stillThere = itemById(itemId);
      if (!stillThere) {
        targetResult.status = "changed";
        opResult.targets.push(targetResult);
      } else {
        targetResult.status = "failed";
        targetResult.message = "Post-condition failed: item still present after remove";
        anyFailed = true;
        opResult.targets.push(targetResult);
        applyError = targetResult.message;
        break;
      }
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

function rootRefusalAmong(targets, actionVerb) {
  for (var ri = 0; ri < targets.length; ri++) {
    if (isRootFolder(targets[ri].item)) {
      return "Refusing to " + actionVerb + " the project root folder";
    }
  }
  return null;
}

function resolveOp(op) {
  if (op.op === "set_text_style") {
    var resolvedText = resolveTextSelector(op.selector);
    if (resolvedText.error) return { error: resolvedText.error };
    return {
      plan: { op: op, kind: "set_text_style", targets: resolvedText.targets },
      targetCount: resolvedText.targets.length
    };
  }
  if (op.op === "rename_layer") {
    var pair;
    try {
      pair = resolveLayerTarget(op.target);
    } catch (re) {
      return { error: formatResolveError(re) };
    }
    return {
      plan: { op: op, kind: "rename_layer", targets: [pair] },
      targetCount: 1
    };
  }
  if (op.op === "create_folder") {
    var parentFolder = folderById(op.parentFolderId);
    if (!parentFolder) {
      return { error: "Parent folder not found or not a FolderItem: " + op.parentFolderId };
    }
    return {
      plan: {
        op: op,
        kind: "create_folder",
        targets: [{ parentFolder: parentFolder }],
        parentFolder: parentFolder
      },
      targetCount: 1
    };
  }
  if (op.op === "move_project_item") {
    var destFolder = folderById(op.destinationFolderId);
    if (!destFolder) {
      return {
        error: "Destination folder not found or not a FolderItem: " + op.destinationFolderId
      };
    }
    var resolvedMove = resolveItemsSelector(op.selector);
    if (resolvedMove.error) return { error: resolvedMove.error };
    // Cycle checks run at apply time so earlier ops in this batch can reshape the tree.
    var moveRootErr = rootRefusalAmong(resolvedMove.targets, "move");
    if (moveRootErr) return { error: moveRootErr };
    return {
      plan: {
        op: op,
        kind: "move_project_item",
        targets: resolvedMove.targets,
        destinationFolder: destFolder
      },
      targetCount: resolvedMove.targets.length
    };
  }
  if (op.op === "delete_project_item") {
    var resolvedDelete = resolveItemsSelector(op.selector);
    if (resolvedDelete.error) return { error: resolvedDelete.error };
    var deleteRootErr = rootRefusalAmong(resolvedDelete.targets, "delete");
    if (deleteRootErr) return { error: deleteRootErr };
    return {
      plan: {
        op: op,
        kind: "delete_project_item",
        targets: resolvedDelete.targets
      },
      targetCount: resolvedDelete.targets.length
    };
  }
  return { error: "Unsupported operation: " + op.op };
}

function applyPlan(plan, opResult) {
  if (plan.kind === "set_text_style") return applySetTextStyle(plan, opResult);
  if (plan.kind === "rename_layer") return applyRenameLayer(plan, opResult);
  if (plan.kind === "create_folder") return applyCreateFolder(plan, opResult);
  if (plan.kind === "move_project_item") return applyMoveProjectItem(plan, opResult);
  if (plan.kind === "delete_project_item") return applyDeleteProjectItem(plan, opResult);
  return {
    anyChanged: false,
    anyFailed: true,
    applyError: "Unsupported operation kind: " + plan.kind
  };
}

if (!app.project) {
  return JSON.stringify({
    ok: false,
    error: "No After Effects project is open. Open a project first (ae_open_project).",
    code: "no_project"
  });
}

var ctx = readContext();
var expectedPath = payload.project.path;
var expectedFp = payload.project.fingerprint;

if (normalizePathKey(ctx.projectPath) !== normalizePathKey(expectedPath)) {
  return JSON.stringify({
    ok: false,
    error: "Project path mismatch. Open project path does not match the guard path.",
    code: "path_mismatch",
    context: ctx
  });
}

if (ctx.fingerprint !== expectedFp) {
  return JSON.stringify({
    ok: false,
    error: "Stale fingerprint. Re-read ae_project_context and retry.",
    code: "stale_fingerprint",
    context: ctx
  });
}

var ops = payload.operations;
var allowBroad = !!payload.allowBroadTargetSet;
var resolvedPlans = [];
var totalTargets = 0;

for (var oi = 0; oi < ops.length; oi++) {
  var resolved = resolveOp(ops[oi]);
  if (resolved.error) {
    return JSON.stringify({
      ok: false,
      error: resolved.error,
      code: "validation",
      context: ctx
    });
  }
  totalTargets += resolved.targetCount;
  resolvedPlans.push(resolved.plan);
}

if (totalTargets > MAX_TARGETS && !allowBroad) {
  return JSON.stringify({
    ok: false,
    error: "Resolved target count (" + totalTargets + ") exceeds built-in maximum (" + MAX_TARGETS + "). Pass allowBroadTargetSet: true to proceed.",
    code: "broad_target_set",
    context: ctx,
    resolvedTargetCount: totalTargets,
    maxTargets: MAX_TARGETS
  });
}

var results = [];
var mutated = false;
var applyError = null;

app.beginUndoGroup(UNDO_NAME);
try {
  for (var pi = 0; pi < resolvedPlans.length; pi++) {
    var plan = resolvedPlans[pi];
    var opResult = {
      index: pi,
      op: plan.op.op,
      status: "already_satisfied",
      targets: []
    };
    var outcome = applyPlan(plan, opResult);

    if (outcome.anyChanged) mutated = true;
    if (outcome.applyError) applyError = outcome.applyError;

    if (outcome.anyFailed) {
      opResult.status = "failed";
      if (mutated && !applyError) {
        applyError = "One or more targets failed after mutation began";
      }
    } else if (outcome.anyChanged) {
      opResult.status = "changed";
    } else {
      opResult.status = "already_satisfied";
    }
    results.push(opResult);
    if (applyError) break;
  }
} catch (batchErr) {
  applyError = String(batchErr);
}
app.endUndoGroup();

if (applyError) {
  var rollbackCompleted = false;
  if (mutated) {
    try {
      app.undo();
      rollbackCompleted = true;
    } catch (re) {
      rollbackCompleted = false;
    }
  }
  var failedCtx = readContext();
  return JSON.stringify({
    ok: false,
    error: applyError,
    code: "apply_failed",
    context: failedCtx,
    results: results,
    rollback: { attempted: mutated, completed: rollbackCompleted }
  });
}

var afterCtx = readContext();
return JSON.stringify({
  ok: true,
  results: results,
  fingerprint: afterCtx.fingerprint,
  dirty: afterCtx.dirty,
  revision: afterCtx.revision
});
`.trim();
}

function escapeExtendScriptStringLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
