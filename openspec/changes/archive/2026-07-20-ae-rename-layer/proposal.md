## Why

Template audits can approve corrected mustache layer names (for example `{BrandURL}` → `{brand_url}`), but LayerCake has no typed way to apply those renames. Agents fall back to raw `ae_eval_script`, which is hard to review, easy to mis-target, and weak on post-apply proof. The editing foundation already has fingerprint guards, undo-grouped patch, and `save_copy`; rename was deferred and is now the next compliance path.

## What Changes

- Add a typed `rename_layer` operation to `ae_patch_project` (one exact layer target + `layerName` string per op; batch via `operations[]`).
- Establish id-or-name targeting (same rules as `ae_get_layer`) for patch layer ops: `rename_layer` and migrate `set_text_style` `layers` / `comps` selectors in this change; refuse ambiguous names with candidate lists agents can act on. Existing id-only `set_text_style` payloads remain valid.
- Establish post-condition verification as the patch norm: after each mutating target, re-read live state and confirm it matches the request; backfill existing ops where missing; advertise in operator docs / README.
- Persist cross-cutting decisions: compose (never mega-tools), semantic op verbs, id-or-name targeting with recoverable errors, op-specific field names (not a shared `value`).
- Skill: half-sentence that agents may `save_copy` first when the original project must stay pristine; prefer typed `rename_layer` over eval for renames.
- No preview/dry-run, no merge/same-name warnings (agent-owned), no mega-tool that bundles patch+save+verify.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ae-project-patch`: Add `rename_layer`; require id-or-name targeting with ambiguous-candidate errors for `rename_layer` and migrated `set_text_style` selectors; require post-condition verification for rename and elevate that rule across the typed op vocabulary (including backfill expectations for existing ops).
- `ae-product-skill`: Document `rename_layer`, compose workflow (context → patch batch → save), and optional copy-first guidance.
- `product-identity`: README / operator-facing note that typed patch returns verified before/after evidence (post-condition), not just fire-and-forget mutation.

## Impact

- Code: `src/patch/schema.ts`, `apply-script.ts`, `types.ts`, Zod registration descriptions in `src/server.ts`; unit tests; **required** host e2e in `tests/*.ae.test.ts` (`npm run test:ae`) for rename + id|name targeting; possible shared resolve helpers with inspect.
- Docs: `docs/mcp-tools.md`, `skills/drive-after-effects`, root `README.md` (brief), `ARCHITECTURE.md` on sync/archive; new ADR(s) for targeting + post-condition + naming/composition norms; `.ai/src` placement/architecture guidance for semantic verbs (then `agentsync sync`).
- Contracts: additive (`rename_layer` + name-based selector alternatives). Existing id-only `set_text_style` shapes stay valid — no **BREAKING** removals.
- Out of scope: duplicate/create text layers, timing edits, semantic name suggestion, extractor/Python schema changes, preview/plan tokens, meta-batch of arbitrary MCP tool calls (future note only).
