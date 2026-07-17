import { describe, expect, it } from "vitest";

import {
  parseScriptResultFile,
  validateScriptSource,
  wrapExtendScript,
} from "../src/host/script-wrapper.js";

describe("validateScriptSource", () => {
  it("rejects empty scripts", () => {
    expect(() => validateScriptSource("   \n  ")).toThrow(/empty/i);
  });

  it("returns trimmed source", () => {
    expect(validateScriptSource("  return 1;  ")).toBe("return 1;");
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
