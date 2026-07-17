import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCT_SKILL_NAME = "drive-after-effects";
export const SKILL_URI_SCHEME = "skill://";
export const SKILL_INDEX_URI = `${SKILL_URI_SCHEME}index.json`;
export const PRODUCT_SKILL_ENTRY_URI = `${SKILL_URI_SCHEME}${PRODUCT_SKILL_NAME}/SKILL.md`;

export type SkillFile = {
  /** Path relative to the skill directory, posix-style */
  relativePath: string;
  uri: string;
  text: string;
  mimeType: string;
};

export type ProductSkill = {
  name: string;
  description: string;
  root: string;
  files: SkillFile[];
  byPath: Map<string, SkillFile>;
};

export type SkillIndexEntry = {
  name: string;
  type: "skill-md";
  description: string;
  url: string;
};

export type SkillIndex = {
  skills: SkillIndexEntry[];
};

/** Package root: parent of `src/` or `dist/` depending on runtime. */
export function resolvePackageRoot(fromUrl: string = import.meta.url): string {
  const here = dirname(fileURLToPath(fromUrl));
  // src/skills or dist/skills → package root
  return join(here, "..", "..");
}

export function resolveSkillsRoot(packageRoot: string = resolvePackageRoot()): string {
  return join(packageRoot, "skills");
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function mimeForPath(relativePath: string): string {
  if (relativePath.endsWith(".md")) {
    return "text/markdown";
  }
  if (relativePath.endsWith(".json")) {
    return "application/json";
  }
  return "text/plain";
}

function toSkillUri(skillName: string, relativePath: string): string {
  return `${SKILL_URI_SCHEME}${skillName}/${relativePath}`;
}

/**
 * Parse Agent Skills YAML frontmatter for `name` and `description`.
 * Supports plain scalars and folded (`>-` / `>`) description blocks.
 */
export function parseSkillFrontmatter(
  content: string,
): { name: string; description: string } | null {
  if (!content.startsWith("---")) {
    return null;
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return null;
  }
  const block = content.slice(4, end); // skip "---\n"

  const nameMatch = block.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!nameMatch?.[1]) {
    return null;
  }
  const name = nameMatch[1].trim();

  const folded = block.match(/^description:\s*>-?\s*\r?\n((?:[ \t]+.+\r?\n?)*)/m);
  if (folded?.[1]) {
    const description = folded[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/^[ \t]+/, ""))
      .filter((line) => line.length > 0)
      .join(" ")
      .trim();
    if (!description) {
      return null;
    }
    return { name, description };
  }

  const plain = block.match(/^description:\s*["']([^"']+)["']\s*$/m);
  if (plain?.[1]?.trim()) {
    return { name, description: plain[1].trim() };
  }

  const unquoted = block.match(/^description:\s*(.+)\s*$/m);
  if (unquoted?.[1]?.trim() && !unquoted[1].trim().startsWith(">")) {
    return { name, description: unquoted[1].trim() };
  }

  return null;
}

/**
 * Load the shipped `drive-after-effects` skill from `<skillsRoot>/drive-after-effects`.
 * Returns null when the directory or SKILL.md is missing / invalid (soft-fail).
 */
export async function loadProductSkill(
  skillsRoot: string = resolveSkillsRoot(),
): Promise<ProductSkill | null> {
  const root = join(skillsRoot, PRODUCT_SKILL_NAME);
  const skillMdPath = join(root, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    return null;
  }

  let skillMdText: string;
  try {
    skillMdText = await readFile(skillMdPath, "utf8");
  } catch {
    return null;
  }

  const meta = parseSkillFrontmatter(skillMdText);
  if (!meta || meta.name !== PRODUCT_SKILL_NAME || !meta.description) {
    return null;
  }

  let filePaths: string[];
  try {
    filePaths = await walkFiles(root);
  } catch {
    return null;
  }

  const files: SkillFile[] = [];
  const byPath = new Map<string, SkillFile>();

  for (const full of filePaths) {
    const relativePath = relative(root, full).replace(/\\/g, "/");
    let text: string;
    try {
      text = await readFile(full, "utf8");
    } catch {
      continue;
    }
    const file: SkillFile = {
      relativePath,
      uri: toSkillUri(PRODUCT_SKILL_NAME, relativePath),
      text,
      mimeType: mimeForPath(relativePath),
    };
    files.push(file);
    byPath.set(relativePath, file);
  }

  if (!byPath.has("SKILL.md")) {
    return null;
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    name: PRODUCT_SKILL_NAME,
    description: meta.description,
    root,
    files,
    byPath,
  };
}

export function buildSkillIndex(skill: ProductSkill): SkillIndex {
  return {
    skills: [
      {
        name: skill.name,
        type: "skill-md",
        description: skill.description,
        url: PRODUCT_SKILL_ENTRY_URI,
      },
    ],
  };
}

export function resolveSkillPath(uriOrPath: string): string | null {
  const prefix = `${SKILL_URI_SCHEME}${PRODUCT_SKILL_NAME}/`;
  if (uriOrPath.startsWith(prefix)) {
    return uriOrPath.slice(prefix.length);
  }
  if (uriOrPath.startsWith("skill://")) {
    return null;
  }
  return uriOrPath.replace(/^\.\//, "");
}

export function getSkillFile(skill: ProductSkill, uriOrPath: string): SkillFile | undefined {
  const relativePath = resolveSkillPath(uriOrPath);
  if (relativePath === null) {
    return undefined;
  }
  return skill.byPath.get(relativePath);
}
