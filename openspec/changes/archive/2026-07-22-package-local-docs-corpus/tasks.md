## 1. Package-root resolution

- [x] 1.1 Extract `resolvePackageRoot` to a shared module (e.g. `src/package-root.ts`) and update `src/skills/load.ts` to use it
- [x] 1.2 Add `resolveDocsCorpusPath()` (package root + `vendor/after-effects-scripting-guide/docs`)
- [x] 1.3 Remove `docsPath` / `AE_DOCS_PATH` from `loadConfig` and `AeConfig`; wire `src/index.ts` (and any callers) to resolve + load via the package-local path
- [x] 1.4 Update `server.ts` missing-corpus errors to name the resolved path and suggest `npm run docs:fetch` — never `AE_DOCS_PATH`

## 2. Package shipping

- [x] 2.1 Add `vendor/after-effects-scripting-guide` to `package.json` `"files"`
- [x] 2.2 Verify `npm pack --dry-run` (or equivalent) includes corpus markdown + `ATTRIBUTION.md`

## 3. Tests

- [x] 3.1 Update `tests/config.test.ts` — drop `AE_DOCS_PATH` / `docsPath` expectations
- [x] 3.2 Add/adjust unit coverage that docs path resolves from package root (not cwd) and skills still resolve correctly after the extract
- [x] 3.3 Ensure docs corpus tests still pass against the vendored tree

## 4. Docs and ADR

- [x] 4.1 Remove `AE_DOCS_PATH` from `.env.example`, `docs/setup.md`, `docs/scripting-guide.md`, `docs/troubleshooting.md`, and related README/CONTRIBUTING mentions
- [x] 4.2 Amend ADR 0001 consequences for package-root load, `"files"` shipping, and no env override
- [x] 4.3 Update `ARCHITECTURE.md` docs corpus narrative if it still implies cwd/vendor-only-via-env
- [x] 4.4 Update `.ai/src/` mentions of `AE_DOCS_PATH` / cwd-relative vendor, then `agentsync sync`

## 5. Verify

- [x] 5.1 Run unit tests and typecheck/lint as needed; confirm boot from a non-package cwd still loads docs when `vendor/` is present on the package
