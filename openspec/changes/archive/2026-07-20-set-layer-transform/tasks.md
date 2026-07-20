## 1. Schema and types

- [x] 1.1 Add `set_layer_transform` Zod schema: `target` (`layerTargetSchema`) + strict partial `transform` bag (`anchorPoint`/`position`/`scale` arrays length 2|3, `rotation`/`opacity` numbers; at least one key; reject unknown keys). No op-level `expected` bag
- [x] 1.2 Union `set_layer_transform` into `patchOperationSchema` and update `ae_patch_project` tool description in `server.ts` to list the op
- [x] 1.3 Add TypeScript evidence types for full authored transform-snapshot before/after on `set_layer_transform` targets; extend `reset_layer_surface` evidence so `resetTransforms` carries actual numeric transform before/after and does **not** use `cleared.transforms` as proof

## 2. Apply implementation

- [x] 2.1 Add ExtendScript helpers in `apply-control-plane-script.ts` to read authored/pre-expression transform allowlist values and compare components with a documented float epsilon
- [x] 2.2 Implement `applySetLayerTransform`: omit key = preserve; refuse supplied properties with `numKeys > 0`; write only supplied keys; post-condition on authored values for supplied keys; full snapshot evidence; `already_satisfied` / `changed` / `failed` with actual `after`
- [x] 2.3 Wire plan/resolve/dispatch for `set_layer_transform` in `apply-script.ts` using shared layer-target resolve
- [x] 2.4 Replace the stub `resetTransforms` block in `applyResetLayerSurface`: apply AE defaults for the 2D baseline (Anchor = source center, Position = comp center, Scale 100%, Rotation 0, Opacity 100), respect clear-keys-before-reset ordering, verify via authored post-condition, include actual transform before/after in evidence, omit `cleared.transforms`, do not clear expressions unless `clearExpressions` is true, fail the target when `resetTransforms` was requested and verification fails

## 3. Tests

- [x] 3.1 Unit tests: vocabulary membership; empty/unknown `transform` refused; valid id-or-name payloads accepted; no `expected` field in schema
- [x] 3.2 Unit tests for evidence type shaping / schema fixtures (authored transform before/after; resetTransforms evidence has values and no `cleared.transforms` proof)
- [x] 3.3 Optional host smoke (`npm run test:ae`): set Position/Anchor on a fixture solid; `already_satisfied`; refuse keyframed property; honest `resetTransforms` yields verified defaults with numeric after (skip if no host)

## 4. Docs and skill

- [x] 4.1 Update `docs/mcp-tools.md`: table row + short example for `set_layer_transform` (slot repair after replace, authored value evidence, fingerprint guards); document honest `resetTransforms` (values not boolean; `clearExpressions` separate) vs explicit slot geometry
- [x] 4.2 Update `.ai/src/skills/drive-after-effects/SKILL.md` per ae-product-skill delta; run `agentsync sync` (and keep package `skills/drive-after-effects/` aligned if that tree is the shipped source)
- [x] 4.3 Touch `ARCHITECTURE.md` only if the capability map / tool surface summary needs `set_layer_transform` called out

## 5. Verify

- [x] 5.1 Run `agentsync check` (Cursor Shell: `required_permissions: ["all"]`) and full QA (`npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`)
