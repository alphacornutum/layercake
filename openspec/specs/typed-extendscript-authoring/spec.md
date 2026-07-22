## Purpose

Define how first-party After Effects ExtendScript is authored as typed TypeScript, typechecked against Types-for-Adobe 24.6, and emitted as ES3-compatible eval payloads — without treating typedefs as Scripting Guide authority.

## Requirements

### Requirement: First-party AE scripts are typed TypeScript modules

LayerCake MUST author first-party After Effects ExtendScript (inventory, patch apply helpers, and shared AE DOM helpers used by those paths) as TypeScript modules under a dedicated source tree, separate from the Node MCP TypeScript project. Those modules MUST be typechecked against community Types-for-Adobe definitions for **After Effects 24.6** (`types-for-adobe` / `AfterEffects/24.6` or an equivalent pin of that version's typedefs). The Node MCP `tsconfig` MUST NOT load After Effects DOM globals into ordinary server modules.

#### Scenario: AE DOM typecheck is gated

- **WHEN** a contributor runs the project's typecheck (or equivalent CI typecheck) after changing a first-party AE script module
- **THEN** the AE script TypeScript project MUST be typechecked against After Effects 24.6 typedefs and MUST fail the check on type errors in those modules

#### Scenario: Node modules stay free of AE globals

- **WHEN** a contributor typechecks ordinary Node MCP sources (for example `src/server.ts` or `src/host/**`)
- **THEN** those modules MUST NOT rely on After Effects DOM globals such as `app` or `Layer` being in scope from Types-for-Adobe

### Requirement: Modern TypeScript emits ES3-compatible eval payloads

First-party AE script entrypoints MUST be compiled/bundled into self-contained **ES3-compatible** source text suitable for evaluation inside After Effects via the existing host eval path (`AeHost.evalScript` and `wrapExtendScript`). Authors MAY use modern TypeScript syntax in source. Emitted payloads MUST NOT depend on CEP, bolt-cep, or a panel `evalTS` bridge. Caller-supplied `ae_eval_script` strings remain untyped opaque source and are out of scope for this requirement.

#### Scenario: Inventory or patch path evaluates emitted ES3

- **WHEN** the server runs a first-party inventory or patch operation that evaluates host script
- **THEN** the evaluated payload MUST be the ES3-emitted text for that entrypoint (after the shared wrap/result-file protocol), not an uncompiled TypeScript module

#### Scenario: Emit is part of package build

- **WHEN** a contributor runs the project's production build used to populate `dist/` / the published package
- **THEN** first-party AE script entrypoints MUST be emitted so runtime loaders can obtain ES3 source without a separate manual step

#### Scenario: Agent eval escape hatch unchanged

- **WHEN** a caller invokes `ae_eval_script` with arbitrary ExtendScript source
- **THEN** the server MUST continue to accept and evaluate that opaque string under the existing validation and wrap protocol without requiring it to pass the AE script TypeScript project

### Requirement: Types-for-Adobe is not Scripting Guide authority

When Types-for-Adobe definitions disagree with the vendored After Effects Scripting Guide or observed host behavior, LayerCake MUST treat the vendored guide and host tests as authoritative for runtime behavior. Typed authoring MUST NOT be used as justification to skip guide lookup or host verification for unfamiliar or disputed APIs.

#### Scenario: Guide wins over typedefs

- **WHEN** a typedef marks an API writable (or present) but the vendored Scripting Guide or host tests show different behavior
- **THEN** implementers MUST follow the guide/host evidence for the evaluated script behavior

### Requirement: Self-contained entry loaders without duplicate helper prepend

Node loaders that evaluate first-party emitted inventory or patch entrypoints MUST pass self-contained emitted source (plus intentional parameter preambles such as injected `__itemId` bindings) to `AeHost.evalScript` / `wrapExtendScript`. They MUST NOT prepend separate `loadAeHelperScript` helper blobs that reintroduce symbols already bundled into that entry (including a second `function main`).

#### Scenario: Item refs uses bundled entry only

- **WHEN** the server builds the ExtendScript payload for `ae_get_item_refs`
- **THEN** the payload MUST include the emitted `get-item-refs` entry (and any `__itemId` preamble) and MUST NOT prepend the shared inventory helper emit that defines another `main`

#### Scenario: No dead import-time helper loaders

- **WHEN** a contributor inspects Node inventory modules that exist only to `loadAeHelperScript` for concatenation
- **THEN** those modules MUST NOT remain in the tree if nothing in `src/` imports their exports (migration-compat stubs are not allowed once patch/inventory entries are self-bundled)
