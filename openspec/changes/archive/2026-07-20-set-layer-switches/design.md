## Context

Layer switches are already first-class on the read path (`ae_list_comps` control-plane fields; `ae_get_layer` overview flags). Typed mutation stops at timing, rename, reorder, source replace, expressions, and surface reset — agents must `ae_eval_script` to toggle the eyeball or audio switch while proving other state stayed put.

`set_layer_timing` already owns a partial desired-state pattern (omit = preserve; before/after; `already_satisfied`; post-condition on supplied fields). `timeRemapEnabled` currently sits on that op even though it is a timeline switch, creating a future dual-write hazard once a switch op exists.

ADR 0003 already records id-or-name targeting and post-conditions for early patch ops; it must be amended so new ops never invent an ids-only exception.

## Goals / Non-Goals

**Goals:**

- Add `set_layer_switches` as a closed, typed, one-layer-per-op mutator with nested `switches` and full switch-snapshot evidence.
- Use shared `layerTargetSchema` resolve (id-or-name; ambiguous → candidates) for this op — same as every other layer-targeting patch op.
- Move `timeRemapEnabled` writes exclusively onto `set_layer_switches`.
- Persist universal targeting parity in ADR 0003 + skill/docs.
- Keep path/fingerprint guards, validate-all-then-apply, one undo group, no implicit save, atomic failure/rollback reporting.

**Non-Goals:**

- No LayerCake fixture requirement for customer layer names (`{music}` / `{voiceover}`); those are caller-domain examples only.
- No generic untyped property setter; no regex/broad multi-layer switch selectors in v1.
- No write of read-only capability flags (`hasVideo` / `hasAudio`).
- No `videoEnabled` write alias (inventory may still expose it; authored write key is `enabled` = eyeball).
- No `frameBlendingType` enum in v1 (boolean `frameBlending` only).
- No changes to `reset_layer_surface` (still surface clears; stale “listed switches” wording can be cleaned when convenient, not required for this change).
- No pixel/render proof that disabled video “looks” muted.

## Decisions

### 1. Op shape mirrors timing, nested bag for switches

```json
{
  "op": "set_layer_switches",
  "target": { "compId": 1, "layerId": 2 },
  "switches": { "enabled": false }
}
```

- `target`: `layerTargetSchema` (exactly one of `compId`|`compName`, exactly one of `layerId`|`layerName`).
- `switches`: `.strict()` object; at least one known boolean key required; unknown keys fail Zod before mutation.
- Apply only keys present; never default unspecified switches to false/true.

**Alternatives:** Flat optional fields on the op (like timing) — rejected; a nested bag makes “explicitly supplied” and future allowlist growth clearer. Ids-only target — rejected; violates universal parity (Decision 4).

### 2. Full write allowlist (inventory/inspect switch surface)

Writable keys in v1:

| Key                      | AE attribute (approx.)           |
| ------------------------ | -------------------------------- |
| `enabled`                | `Layer.enabled` (eyeball)        |
| `audioEnabled`           | `AVLayer.audioEnabled`           |
| `solo`                   | `Layer.solo`                     |
| `shy`                    | `Layer.shy`                      |
| `locked`                 | `Layer.locked`                   |
| `guideLayer`             | `AVLayer.guideLayer`             |
| `adjustmentLayer`        | `AVLayer.adjustmentLayer`        |
| `threeDLayer`            | `AVLayer.threeDLayer`            |
| `collapseTransformation` | `AVLayer.collapseTransformation` |
| `frameBlending`          | `AVLayer.frameBlending`          |
| `motionBlur`             | `AVLayer.motionBlur`             |
| `timeRemapEnabled`       | `AVLayer.timeRemapEnabled`       |

Inapplicable attributes on a given layer type: attempt write in try/catch; post-condition failure → target `failed` with actual `after` when readable; batch stops/rolls back per existing patch rules. Do not silently skip.

**Locked ordering within one op:** If `switches` includes `locked: false`, write `locked` before other supplied switches. If it includes `locked: true`, write other supplied switches first, then `locked` last. A payload that both unlocks (or leaves unlocked) and sets other switches in the same op MUST succeed when those attributes are otherwise applicable — callers MUST NOT need a separate prior unlock op for that case.

### 3. Full switch-snapshot evidence

Per-target `before` / `after` MUST include the full allowlist snapshot (each key present when readable on that layer; omit or null only when the host cannot read that attribute). Post-condition success depends only on keys the caller supplied matching the request; other keys are reported for preservation visibility.

**Alternatives:** Requested-keys-only evidence — rejected; agents need one response to prove unspecified switches (e.g. `audioEnabled`) stayed put.

### 4. Universal `layerTargetSchema` — amend ADR 0003

Do not create a parallel ADR. Amend `docs/adr/0003-patch-targeting-and-post-conditions.md` so the decision explicitly covers **all** current and future layer-targeting patch ops (including `set_layer_switches` and the control-plane set), not only `rename_layer` / `set_text_style`. Reinforce: never ship an ids-only special case unless a superseding ADR says otherwise.

Shared resolve stays in `src/inventory/resolve-script.ts` + `layer-target-schema.ts`.

### 5. Remove `timeRemapEnabled` from `set_layer_timing`

**BREAKING** for any caller that set remapping via timing. Rationale: one write owner per bit; remapping is a switch, not a frame field. Timing op keeps `startFrame` / `inFrame` / `outFrame` / `stretch` (and its “at least one field” refine without remapping).

Migration: use `set_layer_switches` with `switches.timeRemapEnabled`.

### 6. Apply path placement

Follow control-plane pattern: Zod in `schema.ts`; plan/resolve in `apply-script.ts`; mutate/read helpers in `apply-control-plane-script.ts` (`readLayerSwitches` / `applySetLayerSwitches`). Types for evidence in `types.ts`. Batch of N layers = N ops (same as `rename_layer`).

### 7. Acceptance / testing

- Unit: schema (allowlist, empty bag, unknown key, target shape), vocabulary membership, evidence shape fixtures.
- Host: optional smoke on fixture if a layer can toggle `enabled` safely; **not** blocked on customer-named `{music}`/`{voiceover}` layers.
- Narrative acceptance (spec scenario): disable video while preserving audio and other state — expressed as requirements, not a LayerCake fixture name contract.

## Risks / Trade-offs

- **[BREAKING timing remap]** → Document in mcp-tools + skill; Zod rejects `timeRemapEnabled` on timing immediately.
- **[Inapplicable switch on layer type]** → The Zod allowlist is the union of switches LayerCake knows about; a given live layer only exposes a subset. Expect roughly: base `Layer` → `enabled`, `solo`, `shy`, `locked`; `AVLayer` (footage/comp/solid/text/audio) → those plus `audioEnabled`, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlending`, `motionBlur`, `timeRemapEnabled` when AE exposes them; camera/light/non-AV layers typically lack the AV-only keys (and may lack `audioEnabled` even when `enabled` works). On apply: if the caller sets a key the host cannot read or write on that layer, the target MUST `failed` with a clear message naming the inapplicable key(s), include the actual full switch snapshot in `after` when readable (readable keys present; inapplicable keys absent/omitted — never fabricated), and MUST NOT report `changed`. Agents should inventory (`ae_list_comps` / `ae_get_layer`) first and only send switches that layer actually has.
- **[Full snapshot payload size]** → Fixed small boolean bag (~12 keys); acceptable vs inventory rows.
- **[Solo interactions]** → Soloing one layer affects active/audioActive semantics for others; op only verifies authored switch bits on the targeted layer, not global solo side effects.
- **[Locked layers]** → AE may refuse other switch writes while the layer is locked. Apply MUST order writes so a single op that includes `locked` still succeeds: if `switches.locked === false` (or unlocking is requested), set `locked` first, then other supplied switches; if `switches.locked === true`, set other supplied switches first, then lock last. Only when the layer is already locked and the payload does not unlock it SHOULD other switch writes fail closed as a failed target (caller unlocks in this op or a prior one).

## Migration Plan

1. Ship schema + apply + docs/ADR together.
2. Update any in-repo tests that pass `timeRemapEnabled` on `set_layer_timing`.
3. No data migration (apply-only tool). Rollback = revert change; undo group already covers mid-batch host failures.

## Open Questions

None — open threads from explore were resolved: `layerTargetSchema` everywhere; full allowlist; remap off timing; full evidence; no fixture names from customer projects.
