# Design

## Context

See `proposal.md` for motivation and the `ae-project-patch` delta for the public contract. Today `ae_get_layer` exposes time/value/interpolation entries and, on `full`, temporal ease and spatial tangents. `ae_patch_project` owns project guards, batch target resolution, undo grouping, result shaping, and explicit rollback reporting. `set_property_expression` resolves its property only during apply; its permissive `property(segment)` walk is not sufficient to prove an unambiguous destructive target.

`src/ae-scripts/shared/control-plane.ts` has key snapshots/restoration for timing preservation, but its best-effort catches, match-name-only sibling paths, and equality fallback for opaque values must not be reused as strict preservation proof. ADR 0003 defines the shared id-or-name target contract for new patch operations.

## Goals / Non-Goals

**Goals:**

- Make requested end state deterministic, independently inspectable, and idempotent.
- Keep property-level preflight and evidence inside the existing patch transaction without expanding `AeHost` or adding a new MCP tool.
- Bound destructive work and distinguish what preservation evidence actually verifies from the broader invariant that the operation writes no unrelated state.

**Non-Goals:**

- Merge/upsert timelines, delete selected keys, or provide a generic static property setter.
- Author spatial tangents, auto-Bezier, continuity, roving, motion-path presets, or CSS-style cubic-bezier curves.
- Support complex native values (`TextDocument`, `Shape`, `MarkerValue`, custom values), separation leaders with active separated dimensions, or special properties with structural side effects such as Time Remap.
- Change the semantics of existing patch ops, fix unrelated rollback paths, implement #28's caller-specific Audio/Nexrender/template policy, or edit the unrelated active change.

## Decisions

### One operation, two mutually exclusive desired states

Add `set_property_keyframes` with strict input shapes:

```json
{
  "op": "set_property_keyframes",
  "target": { "compId": 12345, "layerId": 67890 },
  "matchNames": ["ADBE Transform Group", "ADBE Opacity"],
  "keyframes": [
    { "time": 0, "value": 0 },
    {
      "time": 1,
      "value": 100,
      "inInterpolationType": "BEZIER",
      "outInterpolationType": "LINEAR",
      "inEase": [{ "speed": 0, "influence": 33.333 }]
    }
  ],
  "expected": { "numKeys": 2 }
}
```

```json
{
  "op": "set_property_keyframes",
  "target": { "compId": 12345, "layerId": 67890 },
  "matchNames": ["ADBE Audio Group", "ADBE Audio Levels"],
  "staticValueAtTime": 0,
  "expected": { "numKeys": 2 }
}
```

`keyframes` must be nonempty and replaces the whole timeline: omitted keys are deleted. `staticValueAtTime` samples `valueAtTime(time, true)` before deleting any keys, then writes that native numeric sample with `setValue`. Both fields together, neither field, and an empty desired `keyframes` array are rejected. Empty arrays are valid in an _expected_ timeline to assert zero keys. This avoids an empty desired timeline with an unspecified static value. A generic caller-supplied static setter is not introduced here.

All times are finite composition seconds, using the same coordinates as `ae_get_layer.atTime`; no implicit conversion of frames or display-start offsets occurs. A caller may supply the actual display-start time, negative time, or another explicit sample time. No CTI default is used.

**Alternative:** separate set/remove tools or append semantics. Rejected initially because complete desired state fits patch idempotence, and sampled-static mode subsumes the removal use case without a value roundtrip or hidden default.

### Shared layer targets and unambiguous property identity

Use the existing shared `target` contract: exactly one composition selector (`compId` or case-sensitive exact `compName`) and exactly one layer selector (`layerId` or case-sensitive exact `layerName`). Prefer stable IDs when available; accept names only when each resolves uniquely, and fail with the existing candidate evidence when ambiguous. This follows ADR 0003 and is safer than introducing an operation-specific ids-only exception to #28's stable-ID example.

Exactly one property selector is accepted: ordered `matchNames`, or `propertyPath` using the existing `->`-otherwise-`.` delimiter rule. Unlike `set_property_expression`, resolve each new-op segment by exact match name or exact display name, reject multiple candidates instead of taking AE's first match, and include intermediate groups. A display-name effect instance segment can disambiguate duplicate match names only when that name is unique. Case folding, aliases, numeric indexes, and object-field tails are not accepted.

Record each resolved segment's name, matchName, and index in evidence. Keep native property references and index-path handles for internal sibling verification within the bounded transaction; do not re-resolve siblings by matchName alone. Revalidate identity before writing, since other ops can invalidate native references or alter groups.

**Alternative:** IDs-only comp/layer targets. Rejected because LayerCake consistently permits unambiguous exact names, and ADR 0003 explicitly sets that expectation for new patch ops.

### Supported value domain and bounded preflight

Initially support `OneD`, `TwoD`, `ThreeD`, `TwoD_SPATIAL`, `ThreeD_SPATIAL`, and `COLOR` with finite numeric values: a scalar for `OneD`, a 2- or 3-component array for the vector types, and exactly 4 components for `COLOR`. Write values **as supplied** and verify the supplied components, because AE normalizes the tail per property (host observation: a 2D-layer Scale keeps its default z of 100, while Position/Anchor use z of 0, so appending a fixed component would be wrong). Require keyframe capability. Reject complex/index/custom/no-value types, separated leaders, Time Remap, and properties whose validation or required samples cannot be read reliably. Spatial followers can be targeted as their own scalar leaves when supported.

Bounds are fixed and documented: at most 1,024 keys in each supplied/observed target timeline, property paths up to 32 segments, preservation walks up to 4,096 nodes and 4,096 unrelated keys, and 512 KiB of serialized planned evidence per new op. Reject overflow before mutation; do not truncate successful evidence or use `allowBroadTargetSet` to bypass these limits. Budget reads incrementally so an oversized layer cannot incur an unbounded walk before refusal.

Preflight every new op before the batch undo group: resolve leaf/identity, check capability and value dimensions/ranges, interpolation support, ease shape, expressions, expected state, sample static value, capture before evidence, and establish the preservation baseline. Reject duplicate new-op targets in one batch. Project guards remain mandatory and apply even when `expected` is omitted.

Immediately before each new op writes, revalidate its resolved identity and target snapshot against the preflight plan. If an earlier op changes that property or the static sample, fail rather than silently recapturing or applying a stale plan; use the existing batch rollback reporting. Verify unrelated-state preservation against a baseline captured immediately before this op, so legitimate edits by preceding batch ops are not counted as this op's collateral damage. Callers should sequence conflicting property or structure changes in separate guarded calls.

### Optional guards with two strengths

`expected` is optional but, when present, must contain `numKeys`, `keyframes`, or both. `numKeys` is a nonnegative integer. Expected entries require time/value and may assert `inInterpolationType`, `outInterpolationType`, `inEase`, and `outEase`; omitted metadata is not an assertion and is never defaulted. Expected ease assertions may describe an observed linear key as well as a Bezier key.

An expected timeline is complete and ordered. Compare key count plus every time/value, then any supplied temporal fields. Both guards must agree structurally (`numKeys === keyframes.length`) and match the live property. Do not skip expected guards because desired state already matches: a stale guard fails on an otherwise idempotent request.

Use component-wise comparisons, with documented absolute tolerances of `1e-7` seconds for times and `1e-6` for numeric values, ease speeds, and influence. Enums and booleans compare exactly. Desired/expected times must increase strictly and adjacent times must differ by more than the time tolerance; native key-count/time readback catches additional host coalescing.

**Alternative:** count-only guards or a new property token. Both lose useful expressiveness or add state. Two stateless options compose with current inspection. Times/values-only expectations are explicitly not proof of identical curves or expression state; enabled-expression safety remains a separate policy.

### Temporal curves are explicit, not AE preferences

Align input/evidence names with current inspect fields: `inInterpolationType`, `outInterpolationType`, `inEase`, `outEase`; each ease object is `{ speed, influence }`. Defaults for desired keys are `LINEAR` on each omitted side. Support `LINEAR`, `BEZIER`, and `HOLD`, and require each desired Bezier side to supply its ease array. **Host observation (AE 26.5): applying temporal ease forces both sides to `BEZIER`** (a requested `HOLD` out-side reads back as `BEZIER`), so ease is accepted only when both sides are `BEZIER`; mixed or HOLD interpolation with ease is rejected at validation rather than silently normalized. Validate finite speed, influence in `[0.1, 100]`, and native ease cardinality: two for non-spatial `TwoD`, three for non-spatial `ThreeD`, one for the other supported types, including spatial Position and COLOR.

Create all keys and values first, then establish manual temporal interpolation/ease using `setInterpolationTypeAtKey`, `KeyframeEase`, and `setTemporalEaseAtKey`. Normalize temporal auto-Bezier and continuity off, read back the final settings, and fail if AE changes requested values or unsupported combinations. Existing inspection returns ease even for linear keys; docs must explain that desired inputs are curated, not an unrestricted copy of every inspect field.

For newly replaced spatial keys, normalize to straight paths (zero spatial tangents, spatial auto-Bezier/continuity off, roving off). This is a deterministic default, not spatial-curve authoring; AE's spatial-tangent setter requires a 3-element vector even on `TwoD_SPATIAL` properties. Include normalized flags/tangents in actual evidence and in the target's desired-state idempotence comparison. Reject user-supplied spatial settings and advanced flags in v1; callers retain raw eval for those settings. Preserve all such metadata on _unrelated_ keys.

**Alternative:** undocumented AE defaults or a complete curve editor. Defaults make identical requests host-preference-dependent; full curve authoring expands this change substantially. Explicit temporal control covers ordinary easing without taking on roving/time constraints.

### Expression handling is explicit and authored

`expressionHandling` defaults to `reject_enabled`. Preserve the expression body and disabled flag; reject enabled expressions before any mutation. Explicit `expressionHandling: "clear"` requests removal of the target expression only, with empty/disabled expression as a verified postcondition. Do not add a preserve-enabled mode or expression replacement body here; installing expressions remains `set_property_expression`.

Always take the static sample pre-expression, even when clearing an enabled expression. Changing evaluated values of expression consumers is a natural consequence of requested authored-state edits, not a claim that their authored properties were written.

### Actual evidence, scoped preservation, and rollback

Results include target IDs, input selector, resolved segment identities, property value type, effective sample time, and before/after snapshots with key count, complete ordered key timeline, authored sample, and expression body/enabled state. Static-mode after evidence identifies the authored static value; do not label a keyed before sample as static. Timeline evidence includes readable temporal and spatial curve metadata and normalization flags. On readable failures, report actual after state, not desired input.

Verification for other keyed properties on the target layer compares key times, values, interpolation types, and authored Bezier ease (ease only where the side is Bezier). AE-derived metadata — auto ease on non-Bezier keys, spatial tangents, and continuity/auto-Bezier/roving flags — is deliberately **not** asserted: host testing showed AE may recompute it during unrelated evaluation, which produced false drift. Those fields still appear in before/after evidence. Track the set of keyed sibling properties so newly added keys are detected too. Opaque keyed sibling values are refused before mutation; existing best-effort equality must never imply success.

Return `preservation: { scope: "other_keyframes_on_target_layer", checkedProperties, checkedKeys, unchanged }` plus bounded drift details on failure. This proves that scoped check (key times/values/interpolation/authored ease), not a whole-project deep equality audit. The op's mutation boundary and host tests establish that unrelated static authored properties, expressions, layers, settings, source links, and timing are not written. Do not disable locks, expression flags, or layer switches to make a write succeed. Hosts may naturally recalculate evaluated dependent values.

All writes live in the patch undo group. Mark mutation as started immediately after the first successful key removal, expression clear, or key/value write; a later error must not return `anyChanged: false`. Propagate native failures instead of using the reset helper that swallows removal errors. Report rollback attempted/completed separately; never claim verified restoration simply because an undo call did not throw. Exercise partial-write failures and restoration on a configured host. The proposal does not promise universal batch atomicity beyond verified postconditions and honest best-effort rollback reporting.

## Risks / Trade-offs

- AE normalizes some interpolation/ease combinations or coalesces times -> preflight supported settings, apply explicit defaults, compare actual metadata with tolerances, and fail honestly when normalization prevents the request.
- Manual temporal handles and flag ordering differ by property type -> host tests cover scalar, multi-dimensional non-spatial, spatial, COLOR, and hold transitions; type declarations alone are not authority.
- Opaque sibling animation cannot be faithfully compared cheaply -> refuse before mutation rather than return a misleading preservation flag; document this initial limitation.
- Strict replacement discards omitted keys and existing target curve metadata -> describe this prominently and keep full inspect plus optional expected timeline as the recommended workflow.
- Native references become invalid in mixed batches -> revalidate identity/snapshot at point of use and recommend separate calls for conflicting edits.
- Preservation and evidence size limits reject unusually large animation -> explicit limits and errors; raw eval remains available without equivalent typed guarantees.
- This change overlaps files edited by `explicit-layer-name-assignment` -> planning is separate; implementation must build on those edits without reverting or incorporating unrelated changes into this proposal.

## Migration Plan

Additive public operation; existing payloads and id-or-name behavior remain valid. Implement with documentation in the same delivery. Validate unit behavior, ES3-compatible emit, full repository QA, and configured AE host tests. Sync the delta and reconcile `ARCHITECTURE.md` when completed. Rollback of the feature is removal of the additive op; project persistence remains caller-controlled through `ae_save_project`.
