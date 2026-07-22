import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { DOCS_ATTRIBUTION, toDocsUri } from "./attribution.js";

export type DocDocument = {
  /** Path relative to docs root, posix-style */
  id: string;
  uri: string;
  title: string;
  content: string;
  excerpt: string;
};

export type DocsCorpus = {
  root: string;
  documents: DocDocument[];
  byId: Map<string, DocDocument>;
};

export class DocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsError";
  }
}

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function titleFromMarkdown(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function makeExcerpt(content: string, max = 240): string {
  const plain = content.replace(/\s+/g, " ").trim();
  if (plain.length <= max) {
    return plain;
  }
  return `${plain.slice(0, max - 1)}…`;
}

export async function loadDocsCorpus(root: string): Promise<DocsCorpus> {
  if (!existsSync(root)) {
    throw new DocsError(`Docs corpus path does not exist: ${root}. Run \`npm run docs:fetch\`.`);
  }

  const files = await walkMarkdown(root);
  if (files.length === 0) {
    throw new DocsError(
      `Docs corpus contains no markdown files: ${root}. Run \`npm run docs:fetch\`.`,
    );
  }

  const documents: DocDocument[] = [];
  const byId = new Map<string, DocDocument>();

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const id = relative(root, file).replace(/\\/g, "/");
    const title = titleFromMarkdown(content, id);
    const doc: DocDocument = {
      id,
      uri: toDocsUri(id),
      title,
      content,
      excerpt: makeExcerpt(content),
    };
    documents.push(doc);
    byId.set(id, doc);
  }

  documents.sort((a, b) => a.id.localeCompare(b.id));
  return { root, documents, byId };
}

export function formatDocPayload(doc: DocDocument): string {
  return [
    `# ${doc.title}`,
    "",
    `URI: ${doc.uri}`,
    `Path: ${doc.id}`,
    "",
    DOCS_ATTRIBUTION,
    "",
    "---",
    "",
    doc.content,
  ].join("\n");
}
