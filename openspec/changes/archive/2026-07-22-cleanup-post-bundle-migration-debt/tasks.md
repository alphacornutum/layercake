## 1. Self-contained loaders

- [x] 1.1 Change `buildGetItemRefsScript` to join only the `__itemId` preamble and `loadAeScript("get-item-refs")` (drop `SHARED_INVENTORY_HELPERS` prepend)
- [x] 1.2 Grep for imports of `inspect-script`, `resolve-script`, `text-document-script`, and unused `SHARED_*_HELPERS` exports; delete dead loader modules and stale “until migration lands” comments
- [x] 1.3 Remove or rewire `shared-script.ts` so inventory no longer exposes unused concat helpers; update `tests/inventory.test.ts` to assert via `loadAeHelperScript` / emitted entry content instead of dead concatenators

## 2. Version floor messaging and docs

- [x] 2.1 State After Effects **24.6+** in `docs/setup.md` (badge target) and align `docs/troubleshooting.md` so it does not omit/contradict the floor where host version is relevant
- [x] 2.2 Replace AE-22 product-floor strings in first-party errors (e.g. `get-layer.ts`) and MCP tool descriptions (e.g. `server.ts` Layer.id copy) with **24.6+**
- [x] 2.3 Soft-fix ADR / architecture notes that still point implementers at deleted `resolve-script.ts` loader paths (prefer `src/ae-scripts/shared/resolve.ts`)

## 3. Agent guidance

- [x] 3.1 Update `.ai/src` placement / `add-ae-mcp-tool` skill to teach self-bundled `loadAeScript` entries instead of `SHARED_INVENTORY_HELPERS` prepend as the default
- [x] 3.2 Run `agentsync sync` after `.ai/src` edits

## 4. Verification

- [x] 4.1 Run unit QA: `npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build` (and `agentsync check` with unrestricted permissions in Cursor)
- [x] 4.2 When a local AE host is configured, run `npm run test:ae` as a smoke after the loader cleanup (do not expand scope to remove `//@ts-nocheck` from `patch-apply.ts`)
