# Tasks

## 1. Public contract and input guards

- [x] 1.1 Add `clearKeys` (literal `true`) to `setPropertyKeyframesOpSchema` in `src/patch/schema.ts` and make the desired state exactly one of `keyframes` (non-empty), `staticValueAtTime`, or `clearKeys`; keep rejecting empty desired `keyframes` and `clearKeys: false`. Verify schema unit tests cover the valid clear payload and reject `clearKeys` combined with either other field, `clearKeys: false`, and absent-everything.
- [x] 1.2 Extend the public result types in `src/patch/types.ts`: `mode` gains `"clear"`; clear after-evidence gains `retainedValue` (distinct from `staticValue`); static failure evidence gains `restore: { attempted: boolean; verified: boolean }`. Verify with `npm run typecheck` and focused result-parser unit tests for the new fields.

## 2. ExtendScript preflight and apply

- [x] 2.1 Extend `preflightSetPropertyKeyframes` in `src/ae-scripts/shared/control-plane.ts` for clear mode: no static sampling, `already_satisfied` when the property already has zero keys and no expression clear is needed, unchanged domain and preservation-baseline checks. Verify clear-mode preflight paths are covered by the existing preflight unit-test fixtures or add them.
- [x] 2.2 Add the clear branch to `applySetPropertyKeyframes`: remove every key, never write a value, read back `retainedValue` for after-evidence (including the `already_satisfied` path), and report `mode: "clear"`. Verify `npm run build:ae-scripts` passes (ES5/ES3-compatible emit, no new globals).
- [x] 2.3 Add the in-place restore path to the static branch: on a write failure after key removal, recreate keys from the captured before-snapshot, re-read the timeline, verify it against the before-snapshot, and report the original error plus `restore: { attempted, verified }` while keeping `mutated`/`anyChanged` honest. Verify build emits and the restore helper reuses strict, recorded restoration rather than swallowed exceptions.

## 3. AE host verification

- [x] 3.1 Add a host test in `tests/editing.ae.test.ts` that builds the hidden fixture from issue #32 (solid layer, source round-trip through audio footage leaving leftover `Audio Levels` keys) and verifies `clearKeys` clears it to `numKeys === 0` without throwing, reports `retainedValue` and `mode: "clear"`, preserves sibling keyed properties, and reports `already_satisfied` on an idempotent re-run.
- [x] 3.2 Add a host regression test that visible-property `staticValueAtTime` behavior is unchanged, and that static mode on the hidden fixture fails with the original error plus `restore` evidence — asserting no partial mutation when restoration verifies (before/after snapshots equal) and honest reporting when it cannot.
- [x] 3.3 Add the host probe for `addKey`/`setValueAtKey` on a hidden property and record the observed behavior in the test comments and `docs/mcp-tools.md` (determines restore verifiability on hidden properties and whether timeline mode can ever apply to them). Verify with `npm run test:ae` on a configured host.

## 4. Operator docs and orientation

- [x] 4.1 Update the `set_property_keyframes` section in `docs/mcp-tools.md`: the three desired states, `clearKeys` usage, and value semantics (AE retains the last key value on a hidden property; `retainedValue` is read-back evidence, not a restore). Verify the documented example payloads validate against the new schema.
- [x] 4.2 Update the `ae_patch_project` tool description in `src/server.ts` and the patch-ops sentence in `ARCHITECTURE.md` to mention clear mode. Verify descriptions match the shipped schema wording.

## 5. Full QA

- [x] 5.1 Run full QA: `exuno check`, `npm audit --audit-level=high`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm test`, `npm run build`, and `npm run test:ae` on a configured host. Verify all green (host tests skipped without a configured host, noted in the run).

## Workflow follow-up

- Sync/archive `property-keyframe-management` before this change: its delta must land in `openspec/specs/ae-project-patch/spec.md` first, or this change's MODIFIED requirement has no target (`openspec validate` currently reports this ordering as INFO).
- After sync/archive of this change, re-check `ARCHITECTURE.md` and `docs/mcp-tools.md` alignment per repo rules.
