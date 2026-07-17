import type { AeHost } from "../host/types.js";
import { LIST_PROJECT_SUMMARY_SCRIPT } from "./list-project-summary-script.js";
import { parseProjectSummary } from "./parse.js";
import type { ProjectSummary } from "./types.js";

export async function listProjectSummary(host: AeHost, timeoutMs: number): Promise<ProjectSummary> {
  const result = await host.evalScript(LIST_PROJECT_SUMMARY_SCRIPT, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  return parseProjectSummary(result.result);
}

export { LIST_PROJECT_SUMMARY_SCRIPT } from "./list-project-summary-script.js";
export { parseProjectSummary } from "./parse.js";
export type {
  ProjectSummary,
  ProjectSummaryEffect,
  ProjectSummaryMissingFootage,
} from "./types.js";
