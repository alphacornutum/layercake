# Tasks

## 1. Ensure explicit assignment in `rename_layer`

- [x] 1.1 Update `rename_layer` apply logic and target evidence to read the name-assignment state, assign when the requested text differs or the current name is inherited, report `already_satisfied` only for a matching explicit name, and verify the explicit post-condition; cover inherited-match, explicit-match, assignment failure, and source identity preservation in `tests/patch.test.ts` and verify with `npm test`.
- [x] 1.2 Update `docs/mcp-tools.md` and the `ae_patch_project` tool description to explain the ensure-explicit-name semantics and before/after evidence; verify the documented request shape remains the existing `rename_layer` schema.

## 2. Expose name state in read-only layer inspection

- [x] 2.1 Add `isNameSet` and best-effort `isNameFromSource` to the always-present `ae_get_layer` identity payload and cover serialization in inspection unit tests; verify with the relevant unit-test file and `npm test`.
- [x] 2.2 Update the `ae_get_layer` description, `docs/mcp-tools.md`, and `ARCHITECTURE.md` to document the name-state fields and their best-effort availability; verify the documentation matches the returned payload.

## 3. Verify host persistence and source replacement

- [x] 3.1 Add gated After Effects host coverage for an inherited-name solid layer: same-text `rename_layer` reports a verified explicit assignment, `ae_get_layer` confirms it, and an already-explicit repeat is idempotent; verify with `npm run test:ae` when the host is configured.
- [x] 3.2 Extend host coverage to save a copy, close and reopen it, inspect the explicit name state, then replace the layer source with differently named footage and verify the explicit layer name and replacement source id; verify with `npm run test:ae` when the host is configured.
- [x] 3.3 Run `openspec validate explicit-layer-name-assignment --type change --strict` and the applicable unit/type/lint/build checks; record any host-test skip when After Effects is unavailable.
