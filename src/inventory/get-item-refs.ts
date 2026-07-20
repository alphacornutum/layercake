import type { AeHost } from "../host/types.js";
import { buildGetItemRefsScript } from "./item-refs-script.js";
import { parseItemRefs } from "./parse.js";
import type { ItemRefsResult } from "./types.js";

export async function getItemRefs(
  host: AeHost,
  itemId: number,
  timeoutMs: number,
): Promise<ItemRefsResult> {
  const script = buildGetItemRefsScript(itemId);
  const result = await host.evalScript(script, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  return parseItemRefs(result.result ?? "");
}

export { buildGetItemRefsScript } from "./item-refs-script.js";
export { SHARED_ITEM_REFS_HELPERS } from "./item-refs-script.js";
export { parseItemRefs } from "./parse.js";
export type { ItemRefEntry, ItemRefsResult } from "./types.js";
