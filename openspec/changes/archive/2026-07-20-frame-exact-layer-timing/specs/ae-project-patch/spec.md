## MODIFIED Requirements

### Requirement: Set layer timing operation

`set_layer_timing` MUST set timing on one layer (layer `target`) using integer frame fields (`startFrame`, `inFrame`, `outFrame` as applicable) converted with the containing composition’s `frameRate`. The op MUST reject payloads that supply only floating-point seconds for those timing fields when frame fields are required by the schema. Optional `stretch` MAY be included with an op-specific name. The op MUST NOT accept `timeRemapEnabled` (or other layer switches); callers MUST use `set_layer_switches` for remapping and other switch toggles. The op MUST NOT move, copy, remove, or otherwise mutate keyframes or other property-tree animation; keyframe times remain composition-absolute across a successful timing write.

For every supplied frame field, apply MUST write seconds as `frame / frameRate` and MUST report `changed` only when the post-read satisfies **both**: (1) nearest-integer frame equals the request (`timeToFrame` / equivalent), and (2) the edge is **on-grid** — `abs(seconds * frameRate - frame)` is within a tight implementation epsilon (frame units). When the effective in and out frames after the op are determined (from supplied fields and/or already-matching preserved edges), apply MUST also require that `durationFrames` (`outFrame - inFrame`) equals the expected span from those effective frames. Rounded-frame agreement alone MUST NOT be sufficient for `changed` when an edge is off-grid or `durationFrames` mismatches.

Evidence MUST include before/after integer frame fields (`startFrame`, `inFrame`, `outFrame`, derived `durationFrames`) and raw seconds (`startTime`, `inPoint`, `outPoint`), plus stretch when applicable. The op MUST NOT save the project and MUST NOT claim persistence-across-reopen or render-contribution proof. Protected-layer product policy is out of scope for this op. UI-equivalent “drag layer in time” (shifting keyframes with the layer bar) is out of scope for this op.

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

#### Scenario: Keyframes unchanged by timing write

- **WHEN** `set_layer_timing` successfully changes `startFrame` and/or `inFrame`/`outFrame` on a layer that has keyframes
- **THEN** apply MUST NOT intentionally alter those keyframes’ composition times or values as part of the op

#### Scenario: Source slip keeps parent window

- **WHEN** the caller wants the same parent composition in/out span but a different layer `startFrame` (source slip, e.g. nested comp showing source 0–N instead of an offset range)
- **THEN** a single `set_layer_timing` that supplies the new `startFrame` together with the unchanged `inFrame` and `outFrame` MUST be accepted as the documented way to keep that parent window (callers MUST NOT rely on `startFrame` alone when the trim window must stay fixed)

### Requirement: Document set_layer_timing source-slip and keyframe semantics

Operator documentation for `ae_patch_project` / `set_layer_timing` MUST state that keyframes stay at absolute composition times, MUST document the source-slip recipe (new `startFrame` plus preserved `inFrame` and `outFrame` in one op), MUST warn that setting `startFrame` alone can let After Effects nudge the trim, and MUST state that UI drag-with-keys is not provided by this op (use `ae_eval_script` until a dedicated typed op exists). A brief caveat MUST note that source slip via `startFrame` assumes time remapping is not driving the visible range. Documentation MUST also state that success requires on-grid edges and exact `durationFrames` (not merely nearest-frame rounding), that evidence includes seconds as well as frames, and that save/reopen plus optional boundary-frame contribution checks remain agent-composed outside this op.

#### Scenario: mcp-tools documents slip vs keys

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST cover keyframe non-mutation, the slip payload (start + preserved in/out), the start-alone trim warning, and that drag-with-keys is out of scope for this op

#### Scenario: mcp-tools documents on-grid exactness

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST state on-grid / exact-durationFrames post-conditions, seconds-in-evidence, and that persistence/render probes are outside the op

## ADDED Requirements

### Requirement: set_layer_timing on-grid evidence contract

Per-target evidence for `set_layer_timing` MUST expose both integer frame fields and raw layer timing seconds so agents can detect half-frame / off-grid edges without a separate eval. `already_satisfied` MUST apply only when every supplied field already matches on integer frames and is on-grid (and durationFrames matches when in/out are in scope).

#### Scenario: Evidence includes seconds

- **WHEN** `set_layer_timing` returns target evidence after a write attempt
- **THEN** `before` and `after` MUST include `startTime`, `inPoint`, and `outPoint` seconds alongside integer frame fields and `durationFrames`
