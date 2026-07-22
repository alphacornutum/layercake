## 1. Scaffold AE TypeScript project

- [x] 1.1 Add `types-for-adobe` devDependency and pin AE script types to `AfterEffects/24.6`
- [x] 1.2 Add `tsconfig.ae.json` (no Node types; AE 24.6 typedefs only) and `src/ae-scripts/` layout (`shared/`, `inventory/`, `patch/`)
- [x] 1.3 Add ES3 emit toolchain (Rollup + TypeScript plugin or equivalent) with one self-contained entry output per eval payload under `dist/ae-scripts/` (or agreed generated tree)
- [x] 1.4 Wire `build:ae-scripts` into `package.json` `build` / `typecheck` / `test` (and `dev` as needed) so emit + AE typecheck are not optional
- [x] 1.5 Add a thin Node loader helper that supplies emitted ES3 source strings to inventory/patch callers

## 2. Spike migration

- [x] 2.1 Migrate one small script (prefer `list-folders`) from string template to typed `src/ae-scripts` + emit + loader
- [x] 2.2 Confirm existing unit tests for that path pass; run `test:ae` for the path when host is available
- [x] 2.3 Document the spike pattern (entry export shape, shared imports, loader usage) for the remaining migrations

## 3. Migrate inventory and shared helpers

- [x] 3.1 Migrate shared inventory helpers (`shared-script`, resolve, text-document, and any other shared string blobs) into typed modules
- [x] 3.2 Migrate remaining inventory `*-script.ts` entrypoints to typed sources + loaders; remove obsolete template bodies
- [x] 3.3 Keep TypeScript-side parse/filter/Zod ownership unchanged; only move host-evaluated bodies

## 4. Migrate patch scripts

- [x] 4.1 Migrate `apply-script` / `apply-control-plane-script` (and related patch ExtendScript) to typed sources + emit
- [x] 4.2 Ensure patch unit tests still assert required emit contents / behavior; adjust fixtures only as needed for loader paths

## 5. Product baseline and agent guidance

- [x] 5.1 Update README / setup / troubleshooting (and version-floor error strings) to **After Effects 24.6+**; remove contradictory 26+ minimum claims
- [x] 5.2 Update `.ai/src/` rules (`extendscript`, `architecture`, `placement`) for `src/ae-scripts/`, modern-TS→ES3 emit, and globs; run `agentsync sync`
- [x] 5.3 Add short ADR under `docs/adr/` explaining typed AE scripts via Types-for-Adobe (not bolt-cep) and types≠guide authority

## 6. Verify

- [x] 6.1 Run full QA: `agentsync check` (with unrestricted permissions in Cursor), `npm audit --audit-level=high`, `typecheck`, `lint`, `fmt:check`, `test`, `build`
- [x] 6.2 Run `npm run test:ae` when host env is configured; note skip otherwise
- [x] 6.3 Confirm public `ae_*` JSON contracts and `wrapExtendScript` OK/ERR protocol are unchanged
