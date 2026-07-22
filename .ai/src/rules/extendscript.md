---
description: "ExtendScript and AE id conventions for host eval and inventory scripts"
globs:
  - src/host/**
  - src/inventory/**
  - src/patch/**
  - src/ae-scripts/**
  - tests/**/*.ae.test.ts
alwaysApply: false
---

# ExtendScript Rules

## Authoring (first-party)

- Author first-party AE scripts as modern TypeScript under `src/ae-scripts/` (`entries/` + `shared/`), typechecked with `tsconfig.ae.json` against `types-for-adobe` / `AfterEffects/24.6`.
- Each entry exports `main(): string`. `npm run build:ae-scripts` emits ES5/`var` `.jsx` under `dist/ae-scripts/`; Node loads via `loadAeScript` / `loadAeHelperScript` (`src/host/load-ae-script.ts`).
- Treat `build:ae-scripts` as the mandatory compatibility authority: it sanitizes known ExtendScript hazards, parses every payload as ES3, and rejects undeclared non-host globals. Add intentional host/preamble globals to its explicit allowlists rather than bypassing the gate.
- Do not hand-author untyped template-string ExtendScript bodies in `src/inventory/` or `src/patch/` for first-party paths — extend `src/ae-scripts/` instead.
- Do not add bolt-cep or CEP panel tooling for typing (see `docs/adr/0005-typed-extendscript-authoring.md`).

## Host language (emitted / agent eval)

- Runtime payloads must stay ExtendScript-safe (ES3 dialect / ES5 `var` emit): no optional chaining or other syntax AE cannot parse left in emitted `.jsx`. The AE build strips trailing commas, non-ASCII bytes, and `@ts-*` / triple-slash reference comments; ExtendScript treats those TypeScript comments as compiler directives.
- Prefer ASCII in `src/ae-scripts/` comments (`--` not em dashes) so sources match emit.
- Use `JSON.stringify` / `JSON.parse` freely — `wrapExtendScript` injects the extendscript-json polyfill before user code.
- Prefer `return` from `main()` (or top-level `return` in agent `ae_eval_script` bodies); the wrapper captures the IIFE result.
- Guard AE properties that throw on some layer types with `try/catch` (see inventory serializers).

## Id namespaces

- `Item.id` — comps, footage, folders (project panel).
- `Layer.id` — timeline layers (AE 22+; product floor is AE 24.6+); distinct from `Item.id`.
- Join layer sources with `layer.source.id` → `ae_list_sources` / composition ids — never treat a layer id as an item id.
- Prefer stable `id` over `index` or name for follow-up `ae_eval_script` lookups.

## Eval protocol

- Keep the `OK\\n` / `ERR\\n` result-file protocol in `src/host/script-wrapper.ts` intact.
- Reject empty scripts via `validateScriptSource`.
- Avoid modal dialogs and long interactive UI in evaluated scripts; they hang until timeout (`AE_SCRIPT_TIMEOUT_MS`).

## Docs before guessing

- For unfamiliar AE DOM APIs, use `ae_docs_search` / `ae_docs_get` (or the local corpus under `vendor/.../docs`) before inventing method names.
- Treat `types-for-adobe` (and any typed ExtendScript authoring) as IDE help, not Scripting Guide truth — community defs can lag or lead Adobe. Prefer the vendored guide + host tests (`npm run test:ae`) when types and docs disagree; recent example: read-only `allCaps`/`smallCaps` vs writable `fontCapsOption`.
