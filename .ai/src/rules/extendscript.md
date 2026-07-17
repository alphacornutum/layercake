---
description: "ExtendScript and AE id conventions for host eval and inventory scripts"
globs:
  - src/host/**
  - src/inventory/**
  - tests/**/*.ae.test.ts
alwaysApply: false
---

# ExtendScript Rules

## Host language

- Write AE scripts as ES3-compatible ExtendScript: `var`, no arrow functions, no `const`/`let`, no optional chaining in script bodies.
- Use `JSON.stringify` / `JSON.parse` freely — `wrapExtendScript` injects the extendscript-json polyfill before user code.
- Prefer top-level `return value` from the user script body (the wrapper captures the IIFE result).
- Guard AE properties that throw on some layer types with `try/catch` (see inventory serializers).

## Id namespaces

- `Item.id` — comps, footage, folders (project panel).
- `Layer.id` — timeline layers (AE 22+); distinct from `Item.id`.
- Join layer sources with `layer.source.id` → `ae_list_sources` / composition ids — never treat a layer id as an item id.
- Prefer stable `id` over `index` or name for follow-up `ae_eval_script` lookups.

## Eval protocol

- Keep the `OK\\n` / `ERR\\n` result-file protocol in `src/host/script-wrapper.ts` intact.
- Reject empty scripts via `validateScriptSource`.
- Avoid modal dialogs and long interactive UI in evaluated scripts; they hang until timeout (`AE_SCRIPT_TIMEOUT_MS`).

## Docs before guessing

- For unfamiliar AE DOM APIs, use `ae_docs_search` / `ae_docs_get` (or the local corpus under `vendor/.../docs`) before inventing method names.
