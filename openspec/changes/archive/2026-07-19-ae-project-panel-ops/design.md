## Context

`ae_patch_project` today has a single op (`set_text_style`) with path/fingerprint guards, broad-target gating, undo grouping, and structured before/after evidence. Inventory already exposes folder trees and `parentFolderId` / `Item.id` handles via `ae_list_folders` / `ae_list_sources` / comps. Project panel organization still forces `ae_eval_script`. AE’s primitives are straightforward: `items.addFolder`, `Item.parentFolder = folder`, `Item.remove()` (folders recursively delete contents).

## Goals / Non-Goals

**Goals:**

- Add typed panel ops: `create_folder`, `move_project_item`, `delete_project_item`.
- Id-only handles; root is the real `rootFolder.id` from inventory (no magic `0`).
- Per-target evidence always; post-apply fingerprint/dirty/revision remain on success (document reuse for next save).
- Delete matches AE defaults + impact report (nested count, full `usedInCompIds`); refuse root only.
- Authored-state / pre-expression documentation for the whole patch tool.
- Compose over existing `src/patch/` apply path — no new MCP tool, no `AeHost` changes.

**Non-Goals:**

- Workflow-specific ops (“ensure siblings at root”, name-based extraction).
- Empty-folder-only delete gate or in-use delete gate (agents can sequence leaf deletes themselves).
- Typed `ae_undo` tool; `save_current`; implicit save; date-suffix path generation.
- Preview/dry-run or plan tokens.
- Disk file deletion (AE `Item.remove` never removes files from disk).

## Decisions

### D1 — Placement primitive, not co-locate-to-root

Ops put items under a caller-supplied `destinationFolderId` (or create under `parentFolderId`). Agents that need “both at root” pass root’s id from `ae_list_folders`. Sibling/root product rules stay outside LayerCake.

**Alternatives:** Sentinel `{ kind: "root" }` — rejected; inventory already returns root id and keeps one id namespace. Magic `0` — rejected; `rootFolder.id` is not guaranteed to be `0`.

### D2 — Unified item selector + three ops

```json
{ "op": "create_folder", "name": "Bundle", "parentFolderId": 12 }
{ "op": "move_project_item",
  "selector": { "kind": "items", "itemIds": [1, 576] },
  "destinationFolderId": 12 }
{ "op": "delete_project_item",
  "selector": { "kind": "items", "itemIds": [99] } }
```

Selector stays a discriminated `kind` union (add `items` alongside existing layer/comp/text kinds). One delete op for folders, footage, and comps — type resolved at apply time.

**Alternatives:** Separate `delete_folder` / `delete_footage` tools — rejected; AE’s `Item.remove` is unified and agents already think in `Item.id`.

### D3 — Delete = AE defaults + impact evidence

Before `remove()`, collect:

| Resolved type           | Impact fields                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `FolderItem`            | `nestedItemCount` (recursive descendant count; exclude the folder itself) |
| `AVItem` (footage/comp) | full `usedInCompIds` array + `usedInCompCount`                            |
| other                   | zeros / empty as applicable                                               |

Then call `item.remove()`. Refuse if the id is `app.project.rootFolder`. No empty-folder or in-use precondition — safety is the undo group + impact report. On apply failure, existing `app.undo()` rollback remains.

**Alternatives:** Fail-if-non-empty folders — rejected in favor of AE defaults after exploration; agents can still empty first if they want. Cap `usedInCompIds` — rejected; return the full list.

### D4 — Move validation

Resolve each item id; resolve destination as `FolderItem` (including root). Refuse:

- Missing item or non-folder destination
- Moving an item into itself when the item is a folder that would create a cycle (destination is the folder or any descendant of the folder being moved)
- Moving the root folder

Idempotent: if `parentFolder.id === destinationFolderId` → `already_satisfied` (no write).

Evidence: `before.parentFolderId` / `after.parentFolderId` (and optional names for readability).

### D5 — Create folder

`app.project.items.addFolder(name)` then set `parentFolder` when `parentFolderId` is not already the default parent of the new folder (AE creates under root by default when using `app.project.items`). Validate parent is a folder. Return created `id`, `name`, `parentFolderId`. Name collisions: allow AE’s behavior (duplicate names permitted in Project panel) — do not invent uniqueness rules.

### D6 — Evidence + fingerprint contract

Every successful apply already returns `fingerprint`, `dirty`, `revision`. Panel ops MUST attach per-target evidence (D3/D4/D5). Docs/skill: agents MAY pass the returned fingerprint to the next `ae_save_project` / patch without re-polling `ae_project_context` when no other mutator (human UI, `ae_eval_script`, another tool) intervened. Re-bind remains correct and recommended after eval or suspected external edits.

### D7 — Authored / pre-expression documentation

Patch mutates authored project/document state. Panel ops MUST NOT evaluate expressions to select targets and MUST NOT rewrite layer expression source strings as a side effect of create/move/delete. Document alongside `set_text_style` authored-font semantics in `docs/mcp-tools.md` and the product skill.

**Host verification (2026-07-18, `hello-world.aep` work copy):** set a distinctive `Property.expression` on `main` / Hello World opacity → `addFolder` + move comps/footage via `parentFolder` → expression string and `expressionEnabled` unchanged → move children out and `FolderItem.remove()` on the empty probe folder → still unchanged. A control write to `Property.expression` did change the string, so the probe can detect mutation. Caveats to document: (1) deleting an item that owns the layers removes those properties entirely (not a rewrite); (2) deleting in-use footage may leave expression _strings_ intact while later evaluation fails / sources go missing; (3) “pre-expression” here means authored structure / `TextDocument` fonts — panel ops do not use `valueAtTime(..., preExpression)`.

### D8 — Implementation seam

Extend Zod discriminated union in `src/patch/schema.ts`; extend apply ExtendScript in `src/patch/apply-script.ts` (resolve → validate → undo group → mutate → evidence); widen TypeScript result types. Broad-target gate applies to resolved item counts for move/delete the same way as text targets. Unit tests for schema/validation/script presence; host e2e for create → move → delete impact on a fixture (or fixture copy), then `save_copy` optional.

## Risks / Trade-offs

- **[Risk] Recursive folder delete surprises agents** → Mitigation: full impact report with `nestedItemCount` before remove; skill warns; undo group on failure; document AE defaults.
- **[Risk] Deleting in-use footage/comps breaks layers** → Mitigation: full `usedInCompIds` in evidence; no silent omit; skill notes missing-footage aftermath.
- **[Risk] Cycle detection bugs on deep folder moves** → Mitigation: walk `parentFolder` chain from destination up to root; refuse if moving folder id appears.
- **[Risk] Agents hardcode `destinationFolderId: 0`** → Mitigation: docs + skill insist on inventory root id; validation fails clearly when id missing.
- **[Trade-off] No typed undo on success** → Acceptable; AE Edit > Undo / eval remains; failure path already rolls back.

## Migration Plan

Additive op vocabulary — no breaking schema removals. Existing `set_text_style` callers unchanged. Ship docs/skill updates with the code. No data migration.

## Open Questions

- None blocking; `usedInCompIds` full lists and AE-default delete were decided in exploration.
