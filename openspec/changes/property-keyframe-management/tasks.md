# Tasks

## 1. Public contract and input guards

- [ ] 1.1 Add the strict `set_property_keyframes` Zod operation, mutually exclusive timeline/static-sample modes, standard layer target and exact property selector, optional expected count/timeline guards, temporal curve fields, expression policy, and documented fixed bounds; verify schema tests cover valid payloads and reject malformed unions, unsupported fields, non-finite values, invalid times, and inconsistent guards.
- [ ] 1.2 Add public request/result TypeScript shapes for complete property identity, authored before/after state, expected guard, temporal key metadata, preservation evidence, and failure drift; verify typecheck and focused result parser tests.
- [ ] 1.3 Update the `ae_patch_project` tool description and `docs/mcp-tools.md` with target rules, full-timeline replacement, sampled static restoration, linear defaults, temporal ease dimensions, expression default/refusal, optional guards, limits, and no-save behavior; verify examples match schema and documented semantics.

## 2. Property resolution and no-write preflight

- [ ] 2.1 Implement exact, unique property-path resolution with identity evidence, supported numeric property type/dimension checks, expression policy, guard comparisons, tolerance rules, and bounded traversal/evidence budgets; verify pure helper tests cover exact id/name targets, ambiguity, unsupported property/value types, stale state, and budget refusal without mutation.
- [ ] 2.2 Integrate the operation into the patch plan so all keyframe inputs, target identities, samples, expected state, preservation baselines, and duplicate-operation conflicts preflight before the batch undo group; verify a later invalid keyframe op leaves earlier valid batch ops untouched and stale plans trigger rollback rather than recapture.

## 3. Timeline writes and curve verification

- [ ] 3.1 Implement complete numeric timeline replacement and explicit static-value sample/remove/restore, with enabled expressions rejected unless explicit clearing is requested; verify After Effects host tests cover keyed 2D replacement, sampled static restore, expression preservation/clearing, idempotence, and all-and-only target-property key removal.
- [ ] 3.2 Apply deterministic temporal interpolation/ease and normalized spatial defaults for supported values; verify host tests assert independent in/out modes, Bezier ease, linear/Hold behavior, native ease cardinality, spatial straight paths, actual curve readback, and normalization failure reporting.
- [ ] 3.3 Extend mutation evidence and unrelated-key preservation checks to compare bounded sibling key identity, times, values, interpolation, ease, tangents, and flags; verify host tests detect sibling drift, refuse opaque sibling values without a faithful comparator, and include checked counts without claiming whole-project equality.
- [ ] 3.4 Verify apply failures report actual readable after-state and honest rollback attempted/completed evidence without implicit save; run focused patch unit and configured AE host tests for partial-write/postcondition failure and untouched unrelated layer/property state.

## 4. Operator guidance and repository integration

- [ ] 4.1 Update README editing capabilities and packaged `skills/drive-after-effects/` guidance for typed property animation, destructive replacement, `ae_get_layer` inspect-to-guard workflow, and `ae_eval_script` for excluded spatial/advanced curves; verify guidance names supported v1 behavior and limits consistently.
- [ ] 4.2 Run `openspec validate --change "property-keyframe-management" --strict` and the full required QA (`exuno check`, `npm audit --audit-level=high`, typecheck, lint, format check, unit tests, build; AE tests when configured); fix changes introduced by this implementation and record host-test skips when AE is unavailable.
- [ ] 4.3 At sync/archive, reconcile `ARCHITECTURE.md` against the implemented public op and confirm no unrelated `explicit-layer-name-assignment` changes were reverted or absorbed; verify OpenSpec status and final architecture review.
