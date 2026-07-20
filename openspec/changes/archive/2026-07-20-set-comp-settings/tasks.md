## 1. Inventory composition settings

- [x] 1.1 Extend `list-comps-script.ts` to serialize width, height, pixelAspect, durationFrames, displayStartFrame, work-area frames, renderer, and composition switches (keep seconds `duration` + `frameRate`)
- [x] 1.2 Update inventory `types.ts` / `parse.ts` and unit fixtures in `tests/inventory.test.ts` for the new composition fields

## 2. Schema and types

- [x] 2.1 Add shared comps-only `compTargetSchema` (exactly one of `compId` | `compName`) for `set_comp_settings.target`
- [x] 2.2 Add `set_comp_settings` Zod schema (`target` + strict partial `settings` bag with optional nested `switches`, at least one mutation field) and union it into `patchOperationSchema`
- [x] 2.3 Add TypeScript evidence types for full settings-snapshot before/after on `set_comp_settings` targets

## 3. Apply implementation

- [x] 3.1 Add ExtendScript read/apply helpers in `apply-control-plane-script.ts` (frame helpers, work-area clamp-on-duration-shrink, fail on explicit work-area overrun, renderer ∈ renderers, post-condition on supplied keys, `already_satisfied`)
- [x] 3.2 Wire plan/resolve/dispatch for `set_comp_settings` in `apply-script.ts` using `resolveComp`
- [x] 3.3 Update `server.ts` tool description for `ae_patch_project` / `ae_list_comps` to mention the new op and settings fields

## 4. Tests

- [x] 4.1 Unit tests: vocabulary membership; XOR target; empty/unknown fields refused; valid id-or-name payloads accepted
- [x] 4.2 Optional host smoke: change duration/work area on fixture comp (no implicit save); optional same-batch `set_layer_timing` (skip if no host)

## 5. Docs and agent guidance

- [x] 5.1 Record payload-shape decision in `docs/adr/0004-patch-op-target-and-settings-bags.md`; link from design / ARCHITECTURE / placement guidance
- [x] 5.2 Update `docs/mcp-tools.md` for composition settings on `ae_list_comps`, `set_comp_settings` allowlist, work-area policy, and settings-before-timing batch order (link ADR 0004)
- [x] 5.3 Update root `README.md` briefly if it lists tools or inventory fields affected by this change
- [x] 5.4 Update `.ai/src/skills/drive-after-effects/SKILL.md` per ae-product-skill delta; run `agentsync sync`

## 6. Verify

- [x] 6.1 Run `agentsync check` (Cursor Shell: `required_permissions: ["all"]`) and full QA (`npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`)
