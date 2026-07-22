/**
 * JSON is injected at eval time by wrapExtendScript (extendscript-json polyfill).
 * Types-for-Adobe does not declare it; this shim is for authoring only.
 */
interface Json {
  parse(text: string): unknown;
  stringify(value: unknown): string;
}

declare const JSON: Json;
