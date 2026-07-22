import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveDocsCorpusPath } from "../src/docs/paths.js";
import { resolvePackageRoot } from "../src/package-root.js";
import { resolveSkillsRoot } from "../src/skills/load.js";

describe("resolvePackageRoot", () => {
  it("resolves package root from the shared module under src/", () => {
    const root = resolvePackageRoot();
    // src/package-root.ts → parent is package root
    expect(root).toBe(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  });

  it("respects an explicit module URL under src/", () => {
    const fakeModule = pathToFileURL(join("/pkg", "src", "package-root.js")).href;
    expect(resolvePackageRoot(fakeModule)).toBe(join("/pkg"));
  });
});

describe("resolveDocsCorpusPath", () => {
  it("points at vendor docs under the package root, not cwd", () => {
    const packageRoot = "/layercake-pkg";
    expect(resolveDocsCorpusPath(packageRoot)).toBe(
      join(packageRoot, "vendor", "after-effects-scripting-guide", "docs"),
    );
  });

  it("default path is under the real package root", () => {
    const path = resolveDocsCorpusPath();
    expect(path.endsWith(join("vendor", "after-effects-scripting-guide", "docs"))).toBe(true);
    expect(path.startsWith(resolvePackageRoot())).toBe(true);
  });
});

describe("resolveSkillsRoot", () => {
  it("points at skills under the package root", () => {
    expect(resolveSkillsRoot("/layercake-pkg")).toBe(join("/layercake-pkg", "skills"));
    expect(resolveSkillsRoot()).toBe(join(resolvePackageRoot(), "skills"));
  });
});
