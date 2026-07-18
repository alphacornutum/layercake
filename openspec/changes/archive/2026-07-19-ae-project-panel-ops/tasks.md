## 1. Schema and result types

- [x] 1.1 Extend `src/patch/schema.ts` with `items` selector kind and Zod schemas for `create_folder`, `move_project_item`, `delete_project_item`; add them to the `patchOperationSchema` discriminated union
- [x] 1.2 Widen `src/patch/types.ts` (and any shared result shaping) for panel target evidence: move before/after `parentFolderId`, create identity fields, delete impact (`nestedItemCount`, full `usedInCompIds`, `usedInCompCount`, item type/name)

## 2. Apply path (ExtendScript + TS)

- [x] 2.1 Implement resolve/validate helpers in apply ExtendScript: item by id, folder destination, root refuse, folder-move cycle detection, nested descendant count, `AVItem.usedIn` → full comp id list
- [x] 2.2 Wire `create_folder` (addFolder + parentFolder), `move_project_item` (idempotent `already_satisfied`), and `delete_project_item` (`Item.remove` after impact capture) inside the existing undo-group apply loop
- [x] 2.3 Ensure successful apply still returns `fingerprint` / `dirty` / `revision` and per-op/per-target evidence; apply broad-target gate to resolved item counts for move/delete
- [x] 2.4 Update `ae_patch_project` tool description in `src/server.ts` to list the new ops and authored-state / id-handle guidance

## 3. Tests

- [x] 3.1 Unit tests: schema accept/reject, unknown op, script contains panel op paths / cycle / root refuse strings as appropriate, result parsing for panel evidence shapes
- [x] 3.2 Host e2e (`test:ae`): create folder under real root id → move items → delete with impact assertions (nested count and/or `usedInCompIds`); confirm no implicit save and fingerprint advances

## 4. Docs and skill

- [x] 4.1 Update `docs/mcp-tools.md` (and brief README/`ARCHITECTURE.md` mentions if present) for panel ops, evidence, fingerprint reuse, authored/pre-expression contract, AE-default delete + root refuse
- [x] 4.2 Update `skills/drive-after-effects/SKILL.md` and `.ai/src/skills/drive-after-effects/SKILL.md` per product-skill delta; run `agentsync sync` if `.ai/src/` changed

## 5. Verification

- [x] 5.1 Run full QA: `agentsync check` (Shell `all`), `npm audit --audit-level=high`, `typecheck`, `lint`, `fmt:check`, `test`, `build`; note `test:ae` pass/skip
