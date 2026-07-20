## 1. Operator docs

- [x] 1.1 Expand `set_layer_timing` in `docs/mcp-tools.md`: keyframes stay composition-absolute; source-slip recipe (`startFrame` + preserved `inFrame`/`outFrame`); warn against `startFrame` alone when trim must stay fixed; state drag-with-keys is out of scope (`ae_eval_script`); note time-remap caveat
- [x] 1.2 Add a short slip example JSON payload next to other patch op examples if it helps scanability (optional if the prose already includes a clear payload)

## 2. Product skill

- [x] 2.1 Update `skills/drive-after-effects/SKILL.md` with the same slip vs drag / keyframe guidance (prefer a short bullet under typed-patch or layer-timing notes)
- [x] 2.2 If `.ai/src/skills/drive-after-effects/SKILL.md` is a maintained duplicate of the product skill, apply the same edit so the copies stay aligned

## 3. Spec sync readiness

- [x] 3.1 Confirm delta specs match the shipped docs/skill wording (no runtime code changes)
- [x] 3.2 Note in apply summary that OpenSpec sync/archive can land the deltas into `openspec/specs/` and that `ARCHITECTURE.md` needs no edit for this docs-only change
