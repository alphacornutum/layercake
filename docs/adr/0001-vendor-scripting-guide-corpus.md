# Vendor the Scripting Guide markdown locally

We need an offline docs corpus for `ae_docs_*` / `ae://docs/...`. Upstream ([docsforadobe/after-effects-scripting-guide](https://github.com/docsforadobe/after-effects-scripting-guide)) is a MkDocs site, not an npm package, so we fetch its `docs/` markdown into `vendor/` via `npm run docs:fetch` and load it at runtime from the LayerCake **package root** (skills parity), shipping that tree in the npm `"files"` list.

## Status

accepted

## Considered options

- **npm dependency** — There is no published package. A git dependency would pull MkDocs/Python scaffolding we do not use, and npm has no clean way to sparse-checkout only `docs/`.
- **Git submodule** — Same local-corpus idea with more git ceremony; rejected in favor of an explicit fetch script plus attribution notice.
- **Context7-only / live proxy** — Couples core UX to network and another MCP; kept as an optional complement, not the primary corpus.
- **Scrape the HTML site** — Worse than using the source markdown repo.
- **`AE_DOCS_PATH` / cwd-relative default** — Fragile when the MCP client’s cwd is not the package root; removed in favor of package-local resolve only.

## Consequences

- Runtime only needs a directory of `.md` files under `vendor/after-effects-scripting-guide/docs` on the package root; how they arrived is irrelevant (`loadDocsCorpus`).
- Published installs get the corpus via `package.json` `"files"`; maintainer refresh stays `npm run docs:fetch`. Fresh clones without a committed/fetched `vendor/` tree need `docs:fetch` before docs tools work — there is no env override.
- Do not hand-edit guide pages under `vendor/`; regenerate and keep `ATTRIBUTION.md`.
- Package size grows by ~1MB of markdown; accepted for offline agent UX.
