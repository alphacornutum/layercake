import type { AeHost } from "../host/types.js";
import { buildGetLayerScript } from "./get-layer-script.js";
import { assertInspectWithinLimit } from "./inspect-limit.js";
import { formatInspectScriptError, parseLayerInspect } from "./parse.js";
import type { GetLayerArgs, LayerInspectResult } from "./types.js";

export async function getLayer(
  host: AeHost,
  input: GetLayerArgs,
  timeoutMs: number,
  inspectMaxBytes: number,
): Promise<LayerInspectResult> {
  const script = buildGetLayerScript(input);
  const result = await host.evalScript(script, timeoutMs);
  if (!result.ok) {
    throw new Error(formatInspectScriptError(result.error ?? "Unknown ExtendScript error"));
  }
  const parsed = parseLayerInspect(result.result ?? "");
  assertInspectWithinLimit(parsed, inspectMaxBytes);
  return parsed;
}

export { buildGetLayerScript, resolveGetLayerArgs } from "./get-layer-script.js";
export { assertInspectWithinLimit, InspectSizeError } from "./inspect-limit.js";
export { parseLayerInspect } from "./parse.js";
export type { GetLayerArgs, LayerInspectResult } from "./types.js";
