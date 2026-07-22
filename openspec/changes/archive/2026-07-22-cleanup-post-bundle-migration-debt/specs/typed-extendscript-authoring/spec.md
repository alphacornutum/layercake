## ADDED Requirements

### Requirement: Self-contained entry loaders without duplicate helper prepend

Node loaders that evaluate first-party emitted inventory or patch entrypoints MUST pass self-contained emitted source (plus intentional parameter preambles such as injected `__itemId` bindings) to `AeHost.evalScript` / `wrapExtendScript`. They MUST NOT prepend separate `loadAeHelperScript` helper blobs that reintroduce symbols already bundled into that entry (including a second `function main`).

#### Scenario: Item refs uses bundled entry only

- **WHEN** the server builds the ExtendScript payload for `ae_get_item_refs`
- **THEN** the payload MUST include the emitted `get-item-refs` entry (and any `__itemId` preamble) and MUST NOT prepend the shared inventory helper emit that defines another `main`

#### Scenario: No dead import-time helper loaders

- **WHEN** a contributor inspects Node inventory modules that exist only to `loadAeHelperScript` for concatenation
- **THEN** those modules MUST NOT remain in the tree if nothing in `src/` imports their exports (migration-compat stubs are not allowed once patch/inventory entries are self-bundled)
