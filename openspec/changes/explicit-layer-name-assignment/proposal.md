# Proposal

## Why

After Effects can display a layer name inherited from its source even though the layer has never been explicitly named. `rename_layer` currently treats matching visible text as already satisfied, so callers cannot use the typed operation to ensure a layer keeps its identity when its source is replaced.

## What Changes

- Change `rename_layer` so it ensures both the requested visible name and an explicit layer-name assignment. When the text matches but AE reports the name is inherited, the operation must assign the requested name and verify the explicit state.
- Define `already_satisfied` by the requested name and explicit assignment state, not by text equality alone. Already-explicit matching names remain idempotent.
- Extend per-target before/after evidence to distinguish visible name from assignment state and report the source id where available. Do not save implicitly or alter the source link or other layer state.
- Cover explicit-name persistence through save/reopen and retention after source replacement in host integration tests.

## Capabilities

### New Capabilities

### Modified Capabilities

- `ae-project-patch`: Change `rename_layer` same-name semantics and require verification/evidence for explicit layer-name assignment while retaining guarded patch behavior.
- `ae-layer-inspect`: Expose layer name-assignment state through read-only layer inspection so callers can verify persistence after saving and reopening.

## Impact

- `src/patch/` schema and result types; `src/ae-scripts/entries/patch-apply.ts` assignment and verification behavior.
- `openspec/specs/ae-project-patch/spec.md`, patch unit tests, and After Effects host integration tests.
- Operator and agent documentation describing `rename_layer` and its result evidence.
