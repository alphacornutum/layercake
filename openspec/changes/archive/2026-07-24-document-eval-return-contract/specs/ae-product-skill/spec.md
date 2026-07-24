## ADDED Requirements

### Requirement: Document ae_eval_script wrap return contract in ExtendScript reference

The product skill’s ExtendScript dialect reference (`references/extendscript.md`, served under `skill://drive-after-effects/…`) MUST document LayerCake’s wrap completion-value contract for `ae_eval_script`: prefer a top-level `return` when a payload is needed; empty success is normal when the script intentionally returns nothing (void / side-effect-only); a bare `(function () { …; return value; })();` discards the inner return under the wrap and MUST be written as `return (function () { …; return value; })();` (or equivalent top-level `return`) when the value matters. The reference MUST state that LayerCake does not impose an `ae_eval_script` result size limit. The skill entrypoint MAY briefly point at this return-contract guidance when discussing `ae_eval_script`.

#### Scenario: Reference teaches top-level return vs bare IIFE

- **WHEN** an agent reads `skill://drive-after-effects/references/extendscript.md` (or the synced skill file)
- **THEN** the reference MUST show preferred top-level `return`, MUST note empty success for void scripts, and MUST include the bare-IIFE discard footgun with the `return (function…)` fix

#### Scenario: Reference denies eval size-limit myth

- **WHEN** an agent reads the ExtendScript dialect reference for result-size guidance
- **THEN** the reference MUST state that `ae_eval_script` has no LayerCake-imposed result size limit
