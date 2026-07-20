## Why

`set_layer_timing` documents that keyframe times stay composition-absolute, but After Effects can nudge key times when layer edges change (observed: Scale key `23.00s → 23.02s` after an on-grid timing write). The op only post-checks timing edges, so it reports `changed` while violating the preservation contract. Agents catch the drift in separate audits, find no typed keyframe-time restore op, and correctly discard unsaved trials. The documented promise must become a verified apply guarantee.

## What Changes

- Strengthen `set_layer_timing` so a successful write **preserves** every keyframe’s composition time (and values) on the target layer: snapshot before the timing write, restore any AE-nudged keys after, then post-condition-verify.
- Report `failed` (not `changed`) when any key time/value cannot be restored to the pre-write snapshot within a tight epsilon — include enough evidence for agents to see what drifted.
- Tighten the “Keyframes unchanged” requirement: remove the “intentionally” weasel; success means keys are unchanged on re-read, not merely that the op avoided calling key APIs.
- Update operator docs and the product skill so agents know preservation is enforced inside the op (still no typed “drag with keys” / free-form keyframe editor; that remains out of scope).
- **Not BREAKING** for layers without keys or when AE leaves keys alone; **stricter success** when AE would previously have silently moved keys while the op returned `changed`.

## Capabilities

### New Capabilities

<!-- none — hardens existing set_layer_timing -->

### Modified Capabilities

- `ae-project-patch`: Require snapshot/restore + key-preservation post-condition on `set_layer_timing`; tighten keyframe scenario and evidence expectations.
- `ae-product-skill`: Teach that timing success includes verified key-time preservation; restore is inside the op (not a separate typed keyframe-time tool).

## Impact

- `src/patch/apply-control-plane-script.ts` (`applySetLayerTiming` and new key-snapshot helpers)
- Possibly shared property-walk helpers if inspect/patch already walk the property tree
- Unit coverage in `tests/patch.test.ts`; host case in `tests/editing.ae.test.ts` (keyed layer + timing write → keys unchanged)
- `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/` (via AgentSync)
- Complements archived `frame-exact-layer-timing` (edges) and `document-layer-timing-slip` (docs); does **not** add a general `set_keyframe_times` op
