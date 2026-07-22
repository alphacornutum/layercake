import { loadAeHelperScript } from "../host/load-ae-script.js";

/**
 * Shared inventory helpers for scripts that still concatenate string payloads
 * (patch apply, inspect builders). Typed source: src/ae-scripts/shared/inventory.ts
 */
export const SHARED_INVENTORY_HELPERS = loadAeHelperScript("helpers-inventory");
