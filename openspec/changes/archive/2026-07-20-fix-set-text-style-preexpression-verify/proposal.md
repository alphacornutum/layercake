## Why

`set_text_style` post-conditions currently re-read fonts via `Source Text.value`, which is **post-expression**. Expression-driven consumers (e.g. layers that pull style from a `{font}` source) therefore fail verification even when the authored font write succeeded — and reading post-expression before `setValue` risks baking evaluated text/style into the authored document. The patch contract already claims authored / pre-expression mutation; implementation must match. Agents also need to see when an expression still overrides on screen after an authored success.

## What Changes

- `set_text_style` apply reads, mutates, and post-condition-verifies fonts from the **pre-expression** `TextDocument` (via `valueAtTime(..., true)` when expressions/keyframes apply), not `property.value` alone.
- Target evidence keeps `before.fonts` / `after.fonts` as authored fonts (post-condition source) and **adds** optional `evaluatedFonts` (post-expression / on-screen at composition time) on the same before/after objects when readable — additive, not **BREAKING**.
- Clarify in specs and operator/skill docs: success means authored match; compare `fonts` vs `evaluatedFonts` to detect expression override; patch sources when the goal is visual change.
- Unit coverage for the pre-expression read path and `evaluatedFonts` evidence keys. No new MCP tools or input schema fields.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `ae-project-patch`: Require `set_text_style` mutation and post-conditions against pre-expression `TextDocument`; require dual font evidence (`fonts` + `evaluatedFonts` when readable); an active expression that still paints another font MUST NOT alone fail a target when authored fonts match the request.
- `ae-product-skill`: Document authored vs evaluated font evidence, and that visual font normalization with expression-linked layers should patch sources when `evaluatedFonts` still differ after an authored success.

## Impact

- Code: `src/patch/apply-script.ts`, `src/patch/types.ts`, parse/shaping if present; unit tests in `tests/patch.test.ts`.
- Docs: `docs/mcp-tools.md`, ADR 0003 (brief), `.ai/src/skills/drive-after-effects/SKILL.md` (+ synced product skill).
- Host: no new fixtures required; existing font e2e remains valid. Agents stop seeing false post-condition failures and can detect residual expression override from evidence.
