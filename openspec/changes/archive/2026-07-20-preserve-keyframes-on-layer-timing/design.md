## Context

`set_layer_timing` claims keyframe times stay composition-absolute (source-slip semantics). Implementation only assigns `startTime` / `inPoint` / `outPoint` / `stretch` and post-checks those edges. AE can still nudge key times as a host side effect (field report: Scale `23.00s → 23.02s`). The op then returns `changed` while the preservation contract is broken. Agents that dual-check keys correctly refuse to save; there is no typed keyframe-time repair op.

ExtendScript has `keyTime` / `keyValue` / `setValueAtKey` / `addKey` / `removeKey` and ease/interpolation setters, but **no** `setKeyTime`. Restoring a drifted key means rewriting the property’s key timeline from a pre-write snapshot.

Archived `frame-exact-layer-timing` hardened edges only. This change makes key preservation a verified post-condition of the same op.

## Goals / Non-Goals

**Goals:**

- Successful `set_layer_timing` MUST leave every pre-existing keyframe on the target layer at the same composition time (within epsilon) with the same authored value (and best-effort interpolation/ease/spatial attributes).
- Apply MUST snapshot keys before the timing write, restore after if AE drifted them, and fail the target when restore/post-read cannot match the snapshot.
- Docs/skill MUST state that preservation is enforced inside the op (not aspirational “we don’t call key APIs”).
- Evidence MUST stay compact: success path need not dump full key arrays; failure MUST identify drifted properties.

**Non-Goals:**

- A general typed `set_keyframe_times` / drag-with-keys op (still `ae_eval_script`).
- Guaranteeing pixel-identical motion graphs if AE refuses to re-apply some ease/tangent attributes (times + values are the hard contract; attributes best-effort with fail if times/values still wrong).
- Preserving keys on _other_ layers, or expression string bodies (expressions stay untouched; time-remap remains on `set_layer_switches`).
- Changing on-grid / `durationFrames` edge rules from `frame-exact-layer-timing`.

## Decisions

### 1. Preserve inside `set_layer_timing` (option A)

Flow:

1. Resolve layer; read timing `before`.
2. If timing already satisfied (existing on-grid rules) → `already_satisfied` (no key walk needed).
3. Else **snapshot** all keyed properties on the layer (property-tree walk).
4. Write timing fields as today.
5. **Compare** post-write key times to snapshot; if any property drifted → **restore** that property’s keys from the snapshot.
6. Re-check timing edges (on-grid / durationFrames) **and** key snapshot match.
7. `changed` only if both pass; else `failed` with message + compact drift evidence.

**Alternatives considered:** Fail-closed without restore (honest but leaves agents needing eval). Separate keyframe op (larger surface; does not stop silent `changed` on timing alone). Doc-only softening (rejected — trust regression).

### 2. Restore strategy: rebuild property key timeline

Because there is no `setKeyTime`, restore for a drifted property:

1. Remove all keys on that property (`removeKey` loop, same pattern as `clearPropertyKeys`).
2. Re-add each snapshot key at original `time` with `addKey` / `setValueAtKey` (or `setValueAtTime` then fix attributes).
3. Best-effort re-apply interpolation types, temporal ease, spatial tangents / continuity flags when readable in the snapshot.

Match keys by snapshot order (index 1..n). Do not attempt delta-shift heuristics.

If `numKeys` after timing differs from snapshot before restore, treat as drift and rebuild.

### 3. Snapshot contents

Per keyed leaf property (skip groups):

- Identity: `matchNames` path from layer root (array of matchName strings) — stable enough for restore/walk
- For each key: `time`, `value` (raw AE value as assigned), plus best-effort: in/out interpolation types, temporal ease, spatial tangents/flags when applicable

Walk the same tree style as `walkClearKeysAndExpressions` / inspect — include Transform, Effects, Styles, Masks, Text animators, Markers, etc. Skip properties that throw on `numKeys` / are not keyframeable.

Markers: include Marker property keys when present; MarkerValue restore may be lossy — if times cannot be restored, fail the op (do not claim success).

### 4. Comparison epsilon

- Time: `abs(after - before) < 1e-4` seconds (catches ~0.02s AE nudges; tolerates float noise after fps churn). Do not use frame rounding alone — that recreates the half-frame class of lie for keys.
- Values: existing AE equality patterns used elsewhere in patch (JSON-stable stringify of serialized numbers, or numeric epsilon for floats). Prefer exact match for enums/strings; numeric arrays element-wise with a small epsilon.

### 5. Evidence shape (additive, lean)

On timing target results:

- Keep existing timing `before` / `after` frames+seconds.
- Add `keyframesPreserved: true` when the key post-condition passes (including layers with zero keys).
- On key failure: `keyframesPreserved: false` and a compact `keyframeDrift` array (e.g. `{ matchNames, beforeTime, afterTime }` for first few drifted keys; cap length) plus a clear `message`.

Do **not** put full key timelines in success evidence (payload size).

### 6. Docs / skill

Update `docs/mcp-tools.md` and product skill: success means edges on-grid **and** keys preserved via snapshot/restore; drag-with-keys remains out of scope; agents SHOULD still dual-check critical carriers after save if they want persistence proof (ADR 0003 — patch still does not save).

## Risks / Trade-offs

- **[Risk] Restore loses exotic key attributes (expressions on property, roving, custom spatial)** → Mitigation: best-effort attribute restore; hard-fail if times/values mismatch; host test on Scale keys; leave eval escape hatch.
- **[Risk] Heavy layers: property walk twice adds latency** → Mitigation: skip walk when no keys found on first pass; accept cost for correctness on animated carriers.
- **[Risk] Rebuild momentarily empties keys (undo group still wraps whole apply)** → Mitigation: keep restore inside the existing patch undo group; fail target if rebuild throws mid-way (rollback reporting unchanged).
- **[Risk] False fail from float noise** → Mitigation: 1e-6s epsilon; validate on 23.976/29.97 comps in unit/AE tests.
- **[Trade-off] No public keyframe editor** → Accept; thin primitives; this change only closes the timing contract hole.

## Migration Plan

- Deploy as stricter success semantics; no op rename.
- Callers that only checked `status === "changed"` may newly see `failed` when AE would have moved keys and restore cannot fix — correct.
- No project-file migration.

## Open Questions

- Whether MarkerValue / text-document keys need a narrower restore path in the first host spike (decide during `test:ae`; default: include in walk, fail loudly if unrestorable rather than skip).
- Cap size for `keyframeDrift` in evidence (recommend ≤ 8 entries + `truncated: true`).
