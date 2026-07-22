import { collectItemRefs, itemByIdForRefs, itemTypeNameForRefs } from "../shared/item-refs";

declare const __itemId: number;

export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }
  const item = itemByIdForRefs(__itemId);
  if (!item) throw new Error("Project item not found: " + __itemId);
  const collected = collectItemRefs(item);
  return JSON.stringify({
    item: { id: item.id, name: String(item.name || ""), type: itemTypeNameForRefs(item) },
    refs: collected.refs,
    unknownRefsPossible: collected.unknownRefsPossible,
    incompleteReasons: collected.incompleteReasons,
  });
}
