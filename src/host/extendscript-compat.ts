import { parse } from "acorn";

const SKILL_EXTENDSCRIPT_URI = "skill://drive-after-effects/references/extendscript.md";

/** Patterns that parse as ES3 but typically fail in After Effects at runtime. */
const ES5_PLUS_DENYLIST: { id: string; pattern: RegExp }[] = [
  { id: ".map(", pattern: /\.map\s*\(/ },
  { id: ".filter(", pattern: /\.filter\s*\(/ },
  { id: ".find(", pattern: /\.find\s*\(/ },
  { id: ".findIndex(", pattern: /\.findIndex\s*\(/ },
  { id: ".includes(", pattern: /\.includes\s*\(/ },
  { id: ".flat(", pattern: /\.flat\s*\(/ },
  { id: ".flatMap(", pattern: /\.flatMap\s*\(/ },
  { id: ".forEach(", pattern: /\.forEach\s*\(/ },
  { id: "Object.assign(", pattern: /\bObject\.assign\s*\(/ },
  { id: "Array.from(", pattern: /\bArray\.from\s*\(/ },
  { id: ".startsWith(", pattern: /\.startsWith\s*\(/ },
  { id: ".endsWith(", pattern: /\.endsWith\s*\(/ },
];

export type AgentExtendScriptResult =
  | { ok: true; source: string; denylistHits: string[] }
  | { ok: false; error: string; denylistHits: string[] };

function stripTrailingCommas(code: string): string {
  let prev: string;
  let next = code;
  do {
    prev = next;
    next = next.replace(/,(\s*[\]}])/g, "$1");
  } while (next !== prev);
  return next;
}

function hasCompilerDirective(code: string): boolean {
  return code.split("\n").some((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("// @") || trimmed.startsWith("/// <reference");
  });
}

export function scanEs5PlusDenylist(code: string): string[] {
  const hits: string[] = [];
  for (const { id, pattern } of ES5_PLUS_DENYLIST) {
    if (pattern.test(code)) hits.push(id);
  }
  return hits;
}

function dialectError(failures: string[], denylistHits: string[]): string {
  const lines = [
    "Script is not valid After Effects ExtendScript (ES3 dialect).",
    "Use var / function / for loops — not const/let, arrow functions, or other modern JS.",
    `See ${SKILL_EXTENDSCRIPT_URI} for a compact cheat sheet.`,
    ...failures.map((f) => `- ${f}`),
  ];
  if (denylistHits.length > 0) {
    lines.push(
      `- Also uses APIs typically missing in ExtendScript: ${denylistHits.join(", ")} (prefer for loops)`,
    );
  }
  return lines.join("\n");
}

/**
 * Agent-safe pre-flight for ae_eval_script (and any host.evalScript caller).
 * Hard-refuses non-ES3 syntax, non-ASCII, and compiler directives.
 * Strips trailing commas and returns that candidate on success.
 * Does not run undeclared-globals analysis (first-party emit gate only).
 */
export function validateAgentExtendScript(source: string): AgentExtendScriptResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Script source is empty. Provide valid ExtendScript.",
      denylistHits: [],
    };
  }

  const denylistHits = scanEs5PlusDenylist(trimmed);
  const failures: string[] = [];

  if (/[^\t\n\r\x20-\x7E]/.test(trimmed)) {
    failures.push("contains non-ASCII bytes (DoScriptFile encoding is unreliable)");
  }
  if (hasCompilerDirective(trimmed)) {
    failures.push("contains a compiler/directive comment (// @... or /// <reference)");
  }

  const candidate = stripTrailingCommas(trimmed);

  if (failures.length === 0) {
    try {
      parse(candidate, {
        ecmaVersion: 3,
        allowReturnOutsideFunction: true,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`not valid ECMAScript 3: ${detail}`);
    }
  }

  if (failures.length > 0) {
    return { ok: false, error: dialectError(failures, denylistHits), denylistHits };
  }

  return { ok: true, source: candidate, denylistHits };
}
