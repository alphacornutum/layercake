## Why

The typed ExtendScript authoring migration left dead Node helper loaders, a fragile double-`main` concat on `ae_get_item_refs`, inconsistent AE version-floor messaging (docs and error strings), and residual `//@ts-nocheck` on patch apply. Cleaning these up closes the migration without changing the public MCP tool surface.

## What Changes

- Remove unused import-time helper loaders (`inspect-script.ts`, `resolve-script.ts`, `text-document-script.ts`) and any remaining “until migration lands” comments once nothing in `src/` consumes them.
- Stop prepending `SHARED_INVENTORY_HELPERS` onto the already-bundled `get-item-refs` entry; load the self-contained emit (plus the `__itemId` preamble only).
- Align operator docs so linked `docs/setup.md` (and troubleshooting where version floors appear) state **After Effects 24.6+**, matching README and the badge that links to setup.
- Normalize host-facing version-floor error strings and tool copy that still say AE 22 to **24.6+**.
- Keep `patch-apply.ts` typing incremental (no forced nocheck removal); verify with `npm run test:ae` when a host is available after merge.
- Update unit tests and agent/placement guidance that still describe concatenate-helpers as the primary inventory pattern.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `product-identity`: Require linked setup docs (and consistent version-floor messaging) to state After Effects **24.6+**, not only the README.
- `typed-extendscript-authoring`: Require first-party Node loaders to evaluate self-contained emitted entries without prepending legacy helper concatenations that duplicate bundled symbols; unused helper-loader modules MUST NOT remain as dead import-time side effects.

## Impact

- Code: `src/inventory/*-script.ts` loaders, `item-refs-script.ts`, version-floor strings in `src/ae-scripts/entries/` and related tool descriptions; tests that assert helper concat; `.ai/src` placement/skill guidance if it still teaches `SHARED_INVENTORY_HELPERS` prepend.
- Docs: `docs/setup.md`, `docs/troubleshooting.md` (and any ADR/placement notes that still point at dead loaders).
- APIs: no public MCP tool renames or JSON shape changes; `ae_get_item_refs` behavior unchanged when the duplicate prepend is dropped.
- Out of scope: full removal of `//@ts-nocheck` from `patch-apply.ts` / shared modules (incremental); Linux/COM host work.
