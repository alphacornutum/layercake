## Context

LayerCake already provides compact inventories (`ae_list_comps`, sources, folders), deep inspect (`ae_get_layer` with `preExpression`), guarded apply-only patch (`set_text_style`, `rename_layer`, panel create/move/delete), fingerprints, undo-group rollback, and explicit `save_copy`. Agents still need a thicker **control plane** of AE-generic facts and mutators to compose wrapper cleanup without embedding template policy in the MCP. This change deepens inventory + inspect and grows the patch vocabulary; it does not add plan tokens or a render probe.

## Goals / Non-Goals

**Goals:**

- Enough list/inspect facts to prove layer order, Solid vs Comp sources, switches, parent/matte links, and frame-exact timing without custom eval.
- Dual authored/evaluated property samples so expression-driven Scale (etc.) is not mistaken for authored state.
- Shared inbound-ref fact model for cleanup: read-only tool + `safe_delete_project_item` reuse the same checks.
- Typed mutators for rename item, layer index, solid create, source replace, frame timing, expressions, layer surface reset, layer delete, and guarded item delete.
- Keep compose-over-primitives: no mega `normalize_visual_wrapper`.

**Non-Goals:**

- Plan/preview tokens or changing apply-only patch semantics.
- Render-backed visibility / contribution intervals.
- Cover/Contain classifiers, approved expression corpora, `main`/`config` reachability policy, protected layer name lists.
- Breaking or tightening existing `delete_project_item` (AE-permissive).
- Parsing every expression language construct for complete reference closure.
- Comp settings / work-area mutation in this change (can follow once timing/source ops land); agents may still use `ae_eval_script` for rare cases until a later change.

## Decisions

### D1 — Grow existing tools; one new read-only refs tool

| Concern                         | Surface                                   |
| ------------------------------- | ----------------------------------------- |
| Layer row depth                 | Extend `ae_list_comps`                    |
| Dual authored/evaluated samples | Extend `ae_get_layer` (`extended`/`full`) |
| Inbound refs                    | New `ae_get_item_refs`                    |
| Mutations                       | New `ae_patch_project` ops                |

**Alternatives:** Mega inspect-all-graph tool — rejected (latency/payload). Fold refs only into delete evidence — rejected; agents need read-only preview without mutating.

### D2 — List-comps additive fields (keep seconds; add frames)

Keep existing second-based `inPoint` / `outPoint` / `duration` for compatibility. Add:

- `startTime` (seconds) + `startFrame` / `inFrame` / `outFrame` / `durationFrames` derived with containing-comp `frameRate` (document rounding: nearest frame via AE’s time→frame conventions used in script helpers).
- Switches: `enabled`, `videoEnabled` / `audioEnabled` when applicable, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlending`, `motionBlur` (already present).
- `timeRemapEnabled` when applicable.
- `parentLayerId`, `trackMatteType` + `trackMatteLayerId` when AE exposes them (omit when N/A).
- Source: keep compact `source`; ensure `footageKind: "solid"` is present for solids (already required); no solid color in list row.

**Alternatives:** Replace seconds with frames-only — rejected (**BREAKING**). Separate `ae_list_layers` tool — rejected; agents already use comps inventory.

### D3 — Dual samples on inspect without changing default `preExpression`

Today `ae_get_layer` samples with a single `preExpression` flag. For `extended`/`full`, when a property has an expression or keys, also attach:

- `authoredValue` — `valueAtTime(t, true)` (pre-expression)
- `evaluatedValue` — `valueAtTime(t, false)` (post-expression)

Keep existing `value` as the sample under the caller’s `preExpression` (default true) so current clients stay stable. Document that wrapper purity MUST use `authoredValue`, not `evaluatedValue` / post-expression `value`.

Scope v1 dual fields to Transform group properties that commonly carry Cover/Contain expressions (at least Scale; also Anchor/Position/Rotation/Opacity when present in the walk). Other properties MAY omit dual fields when identical or unsupported.

**Alternatives:** Change default `preExpression` to false — rejected. Always duplicate every property — rejected (payload size).

### D4 — `ae_get_item_refs` fact model

Input: `itemId` (Item.id). Output:

```
{
  item: { id, name, type },
  refs: [
    { kind: "used_in_comp", compId, compName? },
    { kind: "layer_source", compId, layerId, layerName? },
    { kind: "proxy_for", itemId },
    { kind: "has_proxy", proxyItemId },
    { kind: "track_matte", compId, layerId, matteLayerId },
    { kind: "parent_link", compId, layerId, parentLayerId },
    { kind: "expression_mention", compId, layerId, propertyPath, confidence: "heuristic" }
  ],
  unknownRefsPossible: boolean,
  incompleteReasons: string[]
}
```

Known classes: `FootageItem.usedIn` / layer.source scan, proxy links, parent + track matte via layer walk. Expression mentions are best-effort string/id heuristics; if any expression exists on layers that could reference the item and was not proven safe, set `unknownRefsPossible: true`.

No `deletionCandidate` boolean — agents (or `safe_delete`) decide.

**Alternatives:** Full project graph always — rejected for v1 cost. Name-only expression parse as authoritative — rejected; incompleteness flag is safer.

### D5 — Patch op shapes (semantic verbs, no shared `value` bag)

Follow ADR 0003: id-or-name for layer targets (inspect parity); `Item.id` for project items; post-condition re-reads; `already_satisfied` when detectable.

| Op                         | Key inputs                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `rename_project_item`      | `itemId`, `name`                                                                                         |
| `set_layer_index`          | layer `target`, `index` (1-based)                                                                        |
| `create_solid`             | `name`, `width`, `height`, `pixelAspect`, `color` `[r,g,b]`, optional folder                             |
| `replace_layer_source`     | layer `target`, `sourceItemId`; evidence includes preserved vs new `layerId`                             |
| `set_layer_timing`         | layer `target`, frame fields (`startFrame`, `inFrame`, `outFrame`, …) + optional stretch / timeRemap     |
| `set_property_expression`  | layer `target`, exactly one of `matchNames` \| `propertyPath`, `expression` \| null, `expressionEnabled` |
| `reset_layer_surface`      | layer `target`, flags for keys/effects/masks/styles/markers/matte/parent/switches/transforms             |
| `delete_layer`             | layer `target`                                                                                           |
| `safe_delete_project_item` | `itemIds[]`; recompute refs at apply; refuse if any known inbound or `unknownRefsPossible`               |

`create_solid` **always creates** a new Solid FootageItem and returns its `itemId`. No `reuseIfExists` / silent reuse in v1 — agents ensure via inventory and pass an existing id into `replace_layer_source`, or delete orphans with `safe_delete_project_item`. Broader `create_project_item` / import ops are deferred.

`replace_layer_source`: try `layer.replaceSource(item, fixExpressions)`; if AE cannot preserve identity, create new AVLayer with desired source/timing/name/index, delete old, return `newLayerId` + `layerIdPreserved: false`.

`set_layer_timing`: require integer frame fields; server converts with `comp.frameRate`. Refuse if only floating seconds provided. Document that trim policy (protected layers) is agent-side.

`reset_layer_surface`: parameterized booleans defaulting to “clear animation surface” for keys/effects/masks/styles/markers/matte/parent; transform reset optional (`resetTransforms: true` → authored defaults). Do not bake expressions unless `clearExpressions: true`.

### D5b — Property path encoding (nexrender-aligned)

Inspired by [nexrender](https://github.com/inlife/nexrender): public string paths parse to segment arrays; the host walker always consumes segments via `property(key)`.

`set_property_expression` (and any future property-targeting reset helpers that need a path) MUST accept **exactly one** of:

- `matchNames: string[]` — ordered PropertyBase matchNames from the layer root (canonical; agents copy from `ae_get_layer`)
- `propertyPath: string` — nexrender-style path: if the string contains `->`, split on `->`; otherwise split on `.`

Both forms feed one ExtendScript walker: start at the layer, for each segment call `property(segment)`. Walk MUST stay on **PropertyBase** nodes only — no nexrender-style JS object-field tails (`Source Text.font`); those belong to text ops, not expression install.

Display names in `propertyPath` (e.g. `"Transform.Scale"`) are allowed because AE `property()` accepts them, but docs/skill MUST prefer matchNames for locale stability. Evidence MUST echo the input selector and, when readable, the resolved `matchNames` array after a successful walk.

```
matchNames: ["ADBE Transform Group", "ADBE Scale"]
propertyPath: "ADBE Transform Group.ADBE Scale"
propertyPath: "ADBE Effect Parade->My.Effect->ADBE Slider Control-0001"  // dot in segment
```

**Alternatives:** `>`-only delimiter — rejected in favor of nexrender `.` / `->` familiarity. MatchNames-only — rejected; agents asked for both. Hybrid TextDocument field walk — rejected for this op.

### D6 — Safe delete vs permissive delete

Keep `delete_project_item` as today. `safe_delete_project_item`:

1. Resolve items; refuse root.
2. For each FootageItem/CompItem: run same ref collect as `ae_get_item_refs`; refuse if `refs.length > 0` or `unknownRefsPossible`.
3. For folders: refuse if any children (`numItems > 0` / nested count > 0) — **never** recursive delete under this op.
4. Post-check: no new missing footage among retained sources that previously resolved (best-effort scan of `footageMissing`).

**Alternatives:** Mode flag on `delete_project_item` — rejected; keeps blast-radius explicit in op name.

### D7 — Still apply-only; compose save

No plan tokens. Agents sequence: `ae_get_item_refs` → patch batch → optional `ae_save_project` `save_copy`. Existing validate-all-then-mutate + undo rollback remains the transaction model.

### D8 — Docs / skill / architecture

Update `docs/mcp-tools.md`, product skill mutation section, `ARCHITECTURE.md` capability map. Skill MUST state domain policy stays outside LayerCake (Cover bodies, protected names, render PASS).

## Risks / Trade-offs

- **[Incomplete refs → false refuse]** → Prefer false refuse (`unknownRefsPossible`) over false allow; document heuristic limits.
- **[replaceSource identity loss]** → Evidence must surface `layerIdPreserved` / `newLayerId`; agents rebind.
- **[List-comps payload growth]** → Additive fields only; still omit property trees; watch host test timings.
- **[reset_layer_surface breadth]** → Parameterize clears; post-condition check key counts / effect counts / expression flags rather than pixel equality.
- **[Frame rounding]** → Centralize time↔frame helpers in ExtendScript; document convention in operator docs.
- **[Large change]** → Implement behind one OpenSpec change but tasks ordered: inventory → refs → mutators → safe delete → docs/skill.

## Migration Plan

1. Ship additive inventory/inspect fields and new tool/ops (non-breaking).
2. Agents migrate from eval scripts to typed ops incrementally.
3. No migration for `delete_project_item` callers.
4. Rollback = revert change; no data migration.

## Open Questions

- Comp settings / work area mutation: still deferred; confirm not needed before first apply slice.

### Locked (no longer open)

- **Property path:** exactly one of `matchNames[]` or nexrender `propertyPath` (`.` / `->`); PropertyBase-only walk; prefer matchNames in docs (D5b).
- **`create_solid`:** always-create in v1; no `reuseIfExists`; no mega `create_item` yet (D5).
- **`rename_project_item`:** any `Item` with `.name` (comps, footage, folders) by `Item.id`.
