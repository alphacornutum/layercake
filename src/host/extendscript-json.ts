import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let cachedPolyfill: string | null = null;

/**
 * Load Douglas Crockford's json2 via [extendscript-json](https://github.com/theasci/extendscript-json)
 * so ExtendScript gets `JSON.stringify` / `JSON.parse`.
 */
export function getExtendScriptJsonPolyfill(): string {
  if (cachedPolyfill !== null) {
    return cachedPolyfill;
  }
  const json2Path = require.resolve("extendscript-json/lib/json2.js");
  cachedPolyfill = readFileSync(json2Path, "utf8");
  return cachedPolyfill;
}
