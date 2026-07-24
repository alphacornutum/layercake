## ADDED Requirements

### Requirement: Document ae_eval_script return completion contract

Operator-facing documentation for `ae_eval_script` MUST state that LayerCake wraps caller source and returns that body’s **completion value** as the MCP text result (via the existing OK/ERR result-file protocol). The docs MUST state that a top-level `return` is required when the caller wants a non-empty payload; that `undefined`/`null` completion values are returned as successful empty text; and that empty success is intentional for void / side-effect-only scripts. The docs MUST warn that a bare top-level IIFE whose only `return` is _inside_ the IIFE discards that value under the wrap (side effects may still run and dirty the project), and MUST show the fix pattern `return (function () { …; return value; })();` (or an equivalent top-level `return`). The docs MUST state that LayerCake does **not** impose a result size limit on `ae_eval_script` success payloads (distinct from the inspect-tool `AE_INSPECT_MAX_BYTES` fail-closed gate). Troubleshooting guidance MUST map the symptom “MCP success with empty body while the project became dirty / side effects ran” to a missing top-level `return`, not to truncation.

#### Scenario: mcp-tools documents return vs void vs IIFE

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `ae_eval_script`
- **THEN** the page MUST document top-level `return` for payloads, empty success for void scripts, the bare-IIFE footgun with the `return (function…)` fix, and that eval has no LayerCake result size limit

#### Scenario: troubleshooting maps empty success to missing return

- **WHEN** an operator or agent reads `docs/troubleshooting.md` for empty or missing eval results
- **THEN** the page MUST distinguish missing result-file / scripting preferences from empty success caused by a missing top-level `return` after the script ran
