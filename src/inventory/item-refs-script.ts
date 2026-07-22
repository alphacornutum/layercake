import { loadAeScript } from "../host/load-ae-script.js";

/**
 * Build the eval payload for ae_get_item_refs.
 * The emitted get-item-refs entry is self-contained; only inject __itemId.
 */
export function buildGetItemRefsScript(itemId: number): string {
  return [`var __itemId = ${itemId}; // {"itemId":${itemId}}`, loadAeScript("get-item-refs")].join(
    "\n\n",
  );
}
