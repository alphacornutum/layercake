import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * Shared ExtendScript for inbound project-item reference collection.
 * Used by ae_get_item_refs and safe_delete_project_item.
 */
export const SHARED_ITEM_REFS_HELPERS = `
function itemTypeNameForRefs(item) {
  if (item instanceof FolderItem) return "folder";
  if (item instanceof CompItem) return "comp";
  if (item instanceof FootageItem) return "footage";
  return "item";
}

function itemByIdForRefs(itemId) {
  if (app.project.rootFolder && app.project.rootFolder.id === itemId) {
    return app.project.rootFolder;
  }
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    if (items[i].id === itemId) return items[i];
  }
  return null;
}

function pushUniqueReason(reasons, reason) {
  for (var i = 0; i < reasons.length; i++) {
    if (reasons[i] === reason) return;
  }
  reasons.push(reason);
}

function expressionMentionsItem(exprText, item) {
  if (!exprText) return false;
  var s = String(exprText);
  var idStr = String(item.id);
  if (s.indexOf(idStr) >= 0) return true;
  var name = String(item.name || "");
  if (name.length > 0 && s.indexOf(name) >= 0) return true;
  return false;
}

function walkPropertyExpressions(prop, item, onMention, onIncomplete) {
  var isGroup = prop.propertyType !== PropertyType.PROPERTY;
  if (isGroup) {
    var num = prop.numProperties;
    for (var i = 1; i <= num; i++) {
      var child;
      try {
        child = prop.property(i);
      } catch (e) {
        onIncomplete("Could not walk a property group while scanning expressions");
        continue;
      }
      walkPropertyExpressions(child, item, onMention, onIncomplete);
    }
    return;
  }
  try {
    var expr = prop.expression;
    if (expr !== undefined && expr !== null && String(expr).length > 0) {
      if (expressionMentionsItem(expr, item)) {
        onMention(prop);
      }
    }
  } catch (e2) {
    onIncomplete("Could not read a property expression during inbound-ref scan");
  }
}

/**
 * Collect known inbound refs for a project item. Returns:
 * { refs, unknownRefsPossible, incompleteReasons }
 */
function collectItemRefs(item) {
  var refs = [];
  var incompleteReasons = [];
  var unknownRefsPossible = false;
  var itemId = item.id;
  var seenUsedIn = {};
  var seenLayerSource = {};
  var seenParent = {};
  var seenMatte = {};
  var seenExpr = {};

  function markIncomplete(reason) {
    unknownRefsPossible = true;
    pushUniqueReason(incompleteReasons, reason);
  }

  // usedIn (AVItem)
  try {
    if ((item instanceof CompItem || item instanceof FootageItem) && item.usedIn) {
      var used = item.usedIn;
      for (var ui = 0; ui < used.length; ui++) {
        var c = used[ui];
        if (c && c instanceof CompItem) {
          if (!seenUsedIn[c.id]) {
            seenUsedIn[c.id] = true;
            refs.push({
              kind: "used_in_comp",
              compId: c.id,
              compName: String(c.name || "")
            });
          }
        }
      }
    }
  } catch (ue) {
    markIncomplete("usedIn scan failed");
  }

  // has_proxy: target has a proxy assigned. AE exposes FootageSource, not a stable proxy Item.id
  // in all versions — flag incompleteness so safe_delete refuses rather than false-allow.
  try {
    if ((item instanceof FootageItem || item instanceof CompItem) && item.useProxy) {
      refs.push({ kind: "has_proxy" });
      markIncomplete("Item has useProxy=true; proxy Item.id reverse-map is incomplete");
    }
  } catch (hpe) {}

  // Layer source scan + parent/matte + expression heuristics
  try {
    var items = app.project.items;
    for (var i = 1; i <= items.length; i++) {
      var comp = items[i];
      if (!(comp instanceof CompItem)) continue;
      for (var li = 1; li <= comp.numLayers; li++) {
        var layer = comp.layer(li);
        var layerId = null;
        try {
          layerId = layer.id;
        } catch (lidErr) {
          continue;
        }

        // layer_source
        try {
          if (layer.source && layer.source.id === itemId) {
            var lsKey = comp.id + ":" + layerId;
            if (!seenLayerSource[lsKey]) {
              seenLayerSource[lsKey] = true;
              refs.push({
                kind: "layer_source",
                compId: comp.id,
                layerId: layerId,
                layerName: String(layer.name || "")
              });
              if (!seenUsedIn[comp.id]) {
                seenUsedIn[comp.id] = true;
                refs.push({
                  kind: "used_in_comp",
                  compId: comp.id,
                  compName: String(comp.name || "")
                });
              }
            }
          }
        } catch (lse) {}

        // parent_link: a layer parents to a layer whose source is the target item
        try {
          if (layer.parent && layer.parent.source && layer.parent.source.id === itemId) {
            var parentId = layer.parent.id;
            var pk = comp.id + ":" + layerId + ":" + parentId;
            if (!seenParent[pk]) {
              seenParent[pk] = true;
              refs.push({
                kind: "parent_link",
                compId: comp.id,
                layerId: layerId,
                parentLayerId: parentId
              });
            }
          }
        } catch (pare) {}

        // track_matte: layer uses a matte layer sourced by the target
        try {
          if (layer.hasTrackMatte && layer.trackMatteLayer) {
            var matte = layer.trackMatteLayer;
            if (matte.source && matte.source.id === itemId) {
              var mk = comp.id + ":" + layerId + ":" + matte.id;
              if (!seenMatte[mk]) {
                seenMatte[mk] = true;
                refs.push({
                  kind: "track_matte",
                  compId: comp.id,
                  layerId: layerId,
                  matteLayerId: matte.id
                });
              }
            }
          }
        } catch (tme) {}

        // Expression heuristics on this layer
        try {
          for (var pri = 1; pri <= layer.numProperties; pri++) {
            var rootProp;
            try {
              rootProp = layer.property(pri);
            } catch (rpe) {
              markIncomplete("Could not walk layer properties for expression scan");
              continue;
            }
            walkPropertyExpressions(
              rootProp,
              item,
              function (prop) {
                var path = "";
                try {
                  path = String(prop.matchName || prop.name || "");
                } catch (ppe) {
                  path = "";
                }
                var ek = comp.id + ":" + layerId + ":" + path;
                if (!seenExpr[ek]) {
                  seenExpr[ek] = true;
                  refs.push({
                    kind: "expression_mention",
                    compId: comp.id,
                    layerId: layerId,
                    propertyPath: path,
                    confidence: "heuristic"
                  });
                  markIncomplete(
                    "Expression text heuristically mentions the item; reference closure not proven"
                  );
                }
              },
              markIncomplete
            );
          }
        } catch (exe) {
          markIncomplete("Expression scan failed on a layer");
        }
      }
    }
  } catch (scanErr) {
    markIncomplete("Project layer scan failed");
  }

  // proxy_for: other items that might treat this item as proxy — incomplete when useProxy set elsewhere
  // (AE does not expose a clean reverse proxy map in all versions.)

  return {
    refs: refs,
    unknownRefsPossible: unknownRefsPossible,
    incompleteReasons: incompleteReasons
  };
}
`.trim();

const GET_ITEM_REFS_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

var itemId = __args.itemId;
var item = itemByIdForRefs(itemId);
if (!item) {
  throw new Error("Project item not found: " + itemId);
}

var collected = collectItemRefs(item);
return JSON.stringify({
  item: {
    id: item.id,
    name: String(item.name || ""),
    type: itemTypeNameForRefs(item)
  },
  refs: collected.refs,
  unknownRefsPossible: collected.unknownRefsPossible,
  incompleteReasons: collected.incompleteReasons
});
`.trim();

export function buildGetItemRefsScript(itemId: number): string {
  const argsJson = JSON.stringify({ itemId });
  return [
    SHARED_INVENTORY_HELPERS,
    SHARED_ITEM_REFS_HELPERS,
    `var __args = ${argsJson};`,
    GET_ITEM_REFS_BODY,
  ].join("\n\n");
}
