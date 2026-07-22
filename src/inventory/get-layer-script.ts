import { loadAeScript } from "../host/load-ae-script.js";
import type { GetLayerArgs, LayerInspectDetail } from "./types.js";

export type ResolvedGetLayerArgs = {
  compId: number | null;
  compName: string | null;
  layerId: number | null;
  layerName: string | null;
  detail: LayerInspectDetail;
  matchNames: string[] | null;
  atTime: number | null;
  preExpression: boolean;
};

export function resolveGetLayerArgs(input: GetLayerArgs): ResolvedGetLayerArgs {
  const hasCompId = input.compId !== undefined;
  const hasCompName = input.compName !== undefined;
  if (hasCompId === hasCompName) throw new Error("Provide exactly one of compId or compName");
  const hasLayerId = input.layerId !== undefined;
  const hasLayerName = input.layerName !== undefined;
  if (hasLayerId === hasLayerName) throw new Error("Provide exactly one of layerId or layerName");
  const detail = input.detail ?? "overview";
  if (detail !== "overview" && detail !== "extended" && detail !== "full") {
    throw new Error('detail must be "overview", "extended", or "full"');
  }
  return {
    compId: hasCompId ? input.compId! : null,
    compName: hasCompName ? input.compName! : null,
    layerId: hasLayerId ? input.layerId! : null,
    layerName: hasLayerName ? input.layerName! : null,
    detail,
    matchNames: input.matchNames?.length ? input.matchNames : null,
    atTime: input.atTime ?? null,
    preExpression: input.preExpression ?? true,
  };
}

export function buildGetLayerScript(input: GetLayerArgs): string {
  return [
    `var __args = ${JSON.stringify(resolveGetLayerArgs(input))};`,
    loadAeScript("get-layer"),
  ].join("\n\n");
}
