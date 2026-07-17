export const DOCS_ATTRIBUTION =
  "Source: docsforadobe/after-effects-scripting-guide (community). Guide content © Adobe Systems Incorporated. Optional upstream: Context7 library docsforadobe/after-effects-scripting-guide.";

export const DOCS_URI_PREFIX = "ae://docs/";

export function toDocsUri(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${DOCS_URI_PREFIX}${normalized}`;
}

export function fromDocsUri(uriOrId: string): string {
  const trimmed = uriOrId.trim();
  if (trimmed.startsWith(DOCS_URI_PREFIX)) {
    return trimmed.slice(DOCS_URI_PREFIX.length);
  }
  if (trimmed.startsWith("ae://docs")) {
    return trimmed.replace(/^ae:\/\/docs\/?/, "");
  }
  return trimmed.replace(/^\/+/, "");
}
