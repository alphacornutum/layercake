## ADDED Requirements

### Requirement: Document ExtendScript dialect for ae_eval_script

The end-user product skill (`drive-after-effects`) MUST include a compact ExtendScript dialect reference file under its skill directory (for example `references/extendscript.md`) that is served as an MCP `skill://drive-after-effects/...` resource. The reference MUST state that After Effects evaluates an ES3-like dialect (not modern Node/browser JS), MUST list forbidden or unreliable patterns agents commonly use (`const`/`let`, arrow functions, template literals, optional chaining, trailing commas, ES5+ Array/Object helpers such as `map`/`filter`/`find`/`Object.assign`), MUST show preferred idioms (`var`, `function`, `for` loops, `JSON.stringify` via LayerCake’s polyfill), and MUST remind agents to `return` a value and avoid modal dialogs. The skill entrypoint (`SKILL.md`) MUST point agents to that reference when using `ae_eval_script`. The project MUST continue to ship exactly one end-user product skill named `drive-after-effects` (the reference is an additional file, not a second skill).

#### Scenario: Reference file is readable via MCP

- **WHEN** a caller lists or reads product skill resources and the skill directory is available
- **THEN** the ExtendScript dialect reference MUST be available under a `skill://drive-after-effects/` URI

#### Scenario: Entrypoint links the dialect reference

- **WHEN** an agent reads `skills/drive-after-effects/SKILL.md` (or `skill://drive-after-effects/SKILL.md`)
- **THEN** the skill body MUST direct agents to the ExtendScript dialect reference in the context of `ae_eval_script`
