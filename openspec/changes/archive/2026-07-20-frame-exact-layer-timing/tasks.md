## 1. Helpers and evidence shape

- [x] 1.1 Add on-grid helper next to `timeToFrame` / `frameToTime` in `src/inventory/shared-script.ts` (frame-unit epsilon)
- [x] 1.2 Extend `readLayerTimingFrames` (and TS evidence types) with `startTime` / `inPoint` / `outPoint` / `durationFrames`
- [x] 1.3 Update unit fixtures/assertions that parse timing evidence shapes

## 2. Apply post-condition

- [x] 2.1 In `applySetLayerTiming`, require integer frame match **and** on-grid for every supplied edge
- [x] 2.2 Require exact `durationFrames` when effective in/out are in scope
- [x] 2.3 Fail with clear message + actual after (frames + seconds) when rounded match but off-grid / duration wrong
- [x] 2.4 Align `already_satisfied` with on-grid + duration rules (no false already_satisfied on off-grid layers)

## 3. Tests

- [x] 3.1 Unit-test on-grid helper and evidence serialization (including non-integer fps cases if pure-JS feasible)
- [x] 3.2 Extend patch unit coverage for failed off-grid / duration mismatch messaging where mockable
- [x] 3.3 Add or extend `tests/editing.ae.test.ts` host case: set in/out → re-read on-grid + exact durationFrames (skipIf no host)

## 4. Docs and skill

- [x] 4.1 Update `docs/mcp-tools.md` for on-grid exactness, seconds-in-evidence, persistence/render outside op
- [x] 4.2 Update `.ai/src/skills/drive-after-effects/` timing guidance; run `agentsync sync`
- [x] 4.3 Touch `ARCHITECTURE.md` only if capability map wording needs the stronger timing contract (skip if unchanged)

## 5. Verify

- [x] 5.1 Run unit QA: `npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`
- [x] 5.2 Run `agentsync check` with full permissions after skill sync
- [x] 5.3 Run `npm run test:ae` when host configured; note skip otherwise
