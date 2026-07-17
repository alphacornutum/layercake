import type { AeHost } from "../host/types.js";
import { LIST_FOLDERS_SCRIPT } from "./list-folders-script.js";
import { parseFolderInventory } from "./parse.js";
import type { FolderInventory } from "./types.js";

export async function listFolders(host: AeHost, timeoutMs: number): Promise<FolderInventory> {
  const result = await host.evalScript(LIST_FOLDERS_SCRIPT, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  const inventory = parseFolderInventory(result.result);
  // Normalize empty root name in case ExtendScript returned blank.
  if (!inventory.root.name) {
    inventory.root.name = "Root";
  }
  return inventory;
}

export { LIST_FOLDERS_SCRIPT } from "./list-folders-script.js";
export { parseFolderInventory } from "./parse.js";
export type { FolderInventory, FolderTreeLeaf, FolderTreeNode } from "./types.js";
