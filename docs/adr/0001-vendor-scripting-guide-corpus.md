# Vendor the Scripting Guide markdown locally

We need an offline docs corpus for `ae_docs_*` / `ae://docs/...`. Upstream ([docsforadobe/after-effects-scripting-guide](https://github.com/docsforadobe/after-effects-scripting-guide)) is a MkDocs site, not an npm package, so we fetch its `docs/` markdown into `vendor/` via `npm run docs:fetch` and load that path (or `AE_DOCS_PATH`) at runtime.

## Status

accepted

## Considered options

- **npm dependency** — There is no published package. A git dependency would pull MkDocs/Python scaffolding we do not use, and npm has no clean way to sparse-checkout only `docs/`.
- **Git submodule** — Same local-corpus idea with more git ceremony; rejected in favor of an explicit fetch script plus attribution notice.
- **Context7-only / live proxy** — Couples core UX to network and another MCP; kept as an optional complement, not the primary corpus.
- **Scrape the HTML site** — Worse than using the source markdown repo.

## Consequences

- Runtime only needs a directory of `.md` files; how they arrived is irrelevant (`loadDocsCorpus`).
- Fresh clones need `npm run docs:fetch` (or `AE_DOCS_PATH`) before docs tools work.
- Do not hand-edit guide pages under `vendor/`; regenerate and keep `ATTRIBUTION.md`.
- A thin published markdown-only package (or `postinstall` fetch) remains a reasonable future change if install friction becomes the pain.
