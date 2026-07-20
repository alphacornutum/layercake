/**
 * Shared ExtendScript id|name resolve helpers for inspect and patch.
 * Callers must define `resolveFail(code, message, candidates)` before this block.
 */
export const SHARED_RESOLVE_HELPERS = `
function findCompById(compId) {
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    var item = items[i];
    if (item instanceof CompItem && item.id === compId) return item;
  }
  return null;
}

function findCompsByName(compName) {
  var matches = [];
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    var item = items[i];
    if (item instanceof CompItem && item.name === compName) {
      matches.push(item);
    }
  }
  return matches;
}

function resolveComp(compId, compName) {
  if (compId !== undefined && compId !== null) {
    var byId = findCompById(compId);
    if (!byId) {
      resolveFail("not_found", "Composition not found for compId " + compId, null);
    }
    return byId;
  }
  var matches = findCompsByName(compName);
  if (matches.length === 0) {
    resolveFail("not_found", "Composition not found for compName " + JSON.stringify(compName), null);
  }
  if (matches.length > 1) {
    var candidates = [];
    for (var c = 0; c < matches.length; c++) {
      candidates.push({ id: matches[c].id, name: matches[c].name });
    }
    resolveFail("ambiguous_comp_name", "Ambiguous composition name; multiple matches", candidates);
  }
  return matches[0];
}

function findLayerById(comp, layerId) {
  for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);
    if (layer.id === layerId) return layer;
  }
  return null;
}

function findLayersByName(comp, layerName) {
  var matches = [];
  for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);
    if (layer.name === layerName) matches.push(layer);
  }
  return matches;
}

function resolveLayer(comp, layerId, layerName) {
  if (layerId !== undefined && layerId !== null) {
    var byId = findLayerById(comp, layerId);
    if (!byId) {
      resolveFail("not_found", "Layer not found for layerId " + layerId, null);
    }
    return byId;
  }
  var matches = findLayersByName(comp, layerName);
  if (matches.length === 0) {
    resolveFail("not_found", "Layer not found for layerName " + JSON.stringify(layerName), null);
  }
  if (matches.length > 1) {
    var candidates = [];
    for (var m = 0; m < matches.length; m++) {
      candidates.push({
        id: matches[m].id,
        index: matches[m].index,
        name: matches[m].name
      });
    }
    resolveFail("ambiguous_layer_name", "Ambiguous layer name; multiple matches", candidates);
  }
  return matches[0];
}

function findFootageById(sourceId) {
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    var item = items[i];
    if (item.id === sourceId) {
      if (!(item instanceof FootageItem)) {
        resolveFail("not_found", "Item id " + sourceId + " is not a FootageItem", null);
      }
      return item;
    }
  }
  return null;
}

function findFootageByName(sourceName) {
  var matches = [];
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    var item = items[i];
    if (item instanceof FootageItem && item.name === sourceName) {
      matches.push(item);
    }
  }
  return matches;
}

function resolveFootage(sourceId, sourceName) {
  if (sourceId !== undefined && sourceId !== null) {
    var byId = findFootageById(sourceId);
    if (!byId) {
      resolveFail("not_found", "FootageItem not found for sourceId " + sourceId, null);
    }
    return byId;
  }
  var matches = findFootageByName(sourceName);
  if (matches.length === 0) {
    resolveFail("not_found", "FootageItem not found for sourceName " + JSON.stringify(sourceName), null);
  }
  if (matches.length > 1) {
    var candidates = [];
    for (var s = 0; s < matches.length; s++) {
      candidates.push({ id: matches[s].id, name: matches[s].name });
    }
    resolveFail("ambiguous_source_name", "Ambiguous source name; multiple matches", candidates);
  }
  return matches[0];
}
`.trim();
