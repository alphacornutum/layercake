## MODIFIED Requirements

### Requirement: Set layer timing operation

`set_layer_timing` MUST set timing on one layer (layer `target`) using integer frame fields (`startFrame`, `inFrame`, `outFrame` as applicable) converted with the containing composition’s `frameRate`. The op MUST reject payloads that supply only floating-point seconds for those timing fields when frame fields are required by the schema. Optional `stretch` MAY be included with an op-specific name. The op MUST NOT accept `timeRemapEnabled` (or other layer switches); callers MUST use `set_layer_switches` for remapping and other switch toggles.

For every supplied frame field, apply MUST write seconds as `frame / frameRate` and MUST report `changed` only when the post-read satisfies **both**: (1) nearest-integer frame equals the request (`timeToFrame` / equivalent), and (2) the edge is **on-grid** — `abs(seconds * frameRate - frame)` is within a tight implementation epsilon (frame units). When the effective in and out frames after the op are determined (from supplied fields and/or already-matching preserved edges), apply MUST also require that `durationFrames` (`outFrame - inFrame`) equals the expected span from those effective frames. Rounded-frame agreement alone MUST NOT be sufficient for `changed` when an edge is off-grid or `durationFrames` mismatches.

When the timing write runs (not `already_satisfied`), apply MUST snapshot all keyframes on the target layer’s property tree before mutating timing, MUST restore any keyframes whose composition times or values drift after the timing write (AE has no `setKeyTime`; restore MAY rebuild a property’s key timeline from the snapshot), and MUST report `changed` only when every pre-write keyframe’s composition time and authored value still match the snapshot within a tight implementation epsilon. Apply MUST NOT report `changed` when any key time or value remains drifted after restore. UI-equivalent “drag layer in time” (intentionally shifting keyframes with the layer bar) remains out of scope for this op.

Evidence MUST include before/after integer frame fields (`startFrame`, `inFrame`, `outFrame`, derived `durationFrames`) and raw seconds (`startTime`, `inPoint`, `outPoint`), plus stretch when applicable, and MUST include `keyframesPreserved` (boolean). On key-preservation failure, evidence MUST include a compact drift summary (property identity and before/after times) sufficient for agents to see what moved without requiring a full keyframe dump on success. The op MUST NOT save the project and MUST NOT claim persistence-across-reopen or render-contribution proof. Protected-layer product policy is out of scope for this op.

#### Scenario: Frame-exact in/out

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` for a resolvable layer
- **THEN** apply MUST set layer in/out so post-read integer frames match the request and both edges are on-grid

#### Scenario: Exact durationFrames

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` such that the expected span is `outFrame - inFrame`
- **THEN** post-condition success MUST require that re-read `durationFrames` equals that expected span exactly

#### Scenario: Off-grid edge fails post-condition

- **WHEN** after write the re-read seconds for a supplied edge round to the requested frame but are not on-grid within epsilon
- **THEN** apply MUST NOT report `changed` for that target and MUST include actual after frames and seconds in evidence

#### Scenario: Seconds-only timing refused

- **WHEN** the caller omits required frame fields and supplies only second-based timing
- **THEN** validation MUST fail before mutation

#### Scenario: timeRemapEnabled on timing refused

- **WHEN** the caller supplies `timeRemapEnabled` on a `set_layer_timing` operation
- **THEN** validation MUST fail before mutation

#### Scenario: Keyframes preserved across timing write

- **WHEN** `set_layer_timing` successfully changes `startFrame` and/or `inFrame`/`outFrame` on a layer that has keyframes
- **THEN** post-read composition times and authored values for those keyframes MUST match the pre-write snapshot within epsilon and evidence MUST report `keyframesPreserved: true`

#### Scenario: Keyframe drift fails post-condition

- **WHEN** after the timing write (and any restore attempt) a keyframe’s composition time or authored value still differs from the pre-write snapshot beyond epsilon
- **THEN** apply MUST NOT report `changed` for that target and MUST set `keyframesPreserved: false` with a compact drift summary in evidence

#### Scenario: Source slip keeps parent window

- **WHEN** the caller wants the same parent composition in/out span but a different layer `startFrame` (source slip, e.g. nested comp showing source 0–N instead of an offset range)
- **THEN** a single `set_layer_timing` that supplies the new `startFrame` together with the unchanged `inFrame` and `outFrame` MUST be accepted as the documented way to keep that parent window (callers MUST NOT rely on `startFrame` alone when the trim window must stay fixed)

### Requirement: Document set_layer_timing source-slip and keyframe semantics

Operator documentation for `ae_patch_project` / `set_layer_timing` MUST state that successful timing writes preserve keyframe composition times and values (snapshot/restore inside the op; not merely “the op does not call key APIs”), MUST document the source-slip recipe (new `startFrame` plus preserved `inFrame` and `outFrame` in one op), MUST warn that setting `startFrame` alone can let After Effects nudge the trim, and MUST state that UI drag-with-keys is not provided by this op (use `ae_eval_script` until a dedicated typed op exists). A brief caveat MUST note that source slip via `startFrame` assumes time remapping is not driving the visible range. Documentation MUST also state that success requires on-grid edges and exact `durationFrames` (not merely nearest-frame rounding), that evidence includes seconds as well as frames and `keyframesPreserved`, and that save/reopen plus optional boundary-frame contribution checks remain agent-composed outside this op.

#### Scenario: mcp-tools documents slip vs keys

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST cover verified keyframe preservation, the slip payload (start + preserved in/out), the start-alone trim warning, and that drag-with-keys is out of scope for this op

#### Scenario: mcp-tools documents on-grid exactness

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST state on-grid / exact-durationFrames post-conditions, seconds-in-evidence, and that persistence/render probes are outside the op

## ADDED Requirements

### Requirement: set_layer_timing keyframe snapshot evidence

Per-target evidence for `set_layer_timing` MUST expose `keyframesPreserved` so agents can trust key-time preservation without a separate inspect pass on the success path. When preservation fails, evidence MUST include a compact `keyframeDrift` (or equivalent) summary identifying at least property path and before/after times for drifted keys (implementation MAY cap the list length and mark truncation).

#### Scenario: Success marks keys preserved

- **WHEN** `set_layer_timing` reports `changed` or `already_satisfied` for a target
- **THEN** evidence MUST include `keyframesPreserved: true`

#### Scenario: Failure includes drift summary

- **WHEN** `set_layer_timing` fails because keyframes could not be preserved
- **THEN** evidence MUST include `keyframesPreserved: false` and a compact drift summary with before/after times
