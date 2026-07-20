## Context

`ae_patch_project` already provides apply-only typed mutation with path+fingerprint guards, validate-all-first, one undo group, and structured per-target evidence. Ops today: `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`. Layer rename was an explicit non-goal of the editing API; template-slot work now needs it.

Inspect tools (`ae_get_layer`) already resolve comps/layers by exactly one of id or name and return candidate lists on ambiguity. Patch layer selectors are id-only. Persistence stays composed: patch never saves; `ae_save_project` `save_copy` / `create_backup` remain separate.

## Goals / Non-Goals

**Goals:**

- Typed `rename_layer` op: one exact layer + desired `layerName` per op; batch via `operations[]`.
- Id-or-name targeting as the shared patch rule (same as inspect): migrate `set_text_style` layer/comp selectors in this change; `rename_layer` uses the same helpers; actionable ambiguous/not-found errors with candidates.
- Post-condition verification as the patch norm: after mutation, re-read and confirm requested end state; backfill existing ops; advertise briefly in README / mcp-tools.
- Persist decisions: compose (no mega-tools), semantic op verbs, op-specific field names, recoverable targeting errors.
- Skill: prefer `rename_layer` over eval; half-sentence that agents may `save_copy` first when the original must stay pristine.
- ADR(s) + `.ai/src` guidance updates for the cross-cutting norms.
- Host e2e (`tests/*.ae.test.ts` / `npm run test:ae`) covering rename, id|name `set_text_style`, ambiguity refusal, and compose with `save_copy` — required deliverable for this change, not optional follow-up.

**Non-Goals:**

- Preview / dry-run / plan tokens.
- Merge / same-name / slot-identity warnings (agent-owned).
- Mega-tool that bundles patch + save + verify.
- Multi-target rename selector (one op → many layers with one shared name) — use multi-op batch instead.
- Duplicate/create text layers, in/out timing ops (follow-ups).
- Semantic name suggestion from Source Text / placeholders.
- Meta-batch of arbitrary MCP tool calls (see Notes for later).
- Renaming existing ops (`set_text_style`) or tools (`ae_get_layer`) for verb style — aspirational for new names only.

## Decisions

### D1 — Compose patch + save; batch = `operations[]`

Keep the existing split. Agents sequence context → optional `save_copy`/`create_backup` → `ae_patch_project` → save. Never add a single tool that hides that pipeline.

**Alternatives considered:** Mega-tool for “rename and save copy with verify” — rejected (hides composition, fights architecture).

### D2 — `rename_layer` shape (nested target + `layerName`)

```json
{
  "op": "rename_layer",
  "target": {
    "compId": 12,
    "layerId": 3
  },
  "layerName": "{brand_url}"
}
```

- `target`: exactly one of `compId` | `compName`, exactly one of `layerId` | `layerName` (lookup identity — current name when using `layerName`).
- Top-level `layerName`: desired new layer name (opaque string; braces/`{message_10}` preserved; no normalization).
- Nesting avoids colliding lookup `layerName` with desired `layerName`.
- Multi-rename = multiple ops in one apply (one undo group). No `all_text_layers`-style rename selector.

**Alternatives considered:** Flat `newName` / shared `value` field — rejected for semantic, op-specific naming. Parallel `names[]` with multi-target selector — rejected (misalignment risk).

### D3 — Id-or-name targeting is the general rule (migrate `set_text_style` now)

Same contract as `ae_get_layer`: case-sensitive exact match; ambiguous name → refuse before mutation with candidates (`id`/`name` for comps; `id`/`index`/`name` for layers). Prefer ids when names collide.

Shared ExtendScript resolve helpers MUST be reused or factored from inspect (`resolveComp` / `resolveLayer`) rather than duplicated with divergent error shapes.

In this change:

- `rename_layer.target` — exactly one of `compId`|`compName`, exactly one of `layerId`|`layerName`.
- `set_text_style` `selector.kind: "layers"` — each entry uses that same layer-target shape (replacing required `compId`+`layerId` only). Existing `{ compId, layerId }` payloads remain valid.
- `set_text_style` `selector.kind: "comps"` — additive widen: accept `compIds` and/or `compNames` (union, like `ae_list_comps` filters); at least one list non-empty; each name must resolve uniquely or refuse with candidates. Existing `{ compIds: [...] }` payloads remain valid.
- `all_text_layers` unchanged (no name/id picks).
- Panel item ops stay on `Item.id` (Project panel); out of scope for name-based item targeting here.

New layer-targeting patch ops MUST follow the same rule.

### D4 — Post-condition verification for all patch ops

After a mutating write, re-read the affected live field(s) and:

- `changed` only if before ≠ requested and after === requested
- `already_satisfied` if before already matched (no unnecessary write when detectable)
- `failed` if after ≠ requested (do not claim success)

On any non-success target outcome where a post-read is possible (`failed`, including post-condition mismatch, and apply exceptions after a partial write), evidence MUST still include the **actual** re-read `after` state (same shape as success), not omit it or invent the requested value. Agents need the live residual state to recover. If the target is unreadable after failure, omit `after` and say so in the message.

Apply to `rename_layer` first; backfill `set_text_style` (fonts), `move_project_item` (`parentFolderId`), `create_folder` (created id/name/parent), and delete (item absent) in the same change where gaps exist. Batch success rules unchanged: no overall success on partial failure; undo-group rollback reporting stays as today.

Advertise briefly in README + `docs/mcp-tools.md`: typed patch returns verified before/after evidence.

### D5 — Semantic verbs for new ops; op-specific fields

Prefer domain verbs (`rename_layer`, `move_project_item`, …) over bland `get`/`set` when a clear verb exists. Payload fields stay op-specific (`layerName`, `style.font`, `destinationFolderId`, …) — no shared `value`/`values` bag.

Record in ADR + `.ai/src` placement/architecture guidance (then `agentsync sync`). Existing `set_text_style` / `ae_get_*` names stay.

### D6 — No merge warnings; no preview

Duplicate AE layer names and downstream slot merges are agent concerns. LayerCake applies the approved mapping when targets resolve and fingerprint matches.

### D7 — Docs / ADR placement

- ADR 0003 (or next free number): id-or-name targeting + recoverable ambiguous errors (cross-cutting).
- ADR 0004 (or combine if short): post-condition verification + compose/semantic-verb norms — prefer one short ADR if content stays tight; split if unwieldy.
- Update `ARCHITECTURE.md` design constraints on sync/archive.
- Skill + mcp-tools + README as in proposal.
- Fix stale `product-identity` README mutation-scope requirement (still claims dedicated mutation tools are out of scope) so it matches shipped patch + this op.

## Risks / Trade-offs

- **[Risk] Nested `target.layerName` vs op `layerName` confuses agents** → Mitigation: Zod descriptions + mcp-tools examples; evidence echoes resolved ids and before/after names.
- **[Risk] Name-based target races if another layer is renamed first in the same batch** → Mitigation: validate-all resolve before mutate; within-batch order is sequential after resolve snapshot — document that later ops should prefer `layerId` when earlier ops rename siblings that shared a name.
- **[Risk] Post-condition backfill finds latent bugs in font/move paths** → Mitigation: treat failures as real; report `failed` with the actual re-read `after` state (when readable) so agents can see residual reality; fix root causes rather than weaken the bar.
- **[Risk] AE allows duplicate names — agents may think rename “failed” uniqueness** → Mitigation: docs state AE permits duplicates; LayerCake does not enforce uniqueness.
- **[Risk] Widening `set_text_style` selectors regresses Arial e2e** → Mitigation: keep id-only fixtures green; add name-based unit/host cases; reject ambiguous names before mutate.

## Migration Plan

Additive for callers: existing `set_text_style` id-only `layers` / `compIds` payloads remain valid; name-based alternatives are new. Agents gain `rename_layer`; all ops get stricter post-condition reporting where backfilled. No project-file migration.

## Notes for later

- Meta-batch tool: ordered list of arbitrary MCP tool calls (compose + optional persisted recipe) — separate change, not typed patch `operations[]`.
- Follow-up ops: duplicate text layer, create text layer, set in/out — same compose + verify + semantic-verb patterns.

## Open Questions

- None blocking; field name `layerName` and nested `target` locked from explore.
