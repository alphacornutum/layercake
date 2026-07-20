## Why

Agents can inventory layer switches (`enabled`, `audioEnabled`, guide/3D/etc.) via `ae_list_comps` / `ae_get_layer`, but cannot set them through typed `ae_patch_project` without falling back to `ae_eval_script`. Routine mute-video / keep-audio and similar control-plane edits need a partial, post-condition-verified switch mutator that preserves every unspecified property.

## What Changes

- Add typed `set_layer_switches` to `ae_patch_project`: one layer per op, shared id-or-name `target`, nested `switches` bag of explicitly supplied booleans only.
- Allowlist covers the full inventory/inspect switch surface (`enabled`, `audioEnabled`, `solo`, `shy`, `locked`, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlending`, `motionBlur`, `timeRemapEnabled`, and related applicable flags). Omitted keys are preserved; evidence returns a full switch snapshot before/after.
- **BREAKING:** Move `timeRemapEnabled` write ownership from `set_layer_timing` to `set_layer_switches` so remapping is not writable from two ops. Timing remains start/in/out/stretch (and any non-switch timing fields).
- Persist the product rule that layer-targeting patch ops ALWAYS use `layerTargetSchema` (exactly one of `compId`|`compName`, exactly one of `layerId`|`layerName`; ambiguous names refuse with candidates) via ADR + operator/skill docs — not an ids-only special case for this op.
- Update product skill / MCP tool docs for the new op and the timing/switch split. No implicit save; existing path + fingerprint guards, undo grouping, and atomic failure rules apply.

## Capabilities

### New Capabilities

<!-- none — extends existing patch vocabulary -->

### Modified Capabilities

- `ae-project-patch`: Add `set_layer_switches` requirement; remove `timeRemapEnabled` from `set_layer_timing`; reinforce universal layer-target parity for new and existing layer-targeting ops.
- `ae-product-skill`: Document `set_layer_switches`, the switch allowlist, full before/after switch evidence, and that `timeRemapEnabled` is set via switches (not timing).

## Impact

- `src/patch/schema.ts`, `apply-script.ts`, `apply-control-plane-script.ts`, `types.ts` — new op + timing schema/apply cleanup.
- Unit tests in `tests/patch.test.ts`; host e2e only if a disposable fixture path is practical (no LayerCake fixture requirement for named `{music}`/`{voiceover}` layers).
- `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/SKILL.md` (then `agentsync sync`), new ADR under `docs/adr/` for universal layer-target parity.
- Callers that set `timeRemapEnabled` via `set_layer_timing` must migrate to `set_layer_switches`.
