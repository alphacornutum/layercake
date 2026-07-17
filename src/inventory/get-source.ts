import type { AeHost } from "../host/types.js";
import { buildGetSourceScript } from "./get-source-script.js";
import { assertInspectWithinLimit } from "./inspect-limit.js";
import { formatInspectScriptError, parseSourceInspect } from "./parse.js";
import type { GetSourceArgs, SourceInspectResult } from "./types.js";

export async function getSource(
  host: AeHost,
  input: GetSourceArgs,
  timeoutMs: number,
  inspectMaxBytes: number,
): Promise<SourceInspectResult> {
  const script = buildGetSourceScript(input);
  const result = await host.evalScript(script, timeoutMs);
  if (!result.ok) {
    throw new Error(formatInspectScriptError(result.error ?? "Unknown ExtendScript error"));
  }
  const parsed = parseSourceInspect(result.result ?? "");
  assertInspectWithinLimit(parsed, inspectMaxBytes);
  return parsed;
}

export { buildGetSourceScript, resolveGetSourceArgs } from "./get-source-script.js";
export { parseSourceInspect } from "./parse.js";
export type { GetSourceArgs, SourceInspectResult } from "./types.js";
