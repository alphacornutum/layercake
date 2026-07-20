## MODIFIED Requirements

### Requirement: Document set_layer_timing source-slip vs drag

The product skill MUST document `set_layer_timing` as frame-exact start/in/out/stretch with **verified keyframe preservation**: successful writes MUST leave keyframe composition times and authored values unchanged (the op snapshots and restores keys when AE would nudge them). The skill MUST NOT describe preservation as merely “the op does not call key APIs.” The skill MUST teach **source slip**: to keep the same parent in/out window while changing which source frames play (typical nested-comp case), supply the new `startFrame` together with the unchanged `inFrame` and `outFrame` in one op—not `startFrame` alone. The skill MUST contrast that with **drag layer in time** (move keys with the layer bar), which is not a typed op today; agents MUST use `ae_eval_script` for that until a dedicated op exists. The skill MUST note that slip via `startFrame` assumes time remapping is off (`timeRemapEnabled` remains on `set_layer_switches`).

The skill MUST state that post-condition success requires **on-grid** edges (`frame / frameRate` seconds, not merely nearest-frame rounding), exact `durationFrames` (`outFrame - inFrame`) equal to the expected span, and `keyframesPreserved: true`. The skill MUST note that timing evidence includes raw seconds as well as integer frames. For critical carriers, the skill MUST recommend agent-composed verification after `ae_save_project` (reopen or re-read) and optional boundary-frame contribution probes, and MUST state that those persistence/render checks are outside `set_layer_timing` itself.

#### Scenario: Skill teaches slip payload and keyframe non-mutation

- **WHEN** an agent reads `skills/drive-after-effects/SKILL.md` (or the equivalent MCP `skill://drive-after-effects/SKILL.md` resource)
- **THEN** the skill MUST state that successful `set_layer_timing` preserves keyframe times/values (snapshot/restore) and MUST document the start+preserved-in/out slip recipe

#### Scenario: Skill contrasts drag-with-keys as out of scope

- **WHEN** an agent reads the product skill for layer timing
- **THEN** the skill MUST state that UI-equivalent drag-with-keys is not typed on `set_layer_timing` and MUST point agents at `ae_eval_script` for that intent

#### Scenario: Skill teaches on-grid exactness and audit composition

- **WHEN** an agent reads the product skill for layer timing
- **THEN** the skill MUST state on-grid / exact-durationFrames success, seconds-in-evidence, verified `keyframesPreserved`, and that save/reopen plus optional contribution probes are agent-composed outside the op
