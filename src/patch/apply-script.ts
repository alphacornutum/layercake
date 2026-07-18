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

function layerById(comp, layerId) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).id === layerId) return comp.layer(i);
  }
  return null;
}

function collectTextLayersInComp(comp, out) {
  for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);
    if (layer instanceof TextLayer) {
      out.push({ comp: comp, layer: layer });
    }
  }
}

function resolveTextSelector(selector) {
  var targets = [];
  var kind = selector.kind;
  if (kind === "layers") {
    for (var li = 0; li < selector.layers.length; li++) {
      var ref = selector.layers[li];
      var comp = itemById(ref.compId);
      if (!(comp && comp instanceof CompItem)) {
        return { error: "Composition not found: " + ref.compId, targets: [] };
      }
      var layer = layerById(comp, ref.layerId);
      if (!layer) {
        return { error: "Layer not found: compId=" + ref.compId + " layerId=" + ref.layerId, targets: [] };
      }
      if (!(layer instanceof TextLayer)) {
        return { error: "Layer is not a text layer: layerId=" + ref.layerId, targets: [] };
      }
      targets.push({ comp: comp, layer: layer });
    }
  } else if (kind === "comps") {
    for (var ci = 0; ci < selector.compIds.length; ci++) {
      var c = itemById(selector.compIds[ci]);
      if (!(c && c instanceof CompItem)) {
        return { error: "Composition not found: " + selector.compIds[ci], targets: [] };
      }
      collectTextLayersInComp(c, targets);
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
      var afterFonts = readFonts(afterDoc, allStyleRuns) || [font];
      targetResult.after = { fonts: afterFonts };
      targetResult.status = "changed";
      opResult.targets.push(targetResult);
    } catch (te) {
      targetResult.status = "failed";
      targetResult.message = String(te);
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = String(te);
      break;
    }
  }

  return { anyChanged: anyChanged, anyFailed: anyFailed, applyError: applyError };
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
  try {
    var created = app.project.items.addFolder(name);
    if (created.parentFolder.id !== parent.id) {
      created.parentFolder = parent;
    }
    var parentInfo = parentFolderInfo(created);
    targetResult.itemId = created.id;
    targetResult.itemName = created.name;
    targetResult.status = "changed";
    targetResult.created = {
      id: created.id,
      name: String(created.name),
      parentFolderId: parentInfo.id
    };
    targetResult.after = {
      parentFolderId: parentInfo.id,
      parentFolderName: parentInfo.name
    };
    opResult.targets.push(targetResult);
    return { anyChanged: true, anyFailed: false, applyError: null };
  } catch (ce) {
    targetResult.message = String(ce);
    opResult.targets.push(targetResult);
    return { anyChanged: false, anyFailed: true, applyError: String(ce) };
  }
}

function applyMoveProjectItem(plan, opResult) {
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

    if (isRootFolder(item)) {
      targetResult.status = "failed";
      targetResult.message = "Refusing to move the project root folder";
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = targetResult.message;
      break;
    }

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
      var after = parentFolderInfo(item);
      targetResult.after = { parentFolderId: after.id, parentFolderName: after.name };
      targetResult.status = "changed";
      anyChanged = true;
      opResult.targets.push(targetResult);
    } catch (me) {
      targetResult.status = "failed";
      targetResult.message = String(me);
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = String(me);
      break;
    }
  }

  return { anyChanged: anyChanged, anyFailed: anyFailed, applyError: applyError };
}

function applyDeleteProjectItem(plan, opResult) {
  var anyChanged = false;
  var anyFailed = false;
  var applyError = null;

  for (var ti = 0; ti < plan.targets.length; ti++) {
    var item = plan.targets[ti].item;
    var targetResult = {
      itemId: item.id,
      itemName: String(item.name || ""),
      itemType: itemTypeName(item),
      status: "failed",
      nestedItemCount: 0,
      usedInCompIds: [],
      usedInCompCount: 0
    };

    if (isRootFolder(item)) {
      targetResult.message = "Refusing to delete the project root folder";
      anyFailed = true;
      opResult.targets.push(targetResult);
      applyError = targetResult.message;
      break;
    }

    if (item instanceof FolderItem) {
      targetResult.nestedItemCount = countNestedDescendants(item);
    }
    var usedIds = collectUsedInCompIds(item);
    targetResult.usedInCompIds = usedIds;
    targetResult.usedInCompCount = usedIds.length;

    try {
      item.remove();
      targetResult.status = "changed";
      anyChanged = true;
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
  var op = ops[oi];
  if (op.op === "set_text_style") {
    var resolvedText = resolveTextSelector(op.selector);
    if (resolvedText.error) {
      return JSON.stringify({
        ok: false,
        error: resolvedText.error,
        code: "validation",
        context: ctx
      });
    }
    totalTargets += resolvedText.targets.length;
    resolvedPlans.push({ op: op, kind: "set_text_style", targets: resolvedText.targets });
  } else if (op.op === "create_folder") {
    var parentFolder = folderById(op.parentFolderId);
    if (!parentFolder) {
      return JSON.stringify({
        ok: false,
        error: "Parent folder not found or not a FolderItem: " + op.parentFolderId,
        code: "validation",
        context: ctx
      });
    }
    totalTargets += 1;
    resolvedPlans.push({
      op: op,
      kind: "create_folder",
      targets: [{ parentFolder: parentFolder }],
      parentFolder: parentFolder
    });
  } else if (op.op === "move_project_item") {
    var destFolder = folderById(op.destinationFolderId);
    if (!destFolder) {
      return JSON.stringify({
        ok: false,
        error: "Destination folder not found or not a FolderItem: " + op.destinationFolderId,
        code: "validation",
        context: ctx
      });
    }
    var resolvedMove = resolveItemsSelector(op.selector);
    if (resolvedMove.error) {
      return JSON.stringify({
        ok: false,
        error: resolvedMove.error,
        code: "validation",
        context: ctx
      });
    }
    for (var mi = 0; mi < resolvedMove.targets.length; mi++) {
      var moveItem = resolvedMove.targets[mi].item;
      if (isRootFolder(moveItem)) {
        return JSON.stringify({
          ok: false,
          error: "Refusing to move the project root folder",
          code: "validation",
          context: ctx
        });
      }
      if (moveItem instanceof FolderItem && wouldCreateFolderCycle(moveItem, destFolder)) {
        return JSON.stringify({
          ok: false,
          error:
            "Refusing folder move that would create a cycle (destination is the folder or a descendant): itemId=" +
            moveItem.id,
          code: "validation",
          context: ctx
        });
      }
    }
    totalTargets += resolvedMove.targets.length;
    resolvedPlans.push({
      op: op,
      kind: "move_project_item",
      targets: resolvedMove.targets,
      destinationFolder: destFolder
    });
  } else if (op.op === "delete_project_item") {
    var resolvedDelete = resolveItemsSelector(op.selector);
    if (resolvedDelete.error) {
      return JSON.stringify({
        ok: false,
        error: resolvedDelete.error,
        code: "validation",
        context: ctx
      });
    }
    for (var di = 0; di < resolvedDelete.targets.length; di++) {
      if (isRootFolder(resolvedDelete.targets[di].item)) {
        return JSON.stringify({
          ok: false,
          error: "Refusing to delete the project root folder",
          code: "validation",
          context: ctx
        });
      }
    }
    totalTargets += resolvedDelete.targets.length;
    resolvedPlans.push({
      op: op,
      kind: "delete_project_item",
      targets: resolvedDelete.targets
    });
  } else {
    return JSON.stringify({
      ok: false,
      error: "Unsupported operation: " + op.op,
      code: "validation",
      context: ctx
    });
  }
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
    var outcome;

    if (plan.kind === "set_text_style") {
      outcome = applySetTextStyle(plan, opResult);
    } else if (plan.kind === "create_folder") {
      outcome = applyCreateFolder(plan, opResult);
    } else if (plan.kind === "move_project_item") {
      outcome = applyMoveProjectItem(plan, opResult);
    } else if (plan.kind === "delete_project_item") {
      outcome = applyDeleteProjectItem(plan, opResult);
    } else {
      outcome = {
        anyChanged: false,
        anyFailed: true,
        applyError: "Unsupported operation kind: " + plan.kind
      };
    }

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
