import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DOCS_ATTRIBUTION, toDocsUri } from "../src/docs/attribution.js";
import { loadDocsCorpus } from "../src/docs/corpus.js";
import { getDoc, searchDocs } from "../src/docs/search.js";

const cleanupRoots: string[] = [];

afterEach(async () => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

async function writeMiniCorpus(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "layercake-docs-"));
  cleanupRoots.push(root);
  const projectDir = join(root, "general");
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, "application.md"),
    `# Application object\n\nThe \`app\` object represents After Effects.\n\n## app.project\n\nAccess the current Project.\n`,
    "utf8",
  );
  await writeFile(
    join(projectDir, "compitem.md"),
    `# CompItem\n\nA CompItem is a composition in the Project panel.\n`,
    "utf8",
  );
  return root;
}

describe("docs corpus search/get", () => {
  it("searches and retrieves with URI parity and attribution", async () => {
    const root = await writeMiniCorpus();
    const corpus = await loadDocsCorpus(root);

    const hits = searchDocs(corpus, "CompItem");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.uri).toBe(toDocsUri("general/compitem.md"));
    expect(hits[0]?.title).toMatch(/CompItem/i);

    const empty = searchDocs(corpus, "zzznomatchqqq");
    expect(empty).toEqual([]);

    const doc = getDoc(corpus, hits[0]!.uri);
    expect(doc.text).toContain(DOCS_ATTRIBUTION);
    expect(doc.text).toContain("CompItem");
    expect(doc.uri).toBe(hits[0]!.uri);

    const byPath = getDoc(corpus, "general/application.md");
    expect(byPath.text).toContain("app.project");
  });

  it("throws not-found for unknown id", async () => {
    const root = await writeMiniCorpus();
    const corpus = await loadDocsCorpus(root);
    expect(() => getDoc(corpus, "ae://docs/missing.md")).toThrow(/not found/i);
  });
});
