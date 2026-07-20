## Context

Typed control-plane patch already covers switches, timing, source replace, expressions, and surface reset — but not authored Transform values. After `replace_layer_source` changes Solid dimensions, AE often updates Anchor Point to the new source center while Position stays at the previous center, leaving the slot visually offset. Agents cannot repair that through a closed typed op without falling back to `ae_eval_script`.

Worse, `reset_layer_surface` with `resetTransforms: true` currently walks the Transform group and sets `cleared.transforms = true` without calling `setValue` to AE defaults or verifying authored values (see `applyResetLayerSurface` around the empty best-effort loop). Post-condition checks effects/masks/markers/parent/matte counts only — not transforms — so `"transforms": true` can lie.

ADR 0003 requires id-or-name targeting and post-condition-verified `changed`. ADR 0004 prefers nested partial bags for heterogeneous mutators. The closed vocabulary forbids a generic untyped property setter inside `ae_patch_project`. Existing `ae_patch_project` `project.path` / `project.fingerprint` guards already refuse stale apply — that is the optimistic-concurrency safeguard for repair workflows.

Parallel change `frame-exact-layer-timing` hardens timing evidence separately; this design does not touch `set_layer_timing`.

## Goals / Non-Goals

**Goals:**

- Add `set_layer_transform` as a closed, typed, one-layer-per-op mutator with nested partial `transform` bag and actual authored-value before/after evidence.
- Make `resetTransforms` actually apply and verify AE defaults for the 2D transform baseline; evidence must return actual authored transform snapshots (not a `cleared.transforms` boolean).
- Keep path/fingerprint guards, validate-all-then-apply, one undo group, no implicit save, atomic failure/rollback reporting.

**Non-Goals:**

- No generic `set_property_value` / matchName bag / untyped property tree writes.
- No op-level expected-current / `if_match` transform bag — fingerprints already cover stale-project refuse.
- No folding expression clear into `resetTransforms` (`clearExpressions` stays a separate flag).
- No `set_layer_timing` changes (owned by `frame-exact-layer-timing`).
- No save inside patch; no render/pixel proof that the slot “looks” centered.
- No 3D-only extras in v1: orientation, separate X/Y/Z Rotation, 3D Position Z as a distinct schema field beyond what AE returns in the Position array when the layer is 3D.
- No keyframe editing/retiming; no expression body writes (use `set_property_expression` / `clearExpressions`).
- No inventing Cover/Contain scale recipes — agents compute desired numbers; LayerCake sets and verifies them.
- No evaluated/post-expression transform samples in v1 evidence (authored only).

## Decisions

### 1. New semantic op `set_layer_transform` (not a generic property setter)

```json
{
  "op": "set_layer_transform",
  "target": { "compId": 1, "layerId": 2 },
  "transform": {
    "anchorPoint": [300, 550],
    "position": [300, 550],
    "scale": [100, 100],
    "rotation": 0,
    "opacity": 100
  }
}
```

- `target`: `layerTargetSchema` (ADR 0003 parity with `ae_get_layer`).
- `transform`: `.strict()` nested bag; at least one allowlisted key required; omit key = preserve (ADR 0004).
- Reject unknown keys before mutation.
- Stale-project safety: callers pass matching `project.fingerprint` on `ae_patch_project` (existing guard). No per-op `expected` bag.

**Alternatives considered:**

- Generic `set_property_value` with matchNames — rejected; fights closed vocabulary and ADR 0003–0004.
- Flat fields on the op root (like `set_layer_timing`) — rejected; transform is a heterogeneous multi-key allowlist; nested bag matches `switches` / `settings` / `style`.
- Extending `reset_layer_surface` only — rejected; agents need explicit desired values for slot repair, not only defaults.
- Optional expected-current guards on the op — rejected; duplicates path/fingerprint optimistic concurrency already on `ae_patch_project`.

### 2. 2D authored Transform allowlist (v1)

| Key           | AE matchName (approx.)        | JSON shape                          |
| ------------- | ----------------------------- | ----------------------------------- |
| `anchorPoint` | `ADBE Anchor Point`           | number array (typically length 2/3) |
| `position`    | `ADBE Position`               | number array (typically length 2/3) |
| `scale`       | `ADBE Scale`                  | number array (typically length 2/3) |
| `rotation`    | `ADBE Rotate Z` / 2D Rotation | number (degrees)                    |
| `opacity`     | `ADBE Opacity`                | number (0–100)                      |

Deferred to a later change: Orientation, separate X/Y Rotation properties, explicit Z-only helpers, and any non-Transform group properties.

Read/write via the Transform group properties; evidence serializes the same key names with actual numeric arrays/scalars.

### 3. Evidence and post-conditions (actual authored values)

Per-target evidence MUST include:

- Full allowlist snapshot `before` / `after` for keys readable on that layer (requested-keys-only evidence rejected — agents need to see Position stayed put when only Anchor was requested, and vice versa).
- Values are **authored / pre-expression** (same spirit as `set_text_style` fonts / `ae_get_layer` authored samples), not post-expression evaluated samples.
- `status`: `changed` only when every **supplied** key’s re-read authored value matches the request within float epsilon; `already_satisfied` when all supplied keys already match before write; `failed` with actual `after` when readable on mismatch / inapplicable / write refusal.

Float compare: small absolute epsilon for components (implementation chooses a documented constant suitable for AE spatial/opacity units — e.g. ~1e-3 for spatial/scale/rotation/opacity unless host tests force a tighter bound).

The op MUST NOT claim render proof. Active expressions may still make on-screen values differ after authored success — clear via `set_property_expression` / `clearExpressions` when needed.

### 4. Keyframes, expressions, locked layers

- If a supplied transform property has `numKeys > 0`, refuse that target before write (clear message); callers clear keys first via `reset_layer_surface` (`clearKeyframes`) or a prior intentional key edit via eval until a typed key op exists.
- Active expressions: still write authored value when AE allows; post-condition is authored/pre-expression. Document that evaluated on-screen value may still differ.
- Locked layers: fail closed if AE refuses the write (same as other control-plane ops); unlock via `set_layer_switches` first when needed.
- Parenting / 3D layer state: do not auto-toggle `threeDLayer`; if Position returns a 3-component array on a 3D layer, accept/return that shape when the caller supplies a matching-length array; length mismatch → fail validation or apply with clear failure (prefer Zod length 2 or 3 for spatial arrays).

### 5. Honest `reset_layer_surface` / `resetTransforms` (values, not boolean)

When `resetTransforms` is true:

1. Compute AE defaults for the 2D baseline on that layer/source (at minimum: Anchor Point = source center when readable; Position = composition center when readable; Scale = `[100,100]` (or AE’s 3-component equivalent); Rotation = `0`; Opacity = `100`).
2. Apply those defaults with the same write path / keyframe refusal rules as `set_layer_transform` (or clear keys first when `clearKeyframes` is also true in the same op — preferred composition: key clear runs before transform reset in the existing surface walk order).
3. Re-read authored values; target success for the transform portion requires post-condition match to those defaults within epsilon.
4. Evidence MUST include actual authored transform snapshot `before`/`after` (or under a dedicated `transforms` evidence field) when `resetTransforms` is true.
5. **Drop** `cleared.transforms` as agent-facing proof — do not emit a transform category boolean that can lie or duplicate the snapshot. Other surface categories may keep their existing `cleared.*` booleans; transforms use value evidence + overall target `status` instead.
6. `resetTransforms` MUST NOT imply `clearExpressions`. Expression clear remains the separate `clearExpressions` flag.
7. If defaults cannot be applied or verified, the target MUST fail when `resetTransforms` was requested — transform failure participates in the op’s post-condition success (fail the target when verification failed), not silently succeed because other categories cleared.

**Alternatives:** Keep `cleared.transforms` plus values — rejected; boolean is redundant once snapshots exist and was the lying signal. Only document the bug — rejected; this is a real lying evidence failure. Fold expression clear into `resetTransforms` — rejected; keep orthogonal flags.

### 6. Apply path placement

Mirror `set_layer_switches`:

- Zod in `src/patch/schema.ts`; evidence types in `types.ts`.
- Plan/resolve in `apply-script.ts`.
- Read/apply helpers in `apply-control-plane-script.ts` (`readLayerTransform`, `applySetLayerTransform`; shared helpers reused by `applyResetLayerSurface` for defaults).
- Batch of N layers = N ops.

### 7. Docs and skill

- `docs/mcp-tools.md`: table row + short example for slot repair after replace; note `resetTransforms` returns authored value evidence (no transform boolean); note `clearExpressions` is separate; fingerprint guards for stale apply.
- `.ai/src/skills/drive-after-effects/SKILL.md`: prefer `set_layer_transform` for authored transform repair; warn that `resetTransforms` resets to AE defaults (comp-center Position, etc.) which may **not** equal “match new Anchor Point” — use `set_layer_transform` for explicit slot geometry; then `agentsync sync`.

### 8. Testing

- Unit: schema (allowlist, empty bag, unknown key, target shape), vocabulary membership, evidence fixtures (no `cleared.transforms`; numeric transform before/after), float-match / already_satisfied cases against pure fixtures where possible.
- Host (optional): on `fixtures/hello-world.aep`, set Position/Anchor on a solid layer; optional replace-then-repair smoke; skip if no host.

## Risks / Trade-offs

- **[Keyframed transforms]** → Fail closed when `numKeys > 0`; document clear-keys-first via `reset_layer_surface`.
- **[Expressions override on-screen]** → Authored post-condition can succeed while evaluated differs; document; agents clear/fix expressions separately via `clearExpressions` / `set_property_expression`.
- **[3D layers / array length]** → Accept length 2 or 3 for spatial arrays; defer Orientation / separate XYZ rotation ops.
- **[Float epsilon]** → Document constant; prefer slightly loose over flaky host failures.
- **[resetTransforms defaults ≠ slot repair]** → Defaults put Position at comp center, not necessarily equal to new Anchor; skill must steer slot repair to `set_layer_transform` with explicit numbers.
- **[Dropping cleared.transforms]** → Callers that only checked the boolean must read value evidence / status instead — intentional breaking evidence shape for that category.
- **[Complementary timing change]** → Do not couple schemas; compose in agent batches if both needed.

## Migration Plan

1. Ship schema + apply + `resetTransforms` honesty + docs/skill together.
2. No data migration. Evidence that relied on `"transforms": true` without value change must switch to authored snapshots / target status — intentional.
3. Rollback = revert change; undo group covers mid-batch host failures.

## Open Questions

1. **Exact AE default for Position on reset** — Locked recommendation: composition center `[comp.width/2, comp.height/2]` (and Z `0` when 3D), matching typical new-layer / Reset Transform behavior. Confirm on host during implement if a more accurate `property` default API exists; do not silently leave Position unchanged.
2. **Whether `resetTransforms` alone should clear transform keyframes** — Recommended default: if `clearKeyframes` is true (schema default today), keys are already cleared before transform reset; if caller sets `clearKeyframes: false` and transform props still have keys, transform reset MUST fail verification rather than half-apply. No separate implicit key clear only for transforms unless implement discovers AE Reset does that atomically — document the chosen behavior in mcp-tools.
