## Why

First-party inventory and patch ExtendScript lives as untyped template strings (~5k lines). TypeScript never checks `app` / `Layer` / `TextDocument` usage, so DOM mistakes slip through until host runtime (recent example: writing read-only `allCaps` instead of `fontCapsOption`). We want typesafe authoring against After Effects 24.6+ without adopting CEP scaffolding (bolt-cep).

## What Changes

- Author first-party After Effects scripts as **modern TypeScript** under a dedicated tree, typechecked against **`types-for-adobe` `AfterEffects/24.6`**, then **emit ES3** text that `AeHost.evalScript` / `wrapExtendScript` already consume.
- Keep the public MCP surface, host bridges, and OK/ERR wrap protocol unchanged; `ae_eval_script` remains a raw-string escape hatch for agents.
- Do **not** depend on `bolt-cep` (CEP panels / Vite / `evalTS`) — only the types + compile pattern.
- Document the supported After Effects host floor as **24.6+** (operators may run newer, e.g. 26; older than 24.6 remains unsupported).
- Treat typedefs as IDE help, not Scripting Guide truth: vendored guide + host tests remain authoritative when defs disagree (already captured in `.ai/src/rules/extendscript.md`).
- Migrate existing `*-script.ts` string bodies into the typed tree (shared helpers become real imports).

## Capabilities

### New Capabilities

- `typed-extendscript-authoring`: First-party AE script sources are TypeScript modules typechecked against Types-for-Adobe (After Effects 24.6), compiled to ES3-compatible payloads for host evaluation, with a build/typecheck gate separate from the Node MCP `tsconfig`.

### Modified Capabilities

- `product-identity`: Operator-facing docs MUST state After Effects **24.6+** as the supported host baseline (replacing any stronger floor such as 26+).

## Impact

- New: `src/ae-scripts/` (or equivalent), `tsconfig.ae.json`, emit output consumed by inventory/patch loaders
- Dev dependency: `types-for-adobe` (pin `AfterEffects/24.6`)
- Build/typecheck scripts (`package.json`) and CI so AE script typecheck is not optional
- Migrate `src/inventory/*-script.ts`, `src/patch/*-script.ts`, shared helpers
- Agent rules: `.ai/src/rules/extendscript.md`, `architecture.md`, `placement.md` (authoring location + emit; globs for ae-scripts)
- Optional ADR: why separate tsconfig + types-for-adobe, not bolt-cep
- Docs: README / setup / troubleshooting version floor → 24.6+
- No change to public `ae_*` tool JSON contracts or eval result protocol
