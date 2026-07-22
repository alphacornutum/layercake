## Why

Docs corpus resolution is cwd-relative (`vendor/...` under `process.cwd()`), so launching the MCP from another workspace (e.g. `templates/`) fails even when LayerCake itself has a vendored guide. `AE_DOCS_PATH` is an operator bandage for that. Skills already resolve from the package root and ship in the npm tarball; docs should match so clone and published installs Just Work without an env var.

## What Changes

- Resolve the scripting-guide corpus from the **package root** (same pattern as `skills/`), independent of process cwd.
- **BREAKING:** Remove `AE_DOCS_PATH` from config, `.env.example`, operator docs, and error messages — no override.
- Include the vendored corpus in `package.json` `"files"` so published npm installs carry docs alongside `dist/` and `skills/`.
- Keep `npm run docs:fetch` as the maintainer refresh path; document that fresh clones need a present `vendor/` tree (committed and/or fetched) rather than an env override.
- Supersede / update [ADR 0001](../../../docs/adr/0001-vendor-scripting-guide-corpus.md) consequences for package-local shipping and deleted override.

## Capabilities

### New Capabilities

<!-- none — packaging/resolution change to existing docs capability -->

### Modified Capabilities

- `ae-scripting-docs`: Require a **bundled**, package-local corpus by default; drop “configured path / AE_DOCS_PATH” as the operator contract; missing-corpus errors must not suggest setting an env var.

## Impact

- `src/config.ts` — drop `docsPath` from env-driven config (or stop reading `AE_DOCS_PATH`; path resolved at load site).
- `src/index.ts` / `src/docs/` — load via package-root resolve (reuse or share `resolvePackageRoot` with skills).
- `package.json` `"files"` — add `vendor/after-effects-scripting-guide` (or the minimal docs + attribution subtree).
- Tests: `tests/config.test.ts`, docs load tests, any fixtures that relied on `AE_DOCS_PATH`.
- Operator docs: `.env.example`, `docs/setup.md`, `docs/scripting-guide.md`, `docs/troubleshooting.md`, `README.md` / `CONTRIBUTING.md` as needed.
- `ARCHITECTURE.md` — docs corpus path narrative.
- Agent guidance under `.ai/src/` if it documents `AE_DOCS_PATH` / cwd-relative vendor.
