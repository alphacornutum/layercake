## 1. Schema and types

- [x] 1.1 Add shared Zod layer-target shape (exactly one of `compId`/`compName`, exactly one of `layerId`/`layerName`); use for `rename_layer.target` and `set_text_style` `layers` entries
- [x] 1.2 Add Zod `rename_layer` op (`target` + desired `layerName`); wire into `patchOperationSchema`
- [x] 1.3 Widen `set_text_style` `comps` selector to `compIds` and/or `compNames` (union; at least one non-empty); keep `compIds`-only valid
- [x] 1.4 Extend TypeScript result/evidence types for rename before/after names and resolved ids
- [x] 1.5 Unit tests: accept id-only and name-based rename/`set_text_style` shapes; reject missing/both selectors; reject unknown ops (update former “rejects rename” case)

## 2. Apply path

- [x] 2.1 Reuse or factor inspect-style `resolveComp` / `resolveLayer` helpers into patch apply script with ambiguous candidate payloads
- [x] 2.2 Migrate `set_text_style` resolve path to shared id|name helpers for `layers` and `comps` (+ `compNames`); keep `all_text_layers` behavior
- [x] 2.3 Implement `rename_layer` resolve → validate-all → undo-group apply: set `layer.name` only; opaque string; `already_satisfied` when unchanged
- [x] 2.4 Post-condition: re-read name after write; `changed` only if after equals requested `layerName`; on mismatch/`failed`, still return actual re-read `after` when readable
- [x] 2.5 Backfill post-condition re-reads for `set_text_style`, `move_project_item`, `create_folder`, and `delete_project_item` where not already guaranteed; failed targets include actual `after` when readable
- [x] 2.6 Update `ae_patch_project` tool description in `src/server.ts` to list `rename_layer`, id|name targeting, and verified before/after evidence

## 3. Unit tests

- [x] 3.1 Unit tests for apply-script presence (rename path, shared id|name resolve, `set_text_style` name selectors, post-condition checks) and schema/broad-gate behavior
- [x] 3.2 Unit tests for ambiguous name refusal shaping (candidate lists) when not expressible on the stock fixture

## 4. Host e2e (`tests/*.ae.test.ts`, required)

Gate with `describe.skipIf(!hasHost)` / fixture checks matching `tests/editing.ae.test.ts`. These cases are part of shipping this change — not deferred.

- [x] 4.1 Keep existing Arial / `set_text_style` id-path e2e green after selector migration
- [x] 4.2 Host e2e: `set_text_style` via unique `compName`/`layerName` (and/or `compNames`) on the fixture
- [x] 4.3 Host e2e: `rename_layer` by id; rename by unique name; multi-op batch including opaque mustache/`{message_10}`; verified before/after names; no implicit save on patch
- [x] 4.4 Host e2e: compose rename (or mixed batch) → `ae_save_project` `save_copy`; confirm names on the saved artifact path / re-open as appropriate
- [x] 4.5 Host e2e: stale fingerprint still refused on patch after rename path exists
- [x] 4.6 Host e2e for ambiguous-name refusal when the fixture (or a disposable copy mutated in-test) can express it; otherwise rely on 3.2 and note in the test file
- [x] 4.7 Host e2e or tightly scoped host assertion that post-condition mismatch is not overall success when feasible; otherwise unit-level coverage of the failure shaping

## 5. Docs, ADR, agent guidance

- [x] 5.1 Add ADR(s) for id-or-name targeting + recoverable ambiguous errors, post-condition verification, compose/semantic-verb/op-specific fields (split or combine per design D7)
- [x] 5.2 Update `docs/mcp-tools.md` with `rename_layer` schema/examples, `set_text_style` id|name selectors, and verified-evidence note
- [x] 5.3 Update README mutation/capability copy: typed patch including rename, verified before/after; remove any stale “mutation tools out of scope” wording
- [x] 5.4 Update `skills/drive-after-effects` (+ `.ai/src` skill source if mirrored): `rename_layer`, id|name targeting (prefer id when ambiguous), prefer typed patch over eval, half-sentence copy-first when original must stay pristine
- [x] 5.5 Update `.ai/src` placement/architecture guidance for semantic verbs on new ops; run `agentsync sync`
- [x] 5.6 Update `ARCHITECTURE.md` design constraints / capability notes when this change syncs or archives

## 6. Verification

- [x] 6.1 Run unit QA: `npm run typecheck && npm run lint && npm run fmt:check && npm test`
- [x] 6.2 Run `agentsync check` (with unrestricted permissions in Cursor)
- [x] 6.3 Run `npm run test:ae` with host env configured and confirm the new e2e cases pass (required to close this change on a machine with AE)
