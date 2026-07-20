## Why

Wrapper duration and composition-settings normalization is the main generic mutation agents still cannot do through typed `ae_patch_project`. Layer timing (`set_layer_timing`) exists and batches atomically, but there is no guarded way to change a composition’s size, rate, duration, work area, display-start, or round-trippable advanced settings — so agents fall back to `ae_eval_script` for the clock that defines the wrapper.

## What Changes

- Add typed `set_comp_settings` to `ae_patch_project`: one composition per op via nested `target` (`compId` XOR `compName`; case-sensitive; ambiguous names refuse with candidate lists) and a nested partial `settings` bag (omit key = preserve; optional nested `settings.switches`).
- Allowlist covers: width, height, pixel aspect, frame rate; duration and display-start as integer frames; work-area start and duration as integer frames; renderer and composition switches only where AE supports deterministic round-tripping.
- Evidence returns integer-frame (and allowlisted switch/renderer) before/after snapshots; post-condition verification; `already_satisfied` when already matching; reject invalid combinations; no implicit save.
- Work-area policy: when a duration change would leave the work area past the new end, clamp the work area to the new end first; when the caller explicitly sets a work area that would end beyond duration, fail.
- Compose in the same undo-grouped batch as `set_layer_timing`. Document caller responsibility: place `set_comp_settings` before layer timing ops in the batch (especially when changing frame rate).
- Extend `ae_list_comps` composition payloads with the same settings fields agents need to plan the patch (no separate get-comp tool; use existing `compIds` / `compNames` filters).
- Update product skill, MCP tool docs, and root `README.md` when the public surface is affected (keep README briefly accurate; detail stays in `docs/`). Path + fingerprint guards remain the only session guards (no expected-current CAS bag).

## Capabilities

### New Capabilities

<!-- none — extends existing patch + inventory -->

### Modified Capabilities

- `ae-project-patch`: Add `set_comp_settings` to the typed vocabulary with nested `target` + partial `settings` bag, allowlist, work-area clamp/error rules, evidence, and batch-order documentation.
- `ae-comp-layer-inventory`: Extend each listed composition with settings fields (dims, PAR, frame rate, duration/display-start/work-area frames, round-trippable switches/renderer) aligned with the patch allowlist.
- `ae-product-skill`: Document `set_comp_settings`, inventory settings fields, work-area policy, and “comp settings before layer timing” batch order.

## Impact

- `src/patch/schema.ts`, `apply-control-plane-script.ts`, `types.ts`, `apply-script.ts` dispatch — new op.
- `src/inventory/list-comps-script.ts`, `types.ts`, `parse.ts` — composition settings on list payload.
- Unit tests (`tests/patch.test.ts`, `tests/inventory.test.ts`); host e2e when practical on the fixture.
- `README.md` (brief, if tool/inventory surface mentions need updating), `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/SKILL.md` (then `agentsync sync`); `docs/adr/0004-patch-op-target-and-settings-bags.md` (nested `target` + op-specific bags); `ARCHITECTURE.md` on sync/archive if capability map changes.
- No **BREAKING** removals; additive op + inventory fields.
