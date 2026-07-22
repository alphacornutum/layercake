## Context

Typed ExtendScript authoring shipped self-bundled `dist/ae-scripts/*.jsx` entries. Several Node modules under `src/inventory/` still call `loadAeHelperScript` at import for concatenate-style helpers that nothing in `src/` consumes. `buildGetItemRefsScript` still prepends `SHARED_INVENTORY_HELPERS` before the bundled `get-item-refs` entry, leaving two `function main` definitions (last wins). README and the AE badge state **24.6+**, but `docs/setup.md` / troubleshooting omit the floor, and some host error strings / tool copy still say AE 22. `patch-apply.ts` remains largely `//@ts-nocheck` by design of incremental typing.

## Goals / Non-Goals

**Goals:**

- Delete or stop loading dead helper-loader modules; clear stale migration comments.
- Make `ae_get_item_refs` (and any similar leftover concat) evaluate only the self-contained emit plus intentional preambles (e.g. `__itemId`).
- Align operator docs and version-floor error/tool copy to **After Effects 24.6+**.
- Update unit tests and agent guidance that still teach helper prepend as the primary pattern.
- Smoke-verify with `npm run test:ae` when a host is available.

**Non-Goals:**

- Full typing of `patch-apply.ts` / wholesale `//@ts-nocheck` removal.
- Changing public MCP tool names or JSON result shapes.
- Raising or lowering the supported host floor from 24.6+.
- Removing `loadAeHelperScript` itself (helper-only emit entries remain valid for tests or future shared concat if explicitly needed).

## Decisions

### 1. Delete unused loader modules; keep helper emit for tests if useful

- **Decision:** Remove `inspect-script.ts`, `resolve-script.ts`, and `text-document-script.ts` if nothing imports them. For `shared-script.ts`, either delete it after `item-refs` stops prepending, or keep a thin `loadAeHelperScript("helpers-inventory")` export only if unit tests still assert helper source — prefer pointing tests at `loadAeHelperScript` / emitted entry contents instead of a dead inventory API.
- **Why:** Import-time loads of unused helpers are confusing and can fail if emit is missing.
- **Alternatives:** Leave stubs with “deprecated” comments — rejected; migration already landed.

### 2. Item refs: preamble + `loadAeScript` only

- **Decision:** `buildGetItemRefsScript` joins `__itemId` assignment and `loadAeScript("get-item-refs")` only — no `SHARED_INVENTORY_HELPERS` / no second helper blob unless a separate non-bundled helper is still required (it is not; entry imports `shared/item-refs`).
- **Why:** Bundle already includes needed symbols; double `main` is fragile.
- **Alternatives:** Strip `main` from prepended helpers — unnecessary once prepend is gone.

### 3. Docs and messaging: setup carries the floor; errors match product floor

- **Decision:** State **24.6+** in `docs/setup.md` (badge target) and in troubleshooting where host version is relevant. Replace “AE 22+” / “After Effects 22” floor strings in first-party errors and agent-facing tool copy with **24.6+** (Layer.id still exists since AE 22; product floor is 24.6).
- **Why:** Spec already allows “linked setup docs as needed”; badge → setup without the floor is misleading.
- **Alternatives:** README-only — rejected for this cleanup.

### 4. patch-apply typing stays incremental

- **Decision:** Do not expand scope to type `patch-apply.ts` in this change. Record a post-merge `test:ae` smoke as the verification bar for the loader/docs cleanup.
- **Why:** Finding is explicitly non-blocking; emit migration already done.

### 5. Agent guidance

- **Decision:** Update `.ai/src` placement / add-ae-mcp-tool skill to describe self-bundled entries + `loadAeScript`, not `SHARED_INVENTORY_HELPERS` prepend as the default. Run `agentsync sync` after edits. Soft-update ADR/placement mentions of `resolve-script.ts` only where they would otherwise send implementers to deleted files.

## Risks / Trade-offs

- **[Risk] Tests still expect concatenated helper strings** → Update assertions to load helpers/entries via `loadAeHelperScript` / `loadAeScript` or assert bundled emit contains the symbols.
- **[Risk] safe_delete or other paths still import removed exports** → Grep for `SHARED_*_HELPERS` / loader imports before delete; keep a temporary re-export only if a live consumer remains.
- **[Risk] Docs say 24.6+ while old tool descriptions linger in generated skill copies** → Sync AgentSync outputs after `.ai/src` edits.
- **[Trade-off] Leaving `//@ts-nocheck` on patch-apply** → Acceptable; typing is a follow-up, not this change’s success criterion.

## Migration Plan

1. Fix `item-refs-script` concat; adjust tests.
2. Delete dead loaders; fix imports/comments/guidance.
3. Align docs and version-floor strings.
4. Unit QA; `test:ae` when host available.
5. No rollback beyond reverting the change branch — no data migration.

## Open Questions

- None blocking; if a stray `src/` consumer of resolve/inspect/text helpers appears during apply, keep that one loader and delete only the unused set.
