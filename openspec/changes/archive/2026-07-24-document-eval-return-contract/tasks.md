## 1. Operator docs

- [x] 1.1 Update `docs/mcp-tools.md` `ae_eval_script` section: top-level `return` for payloads; empty success for void scripts; bare-IIFE footgun + `return (function…)` fix; no LayerCake eval result size limit (contrast inspect `AE_INSPECT_MAX_BYTES` briefly)
- [x] 1.2 Update `docs/troubleshooting.md`: map “empty MCP success + dirty project / side effects ran” to missing top-level `return`; keep distinct from missing result-file / scripting-preferences failures

## 2. Product skill

- [x] 2.1 Expand `.ai/src/skills/drive-after-effects/references/extendscript.md` with the return completion contract, void-script empty success, bare-IIFE good/bad examples, and no eval size limit
- [x] 2.2 If `SKILL.md` only says “return a value”, add a brief pointer to the reference’s return-contract / IIFE note (keep SKILL lean)
- [x] 2.3 Run `agentsync sync` so generated skill outputs match `.ai/src/`

## 3. Optional tool description

- [x] 3.1 Optionally add one short sentence to the `ae_eval_script` tool description in `src/server.ts` about top-level `return` vs empty success for void scripts (behavior unchanged)

## 4. Spec sync readiness

- [x] 4.1 Confirm delta specs match the shipped docs/skill wording (no wrap/protocol/runtime changes)
- [x] 4.2 Note in apply summary that OpenSpec sync/archive can land the deltas into `openspec/specs/` and that `ARCHITECTURE.md` needs no edit for this docs-only change
