## Context

Inspect already exposes read-only `boxText` / `pointText` on SourceText projections, and `set_text_style` can mutate style and box geometry when the layer is already box text. AE does not allow flipping layout in place. Agents need typed creation of point and box text layers, plus skill guidance to recreate when “converting.” Existing `create_solid` / `create_folder` require `name`; we want one naming rule for all create ops.

## Goals / Non-Goals

**Goals:**

- Add one discriminant patch op `create_text` (`layout: "point" | "box"`) that creates a horizontal text layer in a composition.
- Optional initial `style` bag (same allowlist / authored semantics as `set_text_style`) applied in the same op.
- Optional `name` on all create ops (ADR 0006); evidence always returns the final name + new id.
- Skill documents point↔box as create → copy via typed ops → `delete_layer` (new `Layer.id`).

**Non-Goals:**

- In-place convert / writable `boxText` / `pointText`.
- Vertical text create APIs.
- Deep-copy effects, masks, parenting, expressions, or Source Text keyframes inside `create_text`.
- `executeCommand` UI convert.
- Separate `create_point_text` / `create_box_text` ops alongside `create_text`.

## Decisions

### 1. One op with `layout` discriminant (not two ops, not both)

**Choice:** `create_text` with `layout: "point" | "box"`.

**Alternatives:** Two ops mirroring `addText` / `addBoxText`; shipping both shapes.

**Why:** One verb for agents; shared `style` / evidence; Zod refine requires `boxTextSize` only for box. Two ops alone are acceptable but duplicate; both shapes confuse callers.

### 2. Comp targeting

**Choice:** Nested comps-only `target` with exactly one of `compId` | `compName` (ADR 0004 / `set_comp_settings` parity). Not a layer `target` (there is no existing layer yet).

### 3. Host APIs

**Choice:**

- `layout: "point"` → `comp.layers.addText(text)` (string; then apply optional style / name).
- `layout: "box"` → `comp.layers.addBoxText(boxTextSize)` then set Source Text `text` (and style) on the authored document.

Horizontal only (`LineOrientation.HORIZONTAL` as AE defaults for these APIs).

### 4. Optional `style` in the same op

**Choice:** Reuse `set_text_style` allowlist and `applyStyleToDoc` / projection helpers. Omit key = leave AE create defaults. Post-condition: layout flags match `layout`; supplied `text` and (for box) create-level `boxTextSize` match; every supplied `style` key matches authored snapshot (same equality as `set_text_style`).

**Failure:** If create succeeds but style or post-condition fails, apply MUST best-effort delete the new layer and report failure (no orphan left as `changed` success).

**Box size source of truth:** Create-required `boxTextSize` for box layout. Optional `style.boxTextSize` / `style.boxTextPos` MAY further adjust after create; post-condition uses final authored values for supplied keys.

### 5. Optional `name` — ADR 0006 for all creates

**Choice:** Document in `docs/adr/0006-optional-create-names.md` (or similar slug):

> Typed create patch ops treat `name` as optional. Omit → keep After Effects’ (or the host API’s) default name for that create path. When the AE API requires a name argument, LayerCake MAY pass a short conventional placeholder the host will uniquify (documented per op; e.g. `"Solid"` for solids) rather than inventing uniqueness schemes. When `name` is supplied, set that opaque string after create (no normalization). Evidence always includes the final `name` and new id(s). Later renames use `rename_*`.

**Applies to:** `create_folder`, `create_solid`, `create_text`, and future `create_*`.

**Migration:** Soften Zod/`name` on `create_solid` and `create_folder` from required to optional. Callers that still pass `name` unchanged.

### 6. Convert is skill-only

**Choice:** No `convert_text_layout` op. Skill recipe:

1. Inspect old layer (`extended`/`full`) — read `boxText`/`pointText` + style.
2. `create_text` with the other layout (agent chooses box size for point→box).
3. Optionally `set_layer_transform` / timing / switches / `rename_layer` / `set_layer_index` to match.
4. `delete_layer` old when ready; use new `layerId`.

Warn: new id; effects/masks/parenting/expressions/keys not transferred by this recipe.

### 7. Always creates

Like `create_solid`, `create_text` always yields a new `Layer.id`. No reuse-by-name.

## Risks / Trade-offs

- **[Risk] Style failure leaves orphan layer** → Delete new layer on style/post-condition failure before reporting failed.
- **[Risk] AE default names are opaque / locale-dependent** → Evidence returns actual `name`; agents that care should pass `name`.
- **[Risk] Agents expect convert to preserve `Layer.id`** → Skill + docs state recreate changes id; out of scope for v1.
- **[Risk] `addBoxText` then style write race with empty doc** → Set `text` and style via shared authored TextDocument helpers; host-test point and box creates.
- **[Risk] Softening `create_folder` name surprises panel workflows** → ADR notes omit is allowed but explicit names remain recommended for structure; evidence always returns final name.

## Migration Plan

1. Land ADR 0006 + OpenSpec deltas.
2. Implement `create_text` + optional name on existing creates.
3. Update `docs/mcp-tools.md`, skill (`.ai/src/` + `agentsync sync`), `ARCHITECTURE.md` if create ops are listed.
4. Unit tests for schema/refine; host tests when AE available.
5. Rollback: remove op from vocabulary / revert name optionality (callers that omitted name would need to pass name again — low risk).

## Open Questions

- (resolved) One discriminant op, not two.
- (resolved) Style bag on create: yes.
- (resolved) Optional name + ADR for all creates.
- Empty `text` string: **allowed** (AE permits empty Source Text); still require the `text` field present for explicit intent.
