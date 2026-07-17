## Purpose

Declarative apply-only mutation tool with typed ops (`set_text_style`), fingerprint guards, undo grouping, and structured before/after evidence.

## Requirements

### Requirement: Patch project tool

The MCP server MUST expose `ae_patch_project` that applies declarative, typed mutations against the currently open After Effects project without persisting to disk. The tool applies operations directly; it MUST NOT expose a preview/dry-run mode or issue stateful plan tokens in this capability.

#### Scenario: Direct apply with fingerprint guard

- **WHEN** the caller invokes `ae_patch_project` with a matching `project.path` and `project.fingerprint` and a non-empty typed `operations` array
- **THEN** the server MUST validate every operation before mutating, execute the batch inside one named undo group when mutation is required, leave the project unsaved solely due to this tool, and return structured per-operation results plus the new fingerprint

#### Scenario: Stale fingerprint refused

- **WHEN** apply is requested with a fingerprint that does not match the open project
- **THEN** the tool MUST refuse mutation, return a structured stale error, and include or point to current context fields so the agent can recover by re-reading context

#### Scenario: Path mismatch refused

- **WHEN** the requested `project.path` does not match the open project path
- **THEN** the tool MUST refuse without opening or switching projects

#### Scenario: No implicit save

- **WHEN** patch apply completes
- **THEN** the tool MUST NOT save the project to disk as a side effect (an optional backup-before-apply MUST use `ae_save_project` `create_backup`, not `save_current`)

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The initial vocabulary MUST include `set_text_style`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

#### Scenario: Unknown operation rejected

- **WHEN** an operation uses an unsupported `op` name
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: set_text_style applies exact font string

- **WHEN** a `set_text_style` operation specifies `style.font` as a string
- **THEN** LayerCake MUST set that exact string on the targeted TextDocument/CharacterRange font field(s) via ExtendScript without synonym mapping

#### Scenario: set_text_style preserves unspecified attributes

- **WHEN** `preserveUnspecified` is true (default) and only `font` is provided
- **THEN** apply MUST NOT intentionally change unspecified text attributes such as size, fill, stroke, tracking, or text content

### Requirement: Idempotent desired-state ops

Desired-state operations MUST return `already_satisfied` for targets that already match the requested end state without performing a no-op write that changes revision unnecessarily when detectable.

#### Scenario: Repeat Arial patch

- **WHEN** the same successful `set_text_style` font normalization is applied again with a matching fingerprint
- **THEN** each already-normalized target MUST report `already_satisfied` (or equivalent) and MUST NOT be reported as newly `changed`

### Requirement: Broad selector gate

Discovery scopes MUST use explicit enums/id lists (not regex). When a broad scope resolves more targets than a built-in default maximum, apply MUST require an explicit `allowBroadTargetSet` flag or fail closed.

#### Scenario: Broad set requires acknowledgment

- **WHEN** a selector resolves more targets than the built-in default maximum and `allowBroadTargetSet` is not true
- **THEN** the tool MUST refuse before mutation and report the resolved count

### Requirement: Rollback reporting

Apply MUST validate all operations before mutating and run the batch in one undo group. On an unexpected failure after mutation has begun, the server MUST stop further ops, attempt a best-effort undo of the group, and report whether the rollback completed.

#### Scenario: Failure mid-batch

- **WHEN** an operation fails after earlier operations in the same apply batch mutated the project
- **THEN** the response MUST NOT claim overall success and MUST report whether the undo-group rollback completed

### Requirement: Arial normalization acceptance

Given an open project with text layers (including nested comps and mixed visibility flags supported by selectors), agents MUST be able to apply a typed `set_text_style` batch that sets authored/default fonts to a caller-provided font string and MUST receive structured per-target before/after evidence, then leave persistence to `ae_save_project`.

#### Scenario: End-to-end Arial path without eval

- **WHEN** an agent uses context + `ae_patch_project` + save (not `ae_eval_script`) for font normalization on the host test fixture
- **THEN** the apply response MUST report each target as `changed` (with before/after font) or `already_satisfied`, the project MUST remain dirty until save, `ae_project_context` MUST report an advanced revision after a mutating apply, and unsupported/uninspectable runs MUST be reported explicitly rather than silently omitted as success
