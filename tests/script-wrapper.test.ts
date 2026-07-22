import { describe, expect, it } from "vitest";

import { scanEs5PlusDenylist, validateAgentExtendScript } from "../src/host/extendscript-compat.js";
import {
  parseScriptResultFile,
  validateScriptSource,
  wrapExtendScript,
} from "../src/host/script-wrapper.js";

describe("validateAgentExtendScript", () => {
  it("rejects empty scripts", () => {
    const result = validateAgentExtendScript("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it("accepts ES3 var/for and returns trimmed source", () => {
    const result = validateAgentExtendScript("  var x = 1;\nreturn x;  ");
    expect(result).toEqual({
      ok: true,
      source: "var x = 1;\nreturn x;",
      denylistHits: [],
    });
  });

  it("refuses const", () => {
    const result = validateAgentExtendScript("const x = 1; return x;");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/ECMAScript 3|ExtendScript/i);
      expect(result.error).toMatch(/var/);
    }
  });

  it("refuses arrow functions", () => {
    const result = validateAgentExtendScript("return [1, 2].map(n => n);");
    expect(result.ok).toBe(false);
  });

  it("refuses optional chaining", () => {
    const result = validateAgentExtendScript("return app?.project;");
    expect(result.ok).toBe(false);
  });

  it("refuses non-ASCII", () => {
    const result = validateAgentExtendScript("var x = 'café'; return x;");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/non-ASCII/i);
  });

  it("refuses compiler directive comments", () => {
    const result = validateAgentExtendScript("// @ts-nocheck\nreturn 1;");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/directive/i);
  });

  it("strips trailing commas then accepts", () => {
    const result = validateAgentExtendScript("return ({ a: 1, b: 2, });");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("return ({ a: 1, b: 2 });");
  });

  it("does not refuse denylist alone", () => {
    const result = validateAgentExtendScript(
      "var xs = [1,2];\nreturn xs.map(function(n) { return n; }).join(',');",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.denylistHits).toContain(".map(");
    }
  });

  it("mentions denylist hits when hard-refusing", () => {
    const result = validateAgentExtendScript(
      "const xs = [1];\nreturn xs.map(function(n) { return n; });",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/\.map\(/);
      expect(result.denylistHits).toContain(".map(");
    }
  });
});

describe("scanEs5PlusDenylist", () => {
  it("detects Object.assign", () => {
    expect(scanEs5PlusDenylist("Object.assign({}, a)")).toContain("Object.assign(");
  });
});

describe("validateScriptSource", () => {
  it("rejects empty scripts", () => {
    expect(() => validateScriptSource("   \n  ")).toThrow(/empty/i);
  });

  it("returns comma-stripped ES3 source", () => {
    expect(validateScriptSource("  return ({a:1,});  ")).toBe("return ({a:1});");
  });

  it("throws dialect error for modern syntax", () => {
    expect(() => validateScriptSource("const x = 1;")).toThrow(/ExtendScript|ECMAScript 3/i);
  });
});

describe("wrapExtendScript", () => {
  it("embeds output path and user source", () => {
    const wrapped = wrapExtendScript("return app.project.numItems;", "/tmp/out.txt");
    expect(wrapped).toContain("/tmp/out.txt");
    expect(wrapped).toContain("return app.project.numItems;");
    expect(wrapped).toContain("OK\\n");
  });

  it("injects extendscript-json (json2) so JSON.stringify is available", () => {
    const wrapped = wrapExtendScript("return JSON.stringify({a:1});", "/tmp/out.txt");
    expect(wrapped).toContain("JSON.stringify");
    expect(wrapped).toMatch(/typeof JSON !== "object"/);
    expect(wrapped).toContain("return JSON.stringify({a:1});");
  });
});

describe("parseScriptResultFile", () => {
  it("parses OK payload", () => {
    expect(parseScriptResultFile("OK\n42")).toEqual({
      ok: true,
      result: "42",
    });
  });

  it("parses OK payload with classic Mac CR newlines", () => {
    expect(parseScriptResultFile("OK\r3")).toEqual({
      ok: true,
      result: "3",
    });
  });

  it("parses ERR payload with line", () => {
    expect(parseScriptResultFile("ERR\nbad thing\nline=12")).toEqual({
      ok: false,
      error: "bad thing",
      line: 12,
    });
  });

  it("handles invalid status", () => {
    const parsed = parseScriptResultFile("nope");
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/Invalid result/);
  });
});
