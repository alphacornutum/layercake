import { parse } from "acorn";
import * as eslintScope from "eslint-scope";

const AE_RUNTIME_GLOBALS = new Set([
  "AlphaMode",
  "AVLayer",
  "CameraLayer",
  "CompItem",
  "Error",
  "FieldSeparationType",
  "File",
  "FileSource",
  "FolderItem",
  "FontCapsOption",
  "FootageItem",
  "JSON",
  "KeyframeInterpolationType",
  "LightLayer",
  "Math",
  "Number",
  "Object",
  "ParagraphJustification",
  "PlaceholderSource",
  "PropertyType",
  "PropertyValueType",
  "ShapeLayer",
  "SolidSource",
  "String",
  "TextLayer",
  "TimeDisplayType",
  "TrackMatteType",
  "app",
  "isNaN",
  "undefined",
]);

const ENTRY_PREAMBLE_GLOBALS = {
  "get-item-refs": new Set(["__itemId"]),
  "get-layer": new Set(["__args"]),
  "get-source": new Set(["__args"]),
  "patch-apply": new Set(["MAX_TARGETS", "UNDO_NAME", "payload"]),
};

function stripTrailingCommas(code) {
  let prev;
  let next = code;
  do {
    prev = next;
    next = next.replace(/,(\s*[\]}])/g, "$1");
  } while (next !== prev);
  return next;
}

function toExtendScriptAscii(code) {
  const withoutDirectives = code
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("// @ts-") && !trimmed.startsWith("/// <reference");
    })
    .join("\n");

  return withoutDirectives
    .replaceAll("\u2014", "--")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("\u2026", "...")
    .replace(/[^\t\n\r\x20-\x7E]/g, "?");
}

function hasCompilerDirective(code) {
  return code.split("\n").some((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("// @") || trimmed.startsWith("/// <reference");
  });
}

function findUnexpectedGlobals(name, ast) {
  const scopeManager = eslintScope.analyze(ast, {
    ecmaVersion: 3,
    sourceType: "script",
    optimistic: true,
    ignoreEval: true,
  });
  const entryGlobals = ENTRY_PREAMBLE_GLOBALS[name] ?? new Set();
  const unexpected = new Map();
  for (const ref of scopeManager.globalScope.through) {
    const identifier = ref.identifier;
    if (!AE_RUNTIME_GLOBALS.has(identifier.name) && !entryGlobals.has(identifier.name)) {
      unexpected.set(identifier.name, identifier.loc?.start.line ?? 0);
    }
  }
  return unexpected;
}

export function sanitizeExtendScript(code) {
  return toExtendScriptAscii(stripTrailingCommas(code));
}

export function assertExtendScriptCompatible(name, code) {
  const failures = [];
  if (/[^\t\n\r\x20-\x7E]/.test(code)) failures.push("contains non-ASCII bytes");
  if (hasCompilerDirective(code)) failures.push("contains a compiler/directive comment");
  if (/,(?:\s*[\]}])/.test(code)) failures.push("contains an ES3-illegal trailing comma");

  let ast;
  try {
    ast = parse(code, {
      ecmaVersion: 3,
      allowReturnOutsideFunction: true,
      locations: true,
      ranges: true,
    });
  } catch (error) {
    failures.push(`is not valid ECMAScript 3: ${error instanceof Error ? error.message : error}`);
  }

  if (ast) {
    const unexpected = findUnexpectedGlobals(name, ast);
    if (unexpected.size > 0) {
      const details = [...unexpected]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([globalName, line]) => `${globalName} (line ${line})`)
        .join(", ");
      failures.push(`contains undeclared non-host globals: ${details}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Unsafe AE script ${name}.jsx:\n- ${failures.join("\n- ")}`);
  }
}
