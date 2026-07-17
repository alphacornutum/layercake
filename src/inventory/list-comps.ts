import type { AeHost } from "../host/types.js";
import { applyCompFilters } from "./filter.js";
import { LIST_COMPS_SCRIPT } from "./list-comps-script.js";
import { parseCompInventory } from "./parse.js";
import type { CompInventory, CompInventoryFilter } from "./types.js";

export async function listComps(
  host: AeHost,
  filter: CompInventoryFilter,
  timeoutMs: number,
): Promise<CompInventory> {
  const result = await host.evalScript(LIST_COMPS_SCRIPT, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  const inventory = parseCompInventory(result.result);
  return applyCompFilters(inventory, filter);
}

export { LIST_COMPS_SCRIPT } from "./list-comps-script.js";
export { applyCompFilters } from "./filter.js";
export { parseCompInventory } from "./parse.js";
export type {
  CompInventory,
  CompInventoryFilter,
  InventoryComposition,
  InventoryLayer,
  InventorySourceRef,
} from "./types.js";
