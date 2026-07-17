# Scripting guide corpus

LayerCake can search and read After Effects scripting documentation offline via `ae_docs_search`, `ae_docs_get`, and MCP resources under `ae://docs/...`.

## Fetch the guide

```bash
npm run docs:fetch
```

This downloads markdown from [`docsforadobe/after-effects-scripting-guide`](https://github.com/docsforadobe/after-effects-scripting-guide) into `vendor/after-effects-scripting-guide/` (originally based on Adobe’s After Effects Scripting Guide).

Override the corpus directory with `AE_DOCS_PATH` if needed.

Do not hand-edit guide pages under `vendor/`; regenerate with `docs:fetch`. Keep `vendor/after-effects-scripting-guide/ATTRIBUTION.md`.

## Attribution and licensing

Guide content remains subject to its original attribution and licensing. **© Adobe Systems Incorporated.** See:

```text
vendor/after-effects-scripting-guide/ATTRIBUTION.md
```

(after a successful fetch).

## Why vendor instead of npm?

Upstream is a MkDocs documentation repo, not a Node package. LayerCake vendors the markdown locally rather than depending on another MCP or network at runtime. Design rationale: [ADR 0001](adr/0001-vendor-scripting-guide-corpus.md).

You can also use [Context7’s packaging](https://context7.com/docsforadobe/after-effects-scripting-guide) of the same guide as a complementary MCP; LayerCake’s `ae_docs_*` tools work offline without it.

## See also

- [Setup and connection](setup.md)
- [Troubleshooting](troubleshooting.md)
