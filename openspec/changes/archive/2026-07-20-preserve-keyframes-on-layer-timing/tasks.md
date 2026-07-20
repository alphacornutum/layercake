## 1. Snapshot / restore helpers

- [x] 1.1 Add ExtendScript helpers in `apply-control-plane-script.ts` to walk a layer’s property tree and snapshot keyed leaves (`matchNames` path, per-key time/value + best-effort ease/interpolation/spatial)
- [x] 1.2 Add compare + restore (rebuild key timeline via removeKey/addKey/setValueAtKey + attribute restore) with time epsilon `1e-4`s
- [x] 1.3 Extend timing target TS types with `keyframesPreserved` and compact `keyframeDrift` (capped list)

## 2. Wire into `applySetLayerTiming`

- [x] 2.1 Snapshot before timing write when not `already_satisfied`; skip heavy restore path when snapshot is empty (no keys)
- [x] 2.2 After timing write, detect drift → restore → re-verify timing edges and key snapshot
- [x] 2.3 Fail with clear message + `keyframesPreserved: false` + drift summary when unrestorable; set `keyframesPreserved: true` on success / already_satisfied

## 3. Tests

- [x] 3.1 Unit-test script includes snapshot/restore helpers and failure message strings (string containment / pure-JS walk if feasible)
- [x] 3.2 Parse/shape unit coverage for `keyframesPreserved` + `keyframeDrift` evidence
- [x] 3.3 Host test (`tests/editing.ae.test.ts`): keyed Scale (or Opacity) layer → `set_layer_timing` → assert key times unchanged and `keyframesPreserved: true` (`skipIf` no host)

## 4. Docs and skill

- [x] 4.1 Update `docs/mcp-tools.md`: verified key preservation (snapshot/restore), `keyframesPreserved` evidence, drag-with-keys still out of scope
- [x] 4.2 Update `.ai/src/skills/drive-after-effects/` timing guidance; run `agentsync sync`
- [x] 4.3 Touch `ARCHITECTURE.md` only if capability map needs the stronger key-preservation wording (skip if unchanged)

## 5. Verify

- [x] 5.1 Run unit QA: `npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`
- [x] 5.2 Run `agentsync check` with full permissions after skill sync
- [x] 5.3 Run `npm run test:ae` when host configured; note skip otherwise
