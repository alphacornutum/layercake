## Why

Agents confuse two layer-timing intents: **slipping nested source** inside a fixed parent in/out window (keyframes stay at absolute composition times) versus **dragging the layer bar** (keyframes should move with the layer). `set_layer_timing` already implements the first and never moves keyframes, but docs and the product skill do not say so clearly—so agents set `startFrame` alone, omit preserved `inFrame`/`outFrame`, or assume a future “shift with keys” behavior. Document that contract now so agents stop failing timing batches for the common nested-comp slip case.

## What Changes

- Clarify in `ae-project-patch` that `set_layer_timing` MUST NOT move, copy, or delete keyframes (or other property-tree animation); key times remain composition-absolute.
- Document the **source-slip** recipe: keep the parent timespan by supplying the desired `startFrame` together with the unchanged `inFrame` and `outFrame` in one op (do not rely on `startFrame` alone).
- State explicitly that UI-equivalent “drag layer in time” (move keys with the bar) is **out of scope** for `set_layer_timing` today; use `ae_eval_script` until a dedicated typed op exists.
- Update operator docs (`docs/mcp-tools.md`) and the canonical product skill (`skills/drive-after-effects/SKILL.md`) with the same guidance. No new patch ops, schema fields, or ExtendScript behavior changes.

## Capabilities

### New Capabilities

<!-- none — docs/contract clarification only -->

### Modified Capabilities

- `ae-project-patch`: Add requirements that `set_layer_timing` does not mutate keyframes, and that source-slip / fixed parent window guidance (and the non-goal of UI drag-with-keys) MUST be reflected in operator docs.
- `ae-product-skill`: Require the drive-after-effects skill to teach source-slip vs drag-with-keys for layer timing so agents prefer the correct `set_layer_timing` payload.

## Impact

- Specs: `openspec/specs/ae-project-patch/spec.md`, `openspec/specs/ae-product-skill/spec.md` (via deltas).
- Docs: `docs/mcp-tools.md` (`set_layer_timing` section).
- Agent guidance: `skills/drive-after-effects/SKILL.md` (canonical product skill per `ae-product-skill`).
- No runtime/API schema changes; no `ARCHITECTURE.md` layer changes expected.
