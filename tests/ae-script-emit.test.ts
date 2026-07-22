import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "acorn";
import { describe, expect, it } from "vitest";

import {
  assertExtendScriptCompatible,
  sanitizeExtendScript,
} from "../scripts/ae-script-compat.mjs";

const scriptsDir = fileURLToPath(new URL("../dist/ae-scripts/", import.meta.url));
const emittedScripts = readdirSync(scriptsDir)
  .filter((name) => name.endsWith(".jsx"))
  .sort();

describe("emitted first-party AE scripts", () => {
  it("sanitizes known ExtendScript parser hazards", () => {
    const source =
      '// @ts-nocheck\n/// <reference path="types.d.ts" />\nvar x = { value: "—", };\nreturn "";';
    const sanitized = sanitizeExtendScript(source);

    expect(sanitized).not.toContain("@ts-nocheck");
    expect(sanitized).not.toContain("<reference");
    expect(sanitized).toContain('"--"');
    expect(sanitized).not.toMatch(/,(?:\s*[\]}])/);
    expect(() => assertExtendScriptCompatible("fixture", sanitized)).not.toThrow();
  });

  it("rejects syntax hazards and undeclared bundle globals", () => {
    expect(() => assertExtendScriptCompatible("fixture", "const x = 1;")).toThrow(/ECMAScript 3/);
    expect(() => assertExtendScriptCompatible("fixture", "// @ts-nocheck\nreturn '';")).toThrow(
      /directive/,
    );
    expect(() => assertExtendScriptCompatible("fixture", "missingHelper();")).toThrow(
      /undeclared non-host globals.*missingHelper/,
    );
    expect(() => assertExtendScriptCompatible("fixture", "app.project; return '';")).not.toThrow();
    expect(() =>
      assertExtendScriptCompatible("patch-apply", "payload; MAX_TARGETS; UNDO_NAME; return '';"),
    ).not.toThrow();
  });

  it("emits every entry through the mandatory compatibility gate", () => {
    expect(emittedScripts.length).toBeGreaterThan(0);

    for (const name of emittedScripts) {
      const source = readFileSync(new URL(`../dist/ae-scripts/${name}`, import.meta.url), "utf8");

      expect(source, `${name}: non-ASCII`).not.toMatch(/[^\t\n\r\x20-\x7E]/);
      expect(source, `${name}: compiler directive`).not.toMatch(/^\s*\/\/\s*@/m);
      expect(source, `${name}: triple-slash reference`).not.toMatch(/^\s*\/\/\/\s*<reference/m);
      expect(source, `${name}: trailing comma`).not.toMatch(/,(?:\s*[\]}])/);
      expect(() =>
        parse(source, {
          ecmaVersion: 3,
          allowReturnOutsideFunction: true,
        }),
      ).not.toThrow();
    }
  });
});
