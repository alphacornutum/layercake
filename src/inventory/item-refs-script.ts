import { loadAeHelperScript, loadAeScript } from "../host/load-ae-script.js";
import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * Shared ExtendScript for inbound project-item reference collection.
 * Used by ae_get_item_refs and safe_delete_project_item.
 */
export const SHARED_ITEM_REFS_HELPERS = loadAeHelperScript("helpers-item-refs");

export function buildGetItemRefsScript(itemId: number): string {
  return [
    SHARED_INVENTORY_HELPERS,
    `var __itemId = ${itemId}; // {"itemId":${itemId}}`,
    loadAeScript("get-item-refs"),
  ].join("\n\n");
}
