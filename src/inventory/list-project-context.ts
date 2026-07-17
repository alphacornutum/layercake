import type { AeHost } from "../host/types.js";
import { LIST_PROJECT_CONTEXT_SCRIPT } from "./list-project-context-script.js";
import { parseProjectContext } from "./parse.js";
import type { ProjectContext } from "./types.js";

export async function listProjectContext(host: AeHost, timeoutMs: number): Promise<ProjectContext> {
  const result = await host.evalScript(LIST_PROJECT_CONTEXT_SCRIPT, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  return parseProjectContext(result.result);
}

export { LIST_PROJECT_CONTEXT_SCRIPT } from "./list-project-context-script.js";
export { parseProjectContext } from "./parse.js";
export type { ProjectContext } from "./types.js";
