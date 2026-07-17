import { getExtendScriptJsonPolyfill } from "./extendscript-json.js";

/**
 * Wrap user ExtendScript so evaluation always writes a result file.
 * Protocol: first line OK|ERR, remaining lines are payload (error may include line=N).
 * User scripts should `return` a value from the top-level body.
 *
 * Always injects the extendscript-json (json2) polyfill so scripts can use
 * `JSON.stringify` / `JSON.parse` in AE's ES3 host.
 */
export function wrapExtendScript(userSource: string, outPath: string): string {
  const escapedOut = outPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const jsonPolyfill = getExtendScriptJsonPolyfill();
  return `(function () {
${indentUserSource(jsonPolyfill)}
  var __outPath = "${escapedOut}";
  function __writeOut(text) {
    var f = new File(__outPath);
    f.encoding = "UTF-8";
    f.open("w");
    f.write(text);
    f.close();
  }
  try {
    var __userResult = (function () {
${indentUserSource(userSource)}
    })();
    if (__userResult === undefined || __userResult === null) {
      __userResult = "";
    }
    __writeOut("OK\\n" + String(__userResult));
  } catch (e) {
    var msg = e && e.message ? String(e.message) : String(e);
    var line = e && e.line !== undefined ? String(e.line) : "";
    __writeOut("ERR\\n" + msg + "\\nline=" + line);
  }
})();
`;
}

function indentUserSource(source: string): string {
  return source
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");
}

export function validateScriptSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("Script source is empty. Provide valid ExtendScript.");
  }
  return trimmed;
}

export function parseScriptResultFile(raw: string): {
  ok: boolean;
  result?: string;
  error?: string;
  line?: number;
} {
  // ExtendScript File often writes classic Mac (\r) or Windows (\r\n) newlines.
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const nl = normalized.indexOf("\n");
  const status = (nl === -1 ? normalized : normalized.slice(0, nl)).trim();
  const body = nl === -1 ? "" : normalized.slice(nl + 1);

  if (status === "OK") {
    return { ok: true, result: body };
  }
  if (status === "ERR") {
    const lines = body.split("\n");
    const error = lines[0] ?? "Unknown ExtendScript error";
    const lineLine = lines.find((l) => l.startsWith("line="));
    const lineRaw = lineLine?.slice("line=".length) ?? "";
    const line = lineRaw ? Number(lineRaw) : undefined;
    return {
      ok: false,
      error,
      line: Number.isFinite(line) ? line : undefined,
    };
  }
  return { ok: false, error: `Invalid result payload: ${raw}` };
}
