# First-party After Effects scripts

Modern TypeScript sources typechecked against `types-for-adobe` (`AfterEffects/24.6`), bundled to ES5/`var` `.jsx` under `dist/ae-scripts/` for `AeHost.evalScript` (TypeScript 5.9 removed `target: ES3`; emit stays ExtendScript-safe for this dialect).

`npm run build:ae-scripts` is a mandatory compatibility gate: every payload is sanitized, parsed as ECMAScript 3, and checked for undeclared non-host globals before it is written. Do not hand-edit or bypass emitted output.

## Entry convention

Each file under `entries/` exports `main(): string` (JSON payload for the host). The build strips ESM exports and appends `return main();` so `wrapExtendScript` captures the result. Helper-only entries use `main(){ return ""; }` and are loaded with `loadAeHelperScript` (strips the terminal return for concatenation).

## Shared modules

Import helpers from `shared/` -- Rollup inlines them into each entry (no shared runtime chunks).

## Loader (Node)

```ts
import { loadAeScript, loadAeHelperScript } from "../host/load-ae-script.js";
const source = loadAeScript("list-folders");
const helpers = loadAeHelperScript("helpers-inventory");
```

Dynamic builders (patch apply, get-layer, ...) inject a short preamble, then concatenate `loadAeScript("...")`.

## Authority

Types-for-Adobe is IDE help, not Scripting Guide truth -- see `.ai/src/rules/extendscript.md` and `docs/adr/0005-typed-extendscript-authoring.md`.
