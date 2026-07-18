## Why

Agents can inventory Project panel folders and sources, but organizing them still requires raw `ae_eval_script`. Routine placement work (create a folder, move comps/footage by id, delete items) should be typed, guarded, and evidence-rich like `set_text_style`, without inventing workflow-specific “move main+config to root” tools.

## What Changes

- Extend `ae_patch_project` with three typed ops: `create_folder`, `move_project_item`, `delete_project_item`.
- Use stable `Item.id` handles only (including real `rootFolder.id` from inventory — never a magic `0`).
- Keep existing path + fingerprint guards, apply-only semantics, one undo group, and no implicit save.
- Return per-target structured evidence on every op, plus post-apply `fingerprint` / `dirty` / `revision` (already present; document that agents may use it for the next save without an extra context poll when no other mutator ran).
- Delete follows After Effects `Item.remove()` defaults (folders recursively remove contents; in-use footage/comps may be removed). Refuse deleting the project root. Report impact: `nestedItemCount` for folders, full `usedInCompIds` (+ count) for AVItems.
- Document that patch mutates authored project state (pre-expression / authored fonts and panel structure): panel ops select by `Item.id` only and do not read or write `Property.expression` (host-verified for create/move/empty-folder delete; deleting an item that owns layers removes those properties with the item).
- Update product skill + operator docs for the new ops and evidence/fingerprint guidance.

## Capabilities

### New Capabilities

- (none — panel ops extend the existing patch vocabulary)

### Modified Capabilities

- `ae-project-patch`: Add `create_folder`, `move_project_item`, and `delete_project_item` to the typed operation vocabulary; define selectors, validation, evidence shapes, delete impact reporting, and authored-state documentation requirements.
- `ae-product-skill`: Document panel ops in the safe mutation workflow; prefer typed patch for folder/item placement; note post-apply fingerprint reuse and delete blast-radius evidence.

## Impact

- Code: `src/patch/` (Zod schema, apply ExtendScript, result types), `src/server.ts` tool description, unit + host e2e tests.
- Docs: `docs/mcp-tools.md`, `skills/drive-after-effects/SKILL.md` (and mirrored `.ai/src` skill if kept in sync via AgentSync), briefly `README.md` / `ARCHITECTURE.md` if the op list is mentioned.
- No new MCP tools, no host bridge changes, no `save_current`, no implicit save, no name-based selectors.
