import { loadAeScript } from "../host/load-ae-script.js";
import type { GetSourceArgs, SourceInspectDetail } from "./types.js";

export type ResolvedGetSourceArgs = {
  sourceId: number | null;
  sourceName: string | null;
  detail: SourceInspectDetail;
};

export function resolveGetSourceArgs(input: GetSourceArgs): ResolvedGetSourceArgs {
  const hasId = input.sourceId !== undefined;
  const hasName = input.sourceName !== undefined;
  if (hasId === hasName) throw new Error("Provide exactly one of sourceId or sourceName");
  const detail = input.detail ?? "overview";
  if (detail !== "overview" && detail !== "full")
    throw new Error('detail must be "overview" or "full"');
  return {
    sourceId: hasId ? input.sourceId! : null,
    sourceName: hasName ? input.sourceName! : null,
    detail,
  };
}

export function buildGetSourceScript(input: GetSourceArgs): string {
  return [
    `var __args = ${JSON.stringify(resolveGetSourceArgs(input))};`,
    loadAeScript("get-source"),
  ].join("\n\n");
}
