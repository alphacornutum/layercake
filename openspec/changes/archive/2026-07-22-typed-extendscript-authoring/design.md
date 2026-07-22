## Context

LayerCake evaluates first-party ExtendScript by concatenating string templates in `src/inventory/*-script.ts` and `src/patch/*-script.ts`, then wrapping them in `wrapExtendScript` (JSON polyfill + OK/ERR result file). The Node MCP tree uses `tsconfig.json` (`ES2022`, `types: ["node"]`). Template bodies are invisible to the typechecker, so AE DOM mistakes only fail at host runtime.

Operators already run After Effects 24.x–26.x in the wild. Product docs recently stated **26+**; Types-for-Adobe publishes **`AfterEffects/24.6`** on npm (AE 26 defs exist on GitHub but are not required if the supported floor is 24.6). `fontCapsOption` and related text APIs exist since AE 24.0, so 24.6 is a coherent types + runtime floor.

Constraints: keep macOS/Windows host bridges; preserve eval protocol; ES3 at runtime; do not pull CEP/React/Vite (bolt-cep).

## Goals / Non-Goals

**Goals:**

- Author first-party AE scripts as modern TypeScript with imports, typechecked against `types-for-adobe` / `AfterEffects/24.6`.
- Emit self-contained **ES3-compatible** script text per entrypoint for `AeHost.evalScript`.
- Gate CI / `typecheck` / `build` so AE script types cannot drift silently.
- Document supported host baseline as **After Effects 24.6+**.
- Migrate existing string-template scripts into the typed tree without changing public MCP JSON contracts.

**Non-Goals:**

- Adopting bolt-cep, CEP panels, HMR, ZXP, or CEP `evalTS()`.
- Typechecking agent-supplied `ae_eval_script` source (still opaque strings).
- Guaranteeing Types-for-Adobe equals the Scripting Guide (guide + `test:ae` remain authoritative).
- Raising or lowering the floor below 24.6 / pinning types to AE 26.
- Replacing `wrapExtendScript` or the OK/ERR result-file protocol.

## Decisions

### 1. Separate AE TypeScript project (not root `tsconfig`)

- **Decision:** `tsconfig.ae.json` (or nested project under `src/ae-scripts/`) with `types-for-adobe` After Effects 24.6 defs, **no** Node `@types/node`, libs appropriate for ExtendScript globals.
- **Why:** AE globals (`app`, `File`, `Layer`) must not pollute MCP/Node modules.
- **Alternatives:** Single tsconfig with path tricks — rejected (global collision). bolt-cep monorepo layout — rejected (CEP-shaped).

### 2. Modern TS source → ES3 emit via bundler

- **Decision:** Write modern TypeScript (`const`/`let`, arrows, imports, etc.) in `src/ae-scripts/**`. Bundle each eval entrypoint to a **single self-contained ES3** file/string (IIFE or plain script). Prefer **Rollup + TypeScript plugin** driven by `tsconfig.ae.json` `target: "ES3"` (or equivalent ES3-capable pipeline). No cross-entrypoint shared runtime chunks — each payload AE receives must stand alone.
- **Why:** Matches “modern source / ES3 host”; imports replace string concat of `SHARED_*` helpers.
- **Alternatives:** Hand-written ES3 with types only — safer emit, worse DX. `tsc` `module: None` + triple-slash — no real modules. esbuild alone — weak/no ES3 target.

### 3. Package layout and Node loading

- **Decision:** Sources live under `src/ae-scripts/` (e.g. `shared/`, `inventory/`, `patch/`). Build writes emitted `.jsx` (or `.js`) under `dist/ae-scripts/` (or a generated module tree). Inventory/patch TypeScript loaders obtain the emitted source as a string (read from package-relative path, or import a build-generated `export const …_SCRIPT`). `npm run build` (and typecheck/test prerequisites) MUST run the AE script build so packaged npm artifacts include emit output.
- **Why:** Keeps `AeHost.evalScript(string)` unchanged; ships correctly from the published package.
- **Alternatives:** Commit giant generated strings — noisy diffs. Runtime `tsc` on every eval — slow and fragile.

### 4. Types pin and host floor: 24.6+

- **Decision:** Dev-depend on `types-for-adobe` and reference **`AfterEffects/24.6`**. Document operator baseline as **AE 24.6+** (newer hosts including 26 are supported as supersets). Update README/setup examples that currently say 26-only as the _minimum_.
- **Why:** npm ships 24.6; APIs we rely on (e.g. `fontCapsOption`) exist by 24.0; user chose 24.6 compliance.
- **Alternatives:** Git-dep on AE 26.0 typedefs — unnecessary if floor is 24.6. Keep README at 26+ while typing 24.6 — confusing.

### 5. Authority: guide + host tests over typedefs

- **Decision:** When Types-for-Adobe and the vendored Scripting Guide disagree, follow the guide and host tests. Agent rules already state this; reinforce in ADR / architecture notes if helpful.
- **Why:** Community defs lag/lead Adobe; LayerCake already hit related text API pitfalls.

### 6. Explicitly not bolt-cep

- **Decision:** Do not add `bolt-cep`. Optionally record a short ADR so future readers do not “helpfully” import the CEP boilerplate for typing.
- **Why:** Wrong product shape (panels vs MCP host eval).

### 7. JSON polyfill ownership unchanged

- **Decision:** Continue injecting `extendscript-json` only in `wrapExtendScript`. Typed scripts MAY call `JSON.stringify` / `JSON.parse` and MUST NOT vendor a second polyfill into every entry.

## Risks / Trade-offs

- **[Risk] ES3 downlevel gaps** (e.g. unsupported syntax left in emit) → Mitigation: constrain allowed syntax in ae-script rules; smoke-test emit on host (`test:ae`); fail CI if emit contains known-bad tokens if practical.
- **[Risk] Types-for-Adobe wrong or incomplete** → Mitigation: guide + host tests win; do not treat compile success as proof of AE behavior.
- **[Risk] Bundle size / duplicate helpers per entry** → Mitigation: acceptable for MCP latency; optimize later with shared preambles only if measured need.
- **[Risk] Dev workflow forgets `build:ae-scripts`** → Mitigation: wire into `build`, `typecheck`, `test`, and `dev` scripts.
- **[Trade-off] Migration cost (~5k lines)** → Spike one small entry (`list-folders`), then inventory, then patch apply scripts.
- **[Trade-off] Lowering documented floor from 26+ to 24.6+** → Broader support; messaging must stay consistent across README, setup, error strings that claim a version floor.

## Migration Plan

1. Scaffold `tsconfig.ae.json`, `types-for-adobe`, empty `src/ae-scripts/`, build script, CI hooks.
2. Spike: migrate `list-folders` (or similarly small script) end-to-end; prove typecheck + emit + unit/AE tests.
3. Migrate remaining inventory scripts and shared helpers.
4. Migrate patch apply / control-plane scripts.
5. Remove obsolete string-template `*-script.ts` bodies (or leave thin loaders only).
6. Update operator docs (24.6+), agent rules (placement/architecture/extendscript), optional ADR.
7. Rollback: revert to previous string modules via git; no MCP protocol migration required.

## Open Questions

- Exact loader style (filesystem read of `dist/ae-scripts/*.jsx` vs codegen of TS string exports) — implementer picks whichever keeps `tsx` dev and `npm pack` honest with least glue.
- Whether to fail unit tests by scanning emit for `=>`, `` ` ``, or optional chaining — nice-to-have, not blocking if host tests cover critical paths.
