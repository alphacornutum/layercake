import type { AeHost } from "../host/types.js";
import { LIST_SOURCES_SCRIPT } from "./list-sources-script.js";
import { parseSourceInventory } from "./parse.js";
import type { SourceInventory } from "./types.js";

export async function listSources(host: AeHost, timeoutMs: number): Promise<SourceInventory> {
  const result = await host.evalScript(LIST_SOURCES_SCRIPT, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  return parseSourceInventory(result.result);
}

export { LIST_SOURCES_SCRIPT } from "./list-sources-script.js";
export { parseSourceInventory } from "./parse.js";
export type { InventorySource, SourceInventory } from "./types.js";
