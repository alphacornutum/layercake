## 1. Shared helpers and inventory depth

- [x] 1.1 Add ExtendScript time↔frame helpers (comp frameRate → integer frames) reusable by list-comps and patch timing ops
- [x] 1.2 Extend `list-comps` serialize/parse/types with control-plane layer fields (startTime/frames, switches, parent/matte, timeRemap) while keeping existing second-based timing
- [x] 1.3 Confirm Solid `source.footageKind` on list rows; add/adjust unit fixtures in `tests/inventory.test.ts`
- [x] 1.4 Update `ae_list_comps` tool description in `src/server.ts` for new fields

## 2. Layer inspect dual samples

- [x] 2.1 Extend inspect walk to attach `authoredValue` / `evaluatedValue` for Transform properties (at least Scale) on `extended`/`full` when keys/expressions apply
- [x] 2.2 Keep `value` bound to caller `preExpression`; update parse/types and unit tests
- [x] 2.3 Document dual samples on `ae_get_layer` tool description + `docs/mcp-tools.md`

## 3. Item references tool

- [x] 3.1 Implement `ae_get_item_refs` ExtendScript + TS parse/types (usedIn, layer sources, proxy, parent, track matte; heuristic expression incompleteness → `unknownRefsPossible`)
- [x] 3.2 Register MCP tool in `src/server.ts` with Zod input (`itemId`) and clear error paths
- [x] 3.3 Unit-test parse fixtures; document tool in `docs/mcp-tools.md` and `ARCHITECTURE.md` capability map

## 4. Patch schema and apply plumbing

- [x] 4.1 Extend Zod `patchOperationSchema` discriminated union with all new ops and op-specific fields (no shared `value` bag)
- [x] 4.2 Reuse layer `target` schema (id-or-name) for layer-targeting ops; item ids for project-item ops
- [x] 4.3 Add result/evidence TypeScript types for each new op in `src/patch/types.ts`
- [x] 4.4 Wire validate → plan → apply branches in `apply-script.ts` (ES3-safe) with post-condition re-reads and `already_satisfied`

## 5. Patch mutators (core)

- [x] 5.1 Implement `rename_project_item` with before/after name evidence
- [x] 5.2 Implement `set_layer_index` with before/after index evidence
- [x] 5.3 Implement `create_solid` (always-create; name, dims, pixelAspect, color, optional folder) returning new `itemId` (no reuseIfExists)
- [x] 5.4 Implement `replace_layer_source` with `layerIdPreserved` / `newLayerId` evidence paths
- [x] 5.5 Implement `set_layer_timing` (integer frames only; refuse seconds-only) using shared frame helpers
- [x] 5.6 Implement shared property-path parse (nexrender `.` / `->`) + PropertyBase walker; `set_property_expression` accepts exactly one of `matchNames` | `propertyPath`; set/clear + enabled with authored expression post-conditions; evidence echoes selector + resolved matchNames
- [x] 5.7 Implement `reset_layer_surface` with parameterized clear flags + optional transform/expression clears
- [x] 5.8 Implement `delete_layer` with absence post-condition

## 6. Safe delete

- [x] 6.1 Share ref-collection logic between `ae_get_item_refs` and `safe_delete_project_item` apply path
- [x] 6.2 Implement `safe_delete_project_item`: refuse root, refuse any refs / `unknownRefsPossible`, empty folders only (non-recursive); leave `delete_project_item` unchanged
- [x] 6.3 Best-effort post-check for newly missing retained footage; include pre-delete ref snapshot in evidence

## 7. Tests

- [x] 7.1 Unit tests for new Zod schemas (accept/reject) and inventory/inspect/refs parsers
- [x] 7.2 Unit tests for apply planning/validation where hostless (invalid ops, seconds-only timing, safe-delete preconditions mocked/fixtures as feasible)
- [x] 7.3 Host e2e (`npm run test:ae`) covering create_solid → replace_layer_source → set_layer_index/timing → expression → reset → delete_layer → safe_delete happy/refuse paths when AE configured; note skip otherwise

## 8. Docs and product skill

- [x] 8.1 Update `docs/mcp-tools.md` op table + inventory/refs/`ae_get_layer` dual-sample notes
- [x] 8.2 Update `ARCHITECTURE.md` capability map / runtime flow for `ae_get_item_refs` and expanded patch vocab
- [x] 8.3 Update `skills/drive-after-effects/SKILL.md` and `.ai/src` mirror: prefer new typed ops; contrast safe vs permissive delete; authored vs evaluated; domain policy stays agent-side
- [x] 8.4 Run `agentsync sync` after `.ai/src` edits; briefly confirm README if tool surface is listed

## 9. Verification

- [x] 9.1 Run `agentsync check` with unrestricted permissions
- [x] 9.2 Run `npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`
- [x] 9.3 Run `npm run test:ae` when host env is available (otherwise document skip in apply summary)
