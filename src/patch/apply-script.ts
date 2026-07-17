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
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    if (items[i].id === itemId) return items[i];
  }
  return null;
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

function resolveSelector(selector) {
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
  if (op.op !== "set_text_style") {
    return JSON.stringify({
      ok: false,
      error: "Unsupported operation: " + op.op,
      code: "validation",
      context: ctx
    });
  }
  var resolved = resolveSelector(op.selector);
  if (resolved.error) {
    return JSON.stringify({
      ok: false,
      error: resolved.error,
      code: "validation",
      context: ctx
    });
  }
  totalTargets += resolved.targets.length;
  resolvedPlans.push({ op: op, targets: resolved.targets });
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
    var font = plan.op.style.font;
    var allStyleRuns = plan.op.allStyleRuns !== false;
    var anyChanged = false;
    var anyFailed = false;

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
        mutated = true;
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

    if (anyFailed) {
      opResult.status = "failed";
    } else if (anyChanged) {
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
