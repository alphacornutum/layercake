# Proposal

## Why

LayerCake can inspect animation but users must use unguarded ExtendScript to author a property's keyframes, and the typed layer-wide reset can erase unrelated animation. Issue [#28](https://github.com/alphacornutum/layercake/issues/28) motivates a single-property operation that can both replace a complete timeline, including temporal curves, and remove animation while restoring a sampled authored value.

## What Changes

- Add `set_property_keyframes` to `ae_patch_project`: target one property, then either replace its entire timeline with supplied time/value entries or remove all keys and restore the pre-expression value sampled at an explicit composition time.
- Support numeric scalar/vector/color values, incoming/outgoing `LINEAR`, `BEZIER`, and `HOLD` interpolation, and explicit temporal ease (`speed`/`influence`). Use deterministic defaults rather than AE preferences.
- Accept optional expected-state guards: a lightweight key count, a complete time/value timeline with optional curve assertions, or both. Both supplied guards must agree and pass.
- Resolve composition/layer targets using the existing id-or-name rules: prefer stable IDs and accept names only as case-sensitive exact matches that resolve uniquely. Require an exact, unambiguous property path including intermediate groups.
- Preflight bounded inputs, target resolution, supported property types, expression policy, sampling, and expected state before any batch mutation. Preserve expressions by default, reject enabled expressions unless explicit clearing is requested, verify postconditions, and never save implicitly.
- Return actual before/after property identity, key timelines, sampled authored values, expression state, and bounded evidence that other keyframes on the target layer were preserved.
- Document that replacement deletes omitted keys. Incremental upserts, selected-key deletion, spatial tangent editing, auto-Bezier/continuity authoring, roving keys, and complex AE-native values remain outside this initial scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ae-project-patch`: Extend the typed vocabulary with guarded property-scoped timeline replacement and sampled static-value restore, temporal curve configuration, and expected-state guards; use existing id-or-name targeting rules.

## Impact

- Public additive patch schema and result shapes in `src/patch/`; `ae_patch_project` registration/description in `src/server.ts`.
- Typed host authoring under `src/ae-scripts/entries/patch-apply.ts` and focused shared property-keyframe helpers; no new host transport or MCP tool.
- Unit and AE host integration tests for key creation/replacement, temporal curves, removal, preservation, preflight refusal, rollback, and idempotence.
- `README.md`, `docs/mcp-tools.md`, relevant troubleshooting/related-projects guidance, packaged `skills/drive-after-effects/`, and `ARCHITECTURE.md` at spec sync/archive.
- No new runtime dependency. No changes to the unrelated `explicit-layer-name-assignment` change or its existing working-tree edits.
