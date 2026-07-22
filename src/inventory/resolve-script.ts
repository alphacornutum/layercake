import { loadAeHelperScript } from "../host/load-ae-script.js";

/** Typed source: src/ae-scripts/shared/resolve.ts. */
const COMP_LAYER_HELPERS = loadAeHelperScript("helpers-resolve-comp-layer");
const FOOTAGE_HELPERS = loadAeHelperScript("helpers-resolve-footage");

/**
 * Compatibility exports for patch apply, which still concatenates string
 * helpers until its independent migration lands.
 */
export const SHARED_COMP_LAYER_RESOLVE_HELPERS = COMP_LAYER_HELPERS;
export const SHARED_FOOTAGE_RESOLVE_HELPERS = FOOTAGE_HELPERS;
export const SHARED_RESOLVE_HELPERS = [COMP_LAYER_HELPERS, FOOTAGE_HELPERS].join("\n\n");
