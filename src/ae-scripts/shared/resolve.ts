export type ResolveFailure = (code: string, message: string, candidates?: object[] | null) => never;

export function findCompById(compId: number): CompItem | null {
  const items = app.project.items;
  for (let i = 1; i <= items.length; i++) {
    const item = items[i];
    if (item instanceof CompItem && item.id === compId) return item;
  }
  return null;
}

export function findCompsByName(compName: string): CompItem[] {
  const matches: CompItem[] = [];
  const items = app.project.items;
  for (let i = 1; i <= items.length; i++) {
    const item = items[i];
    if (item instanceof CompItem && item.name === compName) matches.push(item);
  }
  return matches;
}

export function resolveComp(
  compId: number | null,
  compName: string | null,
  fail: ResolveFailure,
): CompItem {
  if (compId !== undefined && compId !== null) {
    const byId = findCompById(compId);
    if (!byId) fail("not_found", "Composition not found for compId " + compId, null);
    return byId as CompItem;
  }
  const matches = findCompsByName(compName as string);
  if (matches.length === 0) {
    fail("not_found", "Composition not found for compName " + JSON.stringify(compName), null);
  }
  if (matches.length > 1) {
    const candidates: { id: number; name: string }[] = [];
    for (const match of matches) {
      candidates.push({ id: match.id, name: match.name });
    }
    fail("ambiguous_comp_name", "Ambiguous composition name; multiple matches", candidates);
  }
  return matches[0] as CompItem;
}

export function findLayerById(comp: CompItem, layerId: number): Layer | null {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer.id === layerId) return layer;
  }
  return null;
}

export function findLayersByName(comp: CompItem, layerName: string): Layer[] {
  const matches: Layer[] = [];
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer.name === layerName) matches.push(layer);
  }
  return matches;
}

export function resolveLayer(
  comp: CompItem,
  layerId: number | null,
  layerName: string | null,
  fail: ResolveFailure,
): Layer {
  if (layerId !== undefined && layerId !== null) {
    const byId = findLayerById(comp, layerId);
    if (!byId) fail("not_found", "Layer not found for layerId " + layerId, null);
    return byId as Layer;
  }
  const matches = findLayersByName(comp, layerName as string);
  if (matches.length === 0) {
    fail("not_found", "Layer not found for layerName " + JSON.stringify(layerName), null);
  }
  if (matches.length > 1) {
    const candidates: { id: number; index: number; name: string }[] = [];
    for (const match of matches) {
      candidates.push({ id: match.id, index: match.index, name: match.name });
    }
    fail("ambiguous_layer_name", "Ambiguous layer name; multiple matches", candidates);
  }
  return matches[0] as Layer;
}

export function findFootageById(sourceId: number, fail: ResolveFailure): FootageItem | null {
  const items = app.project.items;
  for (let i = 1; i <= items.length; i++) {
    const item = items[i];
    if (item.id === sourceId) {
      if (!(item instanceof FootageItem)) {
        fail("not_found", "Item id " + sourceId + " is not a FootageItem", null);
      }
      return item as FootageItem;
    }
  }
  return null;
}

export function findFootageByName(sourceName: string): FootageItem[] {
  const matches: FootageItem[] = [];
  const items = app.project.items;
  for (let i = 1; i <= items.length; i++) {
    const item = items[i];
    if (item instanceof FootageItem && item.name === sourceName) matches.push(item);
  }
  return matches;
}

export function resolveFootage(
  sourceId: number | null,
  sourceName: string | null,
  fail: ResolveFailure,
): FootageItem {
  if (sourceId !== undefined && sourceId !== null) {
    const byId = findFootageById(sourceId, fail);
    if (!byId) fail("not_found", "FootageItem not found for sourceId " + sourceId, null);
    return byId as FootageItem;
  }
  const matches = findFootageByName(sourceName as string);
  if (matches.length === 0) {
    fail("not_found", "FootageItem not found for sourceName " + JSON.stringify(sourceName), null);
  }
  if (matches.length > 1) {
    const candidates: { id: number; name: string }[] = [];
    for (const match of matches) {
      candidates.push({ id: match.id, name: match.name });
    }
    fail("ambiguous_source_name", "Ambiguous source name; multiple matches", candidates);
  }
  return matches[0] as FootageItem;
}
