## Why

Agents (and caller scripts) misread empty `ae_eval_script` success as a host size/truncation bug. LayerCake wraps user source in an IIFE and returns that body’s completion value; `undefined`/`null` become an empty success string while side effects still run. A bare IIFE with an _inner_ `return` (common for pasteable measure scripts) therefore yields MCP success with an empty body. Document the return contract now so agents use a top-level `return` when they care about the payload, treat empty success as normal for void scripts, and stop inventing `/tmp` workarounds for multi‑KB JSON that the result channel already supports.

## What Changes

- Document that `ae_eval_script` has **no** LayerCake-imposed result size limit (contrast with inspect’s `AE_INSPECT_MAX_BYTES` fail-closed gate).
- Document the wrap completion-value contract: top-level `return` is required when the caller wants a payload; `undefined`/`null` map to empty success text; void / side-effect-only scripts remaining empty is intentional.
- Call out the **bare IIFE footgun**: `(function () { …; return value; })();` discards the inner return under the wrap; use `return (function () { …; return value; })();` (or an equivalent top-level `return`).
- Update operator docs (`docs/mcp-tools.md`, `docs/troubleshooting.md`) and the product skill ExtendScript reference accordingly.
- **No** runtime/preflight changes, schema changes, or result-file protocol changes in this change.

## Capabilities

### New Capabilities

<!-- none — docs/contract clarification only -->

### Modified Capabilities

- `extendscript-execution`: Add documentation requirements for the eval return-value / wrap completion contract (including no eval size limit and empty success for void scripts).
- `ae-product-skill`: Require the drive-after-effects ExtendScript reference (and SKILL entrypoint as needed) to teach top-level `return` vs bare-IIFE discard so agents do not treat empty success as truncation.

## Impact

- Specs: `openspec/specs/extendscript-execution/spec.md`, `openspec/specs/ae-product-skill/spec.md` (via deltas).
- Docs: `docs/mcp-tools.md`, `docs/troubleshooting.md`.
- Agent guidance: `.ai/src/skills/drive-after-effects/references/extendscript.md` (and `SKILL.md` pointer if needed), then `agentsync sync`.
- Tool description text in `src/server.ts` for `ae_eval_script` MAY gain a short return-contract sentence (docs-facing only; behavior unchanged).
- No host bridge, wrap protocol, or MCP schema changes; no `ARCHITECTURE.md` layer changes expected.
