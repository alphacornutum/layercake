## Context

`set_layer_timing` writes `startTime` / `inPoint` / `outPoint` / `stretch` only. Keyframes stay at absolute composition times. That is correct for **source slip** (change which nested-comp frames play inside a fixed parent in/out window) and incorrect for **UI drag** (move the layer bar and its keys together). Agents hitting nested-comp “show 0–90 instead of 10–100 at the same parent span” need the slip recipe documented; drag remains out of scope for this change.

## Goals / Non-Goals

**Goals:**

- Make slip vs drag unambiguous in the patch spec, `docs/mcp-tools.md`, and `skills/drive-after-effects/SKILL.md`.
- Normatively state that `set_layer_timing` does not mutate keyframes.
- Teach the one-op slip payload: new `startFrame` + unchanged `inFrame` + `outFrame`.

**Non-Goals:**

- No new op (`shift_layer` / drag-with-keys).
- No schema or ExtendScript changes.
- No time-remap key editing guidance beyond “use switches/eval when remapping is on.”
- No `ARCHITECTURE.md` updates (behavior ownership unchanged).

## Decisions

1. **Docs + contract only** — Codify existing apply behavior (no key writes) rather than changing the host script. Alternatives considered: implement `shift_layer` now (deferred); warn only in the skill without a spec delta (rejected—agents and archive sync need a requirement).

2. **Canonical skill path** — Edit `skills/drive-after-effects/SKILL.md` per `ae-product-skill`. If a duplicate under `.ai/src/skills/` is kept identical, update it in the same change so they do not drift.

3. **MODIFIED timing requirement + ADDED doc/skill requirements** — Extend `Set layer timing operation` with keyframe non-mutation and slip scenarios; add separate documentation requirements on `ae-project-patch` (mcp-tools) and `ae-product-skill` (product skill) matching prior “Document set_layer_switches” pattern.

4. **Slip example framing** — Use nested-comp language (source range vs parent window) without inventing new inventory fields; agents already have `startFrame` / `inFrame` / `outFrame` from `ae_list_comps`.

## Risks / Trade-offs

- **[Risk] Agents still try drag via timing** → Mitigation: explicit “not supported; use `ae_eval_script` until a typed shift op exists” in skill + mcp-tools.
- **[Risk] Time-remap layers** → Mitigation: one-line caveat that slip via `startFrame` assumes remapping is off; remap ownership stays on `set_layer_switches` / eval.
- **[Trade-off] Spec grows without runtime tests** → Acceptable for docs-only; scenarios are reviewable against docs/skill text.
