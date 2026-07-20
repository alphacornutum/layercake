## 1. Schema and types

- [x] 1.1 Add `set_layer_switches` Zod schema (`target` + strict `switches` allowlist, at least one key) and union it into `patchOperationSchema`
- [x] 1.2 Remove `timeRemapEnabled` from `set_layer_timing` schema/refine; reject it if still supplied
- [x] 1.3 Add TypeScript evidence types for full switch-snapshot before/after on `set_layer_switches` targets

## 2. Apply implementation

- [x] 2.1 Add ExtendScript `readLayerSwitches` / `applySetLayerSwitches` in `apply-control-plane-script.ts` (omit = preserve; post-condition on supplied keys; full snapshot evidence; `already_satisfied`)
- [x] 2.2 Wire plan/resolve/dispatch for `set_layer_switches` in `apply-script.ts` using shared layer-target resolve
- [x] 2.3 Stop reading/writing `timeRemapEnabled` inside `applySetLayerTiming`

## 3. Tests

- [x] 3.1 Unit tests: vocabulary membership, empty/unknown switches refused, timing rejects `timeRemapEnabled`, valid id-or-name payloads accepted
- [x] 3.2 Update any existing tests that still pass `timeRemapEnabled` on `set_layer_timing`
- [x] 3.3 Optional host smoke: toggle `enabled` on a fixture layer and assert full switch evidence + no implicit save (skip if no host)

## 4. Docs and persistence

- [x] 4.1 Amend ADR 0003 so id-or-name + post-conditions apply to all layer-targeting patch ops (including `set_layer_switches`); no ids-only exceptions without a superseding ADR
- [x] 4.2 Update `docs/mcp-tools.md` for `set_layer_switches`, full switch evidence, and remap ownership move off timing
- [x] 4.3 Update `.ai/src/skills/drive-after-effects/SKILL.md` per ae-product-skill delta; run `agentsync sync`

## 5. Verify

- [x] 5.1 Run `agentsync check` (Cursor Shell: `required_permissions: ["all"]`) and full QA (`npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`)
