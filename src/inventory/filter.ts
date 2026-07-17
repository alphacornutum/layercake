import type { CompInventory, CompInventoryFilter, InventoryComposition } from "./types.js";

/**
 * Apply optional composition filters (union of id/name matches).
 * Unmatched filter entries are reported under `missing`.
 */
export function applyCompFilters(
  inventory: CompInventory,
  filter: CompInventoryFilter = {},
): CompInventory {
  const compIds = filter.compIds ?? [];
  const compNames = filter.compNames ?? [];
  const hasFilter = compIds.length > 0 || compNames.length > 0;

  if (!hasFilter) {
    return {
      ...inventory,
      missing: { compIds: [], compNames: [] },
    };
  }

  const idSet = new Set(compIds);
  const nameSet = new Set(compNames);
  const matchedIds = new Set<number>();
  const matchedNames = new Set<string>();

  const compositions: InventoryComposition[] = [];
  for (const comp of inventory.compositions) {
    const idMatch = idSet.has(comp.id);
    const nameMatch = nameSet.has(comp.name);
    if (idMatch || nameMatch) {
      compositions.push(comp);
      if (idMatch) matchedIds.add(comp.id);
      if (nameMatch) matchedNames.add(comp.name);
    }
  }

  return {
    projectName: inventory.projectName,
    compositions,
    missing: {
      compIds: compIds.filter((id) => !matchedIds.has(id)),
      compNames: compNames.filter((name) => !matchedNames.has(name)),
    },
  };
}
