## Why

Agents can mutate only `style.font` via `set_text_style`, and `ae_get_layer` marks Source Text/`TEXT_DOCUMENT` as unserializable — so agents cannot plan or verify other TextDocument fields (leading, size, fill, justification, box geometry, etc.) without raw eval. Template and repair workflows need a typed partial style bag with the same authored/evaluated honesty LayerCake already uses for fonts and Transform.

## What Changes

- Expand `ae_patch_project` → `set_text_style` so `style` is a partial allowlisted bag (omit key = preserve). Require at least one allowlisted key; `font` is no longer mandatory when other keys are supplied.
- Apply still writes the **authored / pre-expression** TextDocument; never clears or rewrites Source Text expressions as a side effect.
- Per-target before/after evidence becomes a style snapshot (authored) plus an evaluated style snapshot when readable — generalize today’s `fonts` / `evaluatedFonts` pattern. Post-condition success depends only on authored values for supplied keys.
- Teach `ae_get_layer` (`extended` / `full`) to serialize Source Text/`TEXT_DOCUMENT` into the same style field shape, with dual authored/evaluated samples when keys or expressions apply (Transform dual-sample parity).
- Update operator docs (`docs/mcp-tools.md`), product skill, and `ARCHITECTURE.md` as needed for the public surface.
- **Not breaking** for callers that only send `style.font`; evidence shape gains fields (additive). Document any rename/generalization of evidence keys carefully so existing font consumers stay clear.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ae-project-patch`: Widen `set_text_style` style bag, dual style evidence, post-condition on authored supplied keys only; fingerprint guards unchanged (no op-level expected-current).
- `ae-layer-inspect`: Serialize TextDocument style fields on Source Text instead of leaving them unserializable; dual authored/evaluated samples.
- `ae-product-skill`: Document the expanded style bag, dual evidence / inspect read path, and prefer typed patch over eval for these fields.

## Impact

- Code: `src/patch/schema.ts`, `apply-script.ts`, `types.ts`; `src/inventory/inspect-script.ts` (+ parse/types if needed); `src/server.ts` tool descriptions; tests (`tests/*.test.ts`, host e2e when available).
- Docs: `docs/mcp-tools.md`, skill under `.ai/src/skills/drive-after-effects/`, `ARCHITECTURE.md` if capability map wording changes.
- Contracts: public MCP JSON for `set_text_style` evidence and `ae_get_layer` Source Text values — additive preferred.
- Out of scope: create-text-layer op; per-paragraph range targeting beyond existing `allStyleRuns`; expected-current / CAS bags; disabling expressions to force on-screen match; kitchen-sink of every AE 24+ TextDocument enum in v1 (curated allowlist in design).
