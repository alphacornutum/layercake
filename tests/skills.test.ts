import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PRODUCT_SKILL_ENTRY_URI,
  PRODUCT_SKILL_NAME,
  buildSkillIndex,
  getSkillFile,
  loadProductSkill,
  parseSkillFrontmatter,
  resolveSkillPath,
} from "../src/skills/load.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

async function writeSkillTree(opts?: {
  name?: string;
  description?: "folded" | "plain" | "missing";
  extraFile?: boolean;
}): Promise<string> {
  const skillsRoot = await mkdtemp(join(tmpdir(), "layercake-skills-"));
  cleanupRoots.push(skillsRoot);
  const skillDir = join(skillsRoot, PRODUCT_SKILL_NAME);
  await mkdir(skillDir, { recursive: true });

  const name = opts?.name ?? PRODUCT_SKILL_NAME;
  let frontmatter: string;
  if (opts?.description === "missing") {
    frontmatter = `---\nname: "${name}"\n---\n`;
  } else if (opts?.description === "plain") {
    frontmatter = `---\nname: "${name}"\ndescription: "Plain skill description"\n---\n`;
  } else {
    frontmatter = `---
name: "${name}"
description: >-
  Use this skill when driving After Effects
  via LayerCake MCP tools.
---
`;
  }

  await writeFile(
    join(skillDir, "SKILL.md"),
    `${frontmatter}\n# Drive After Effects\n\nInventory first.\n`,
    "utf8",
  );

  if (opts?.extraFile) {
    await writeFile(join(skillDir, "notes.md"), "# Notes\n", "utf8");
  }

  return skillsRoot;
}

describe("parseSkillFrontmatter", () => {
  it("parses folded description blocks", () => {
    const parsed = parseSkillFrontmatter(`---
name: "drive-after-effects"
description: >-
  Line one
  Line two
---
# Body
`);
    expect(parsed).toEqual({
      name: "drive-after-effects",
      description: "Line one Line two",
    });
  });

  it("parses plain quoted description", () => {
    const parsed = parseSkillFrontmatter(`---
name: drive-after-effects
description: "Hello world"
---
`);
    expect(parsed).toEqual({
      name: "drive-after-effects",
      description: "Hello world",
    });
  });
});

describe("loadProductSkill", () => {
  it("loads files, URIs, and frontmatter", async () => {
    const skillsRoot = await writeSkillTree({ extraFile: true });
    const skill = await loadProductSkill(skillsRoot);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe(PRODUCT_SKILL_NAME);
    expect(skill!.description).toContain("driving After Effects");
    expect(skill!.files.map((f) => f.relativePath).sort()).toEqual(["SKILL.md", "notes.md"].sort());
    expect(skill!.byPath.get("SKILL.md")?.uri).toBe(PRODUCT_SKILL_ENTRY_URI);
    expect(skill!.byPath.get("SKILL.md")?.mimeType).toBe("text/markdown");
    expect(skill!.byPath.get("notes.md")?.uri).toBe(`skill://${PRODUCT_SKILL_NAME}/notes.md`);
  });

  it("soft-fails when skills directory is missing", async () => {
    const skill = await loadProductSkill(join(tmpdir(), "layercake-no-skills-dir"));
    expect(skill).toBeNull();
  });

  it("soft-fails when frontmatter name mismatches", async () => {
    const skillsRoot = await writeSkillTree({ name: "other-skill" });
    const skill = await loadProductSkill(skillsRoot);
    expect(skill).toBeNull();
  });

  it("soft-fails when description is missing", async () => {
    const skillsRoot = await writeSkillTree({ description: "missing" });
    const skill = await loadProductSkill(skillsRoot);
    expect(skill).toBeNull();
  });
});

describe("skill index and URI mapping", () => {
  it("builds skill://index.json payload", async () => {
    const skillsRoot = await writeSkillTree();
    const skill = await loadProductSkill(skillsRoot);
    const index = buildSkillIndex(skill!);
    expect(index).toEqual({
      skills: [
        {
          name: PRODUCT_SKILL_NAME,
          type: "skill-md",
          description: skill!.description,
          url: PRODUCT_SKILL_ENTRY_URI,
        },
      ],
    });
  });

  it("resolves skill URIs and relative paths", async () => {
    const skillsRoot = await writeSkillTree();
    const skill = await loadProductSkill(skillsRoot);
    expect(resolveSkillPath(PRODUCT_SKILL_ENTRY_URI)).toBe("SKILL.md");
    expect(resolveSkillPath("SKILL.md")).toBe("SKILL.md");
    expect(resolveSkillPath("skill://other/SKILL.md")).toBeNull();
    expect(getSkillFile(skill!, PRODUCT_SKILL_ENTRY_URI)?.relativePath).toBe("SKILL.md");
    expect(getSkillFile(skill!, "missing.md")).toBeUndefined();
  });
});
