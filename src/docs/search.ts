import { fromDocsUri } from "./attribution.js";
import type { DocDocument, DocsCorpus } from "./corpus.js";
import { DocsError, formatDocPayload } from "./corpus.js";

export type DocSearchHit = {
  uri: string;
  id: string;
  title: string;
  excerpt: string;
  score: number;
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_.]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function scoreDoc(doc: DocDocument, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }
  const hayTitle = doc.title.toLowerCase();
  const hayId = doc.id.toLowerCase();
  const hayBody = doc.content.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hayTitle.includes(token)) score += 8;
    if (hayId.includes(token)) score += 5;
    if (hayBody.includes(token)) {
      score += 2;
      const occurrences = hayBody.split(token).length - 1;
      score += Math.min(occurrences, 10) * 0.25;
    }
  }
  return score;
}

export function searchDocs(corpus: DocsCorpus, query: string, limit = 8): DocSearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }
  const hits = corpus.documents
    .map((doc) => ({
      uri: doc.uri,
      id: doc.id,
      title: doc.title,
      excerpt: doc.excerpt,
      score: scoreDoc(doc, tokens),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits.slice(0, limit);
}

export function getDoc(
  corpus: DocsCorpus,
  uriOrId: string,
): { text: string; uri: string; id: string } {
  const id = fromDocsUri(uriOrId);
  const doc = corpus.byId.get(id);
  if (!doc) {
    throw new DocsError(`Documentation not found: ${uriOrId}`);
  }
  return { text: formatDocPayload(doc), uri: doc.uri, id: doc.id };
}
