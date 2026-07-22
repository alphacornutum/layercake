## Context

`ae_docs_*` loads markdown from a path on `AeConfig.docsPath`, defaulting to `resolve(cwd, "vendor/after-effects-scripting-guide/docs")` with optional `AE_DOCS_PATH`. Product skills already resolve from `import.meta.url` → package root and ship via `package.json` `"files": ["dist", "skills"]`. Docs do neither, so MCP clients whose cwd is not the LayerCake package root (common in multi-root / template workspaces) report a missing corpus even when `vendor/` exists next to the server.

ADR 0001 chose vendor-via-fetch over npm/git-submodule/Context7; it left package-shipping and cwd coupling as open friction. This change closes that gap without changing search/get/resource behavior.

## Goals / Non-Goals

**Goals:**

- Docs corpus path is always relative to the LayerCake package root (dev `tsx`/`src` and published `dist` alike).
- Remove `AE_DOCS_PATH` entirely — no operator override.
- Published npm tarball includes the corpus so installs work without a postinstall fetch.
- Clear missing-corpus errors that point at `npm run docs:fetch` / ensuring `vendor/` is present — not an env var.
- Align operator docs, ADR 0001 consequences, and `ARCHITECTURE.md` with package-local shipping.

**Non-Goals:**

- Changing BM25/search, URI scheme (`ae://docs/...`), or attribution text.
- Publishing a separate docs-only npm package.
- `postinstall` network fetch of the guide.
- Embedding markdown into JS bundles / build-time codegen of the corpus.
- Changing how `docs:fetch` refreshes upstream (still the maintainer path).

## Decisions

### 1. Package-root resolution (mirror skills)

**Choice:** Resolve corpus as `join(packageRoot, "vendor/after-effects-scripting-guide/docs")` using the same `import.meta.url` → parent-of-`src`/`dist` rule as `resolvePackageRoot` in `src/skills/load.ts`.

**Alternatives considered:**

- Keep cwd-relative default + document “always start MCP from package root” — fragile; fails in real multi-root setups.
- Build-time copy into `dist/docs/` — works, but duplicates files and adds build steps; package-root `vendor/` already matches the mental model of `skills/`.

**Shared helper:** Extract `resolvePackageRoot` to a tiny shared module (e.g. `src/package-root.ts`) used by skills and docs, so both assets share one definition. Avoid docs → skills or skills → docs imports.

**Config shape:** Stop putting env-derived `docsPath` on `loadConfig`. Callers (`src/index.ts`) resolve the path via the shared helper / `resolveDocsCorpusPath()` when loading the corpus. Error strings in `server.ts` use the resolved path (or a constant relative description), not `config.docsPath`. If something still needs the path for messages, pass it alongside the corpus or resolve again — do not resurrect an env field on `AeConfig`.

### 2. Delete `AE_DOCS_PATH`

**Choice:** Remove from `loadConfig`, `.env.example`, troubleshooting tables, and all agent/operator docs. No undocumented escape hatch.

**Alternatives considered:**

- Keep override for custom forks — rejected per product decision; fork the package or replace `vendor/` in a checkout if needed.

### 3. Ship `vendor/` in the npm package

**Choice:** Add `vendor/after-effects-scripting-guide` to `package.json` `"files"` (alongside `dist` and `skills`). Rely on the already-tracked vendor tree (~1MB markdown) so `npm pack` / publish includes docs + `ATTRIBUTION.md`.

**Alternatives considered:**

- Ship only `docs/**/*.md` + attribution via a narrower files glob — nicer tarball, more fragile globs; whole vendor subtree is simpler and already committed.
- `postinstall` fetch — network/offline fragility; rejected.

**Dev clones:** If `vendor/…/docs` is missing, `docs:fetch` remains the fix (same as today, minus the env var). Prefer keeping the corpus committed so clones work without a fetch step when possible.

### 4. ADR

**Choice:** Amend [ADR 0001](../../../docs/adr/0001-vendor-scripting-guide-corpus.md) consequences: package-root load, ship in `"files"`, no `AE_DOCS_PATH`. Do not rewrite the original “why vendor” decision. Optionally add a one-line **Status** note that runtime location is package-local (skills parity).

## Risks / Trade-offs

- **[Risk] `resolvePackageRoot` wrong under unexpected layouts** (e.g. bundled single-file binary) → Mitigation: same two-level `../..` from `src/*` / `dist/*` as skills today; add a unit test that asserts docs path ends with `vendor/after-effects-scripting-guide/docs` relative to a fake package root.
- **[Risk] npm package size grows ~1MB** → Acceptable; offline docs are the product. Document in ADR.
- **[Risk] Incomplete vendor in git** (sparse checkout / someone deleted docs) → Missing-corpus error + `docs:fetch`; publish CI should fail or warn if `"files"` payload lacks markdown.
- **[Risk] Callers still set `AE_DOCS_PATH` in old MCP configs** → Harmless no-op once removed from code; update docs so configs stop advertising it. **BREAKING** only for anyone who depended on a _custom_ corpus path.
- **[Trade-off] No custom corpus path** → Simpler operator model; power users edit/replace `vendor/` in a fork.

## Migration Plan

1. Implement package-root resolve + remove env; update tests.
2. Extend `"files"`; verify `npm pack` lists vendor markdown.
3. Sweep docs / `.env.example` / `.ai/src` / ADR 0001 / `ARCHITECTURE.md`.
4. After publish: installs get docs without env; old `AE_DOCS_PATH` in client configs can be deleted at leisure.

Rollback: restore cwd + env resolution (undesirable); no data migration.

## Open Questions

None — product chose package-local only, delete the variable, ship for npm.
