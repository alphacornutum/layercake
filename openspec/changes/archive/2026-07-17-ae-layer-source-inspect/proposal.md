## Why

Agents can map a project via `ae_list_comps` and `ae_list_sources`, but cannot inspect a single layer’s property tree (effects, expressions, keyframes) or a footage item’s full interpret/proxy settings without hand-rolled `ae_eval_script`. That gap was an explicit non-goal of inventory; agents now need typed deep-inspect tools so they can reason about animation and media without reinventing PropertyGroup dumps.

## What Changes

- Add read-only MCP tool `ae_get_layer` that returns a structured dump of one layer’s attributes and property tree (values, expressions, keyframes), with depth tiers and optional property selectors.
- Add read-only MCP tool `ae_get_source` that returns a structured dump of one `FootageItem` plus `mainSource` / `proxySource` interpret settings (on demand; does not bloat `ae_list_sources`).
- Support lookup by stable id **or** name for comps/layers/sources; ambiguous names fail with candidate lists; missing targets are hard errors.
- Include value-at-time (default composition CTI), explicit `preExpression` (default `true`), full keyframe timelines and full expression text at appropriate depth tiers.
- Best-effort JSON serialization; hard-to-serialize property types are flagged `unserializable: true` and deferred to later changes when use cases appear.
- Enforce a sanity size limit on inspect result JSON (default 512 KiB, overridable via `AE_INSPECT_MAX_BYTES`): over-limit responses MUST hard-error with guidance to narrow `detail` / `matchNames` — no silent truncation.
- Tool descriptions and README MUST document depth tiers and the size limit so agents know overview is lean and `extended`/`full` (or selectors) retrieve full expressions and keyframes.

## Capabilities

### New Capabilities

- `ae-layer-inspect`: Read-only MCP tool `ae_get_layer` for deep inspection of one composition layer (property tree, values, expressions, keyframes) with depth tiers and selectors.
- `ae-source-inspect`: Read-only MCP tool `ae_get_source` for deep inspection of one project `FootageItem` (item metadata + footage/proxy source interpret settings).

### Modified Capabilities

- _(none — inventory list tools stay thin; this change is additive)_

## Impact

- New inventory-style modules under `src/inventory/` (or adjacent inspect modules), ExtendScript dump scripts, parse/types, and `src/server.ts` tool registration.
- Config / `.env.example` for `AE_INSPECT_MAX_BYTES`; README MCP tool table and agent-facing descriptions for the new tools.
- Unit tests for parse/filter/serialize fixtures; optional gated AE host tests when env is available.
- Depends on existing host/eval bridge and AE ≥ 22 for `Layer.id` (same floor as `ae_list_comps`).
- No mutation tools; inspect remains read-only. Windows host bridge still out of scope.
