## Purpose

Cheap read-only bind token for the open After Effects project (`path`, `dirty`, fingerprint, AE version) for frequent agent polling — distinct from heavy `ae_project_summary`.

## Requirements

### Requirement: Lean project context tool

The MCP server MUST expose a read-only tool `ae_project_context` that returns a small JSON bind token for the open After Effects project. The tool MUST be suitable for frequent polling and MUST NOT perform effect/font/footage health walks belonging to `ae_project_summary`.

#### Scenario: Successful context

- **WHEN** the caller invokes `ae_project_context` and a project is open
- **THEN** the tool MUST return JSON including at least `projectPath` (absolute path or `null` if unsaved), `projectName`, `dirty` (boolean; `app.project.dirty` is available on the AE 17.5+ baseline LayerCake already requires), `revision` (integer from `app.project.revision`), `fingerprint` (string composite of revision, dirty, and path), and `aeVersion`

#### Scenario: No project open

- **WHEN** no project is open
- **THEN** the tool MUST fail with a clear error instructing the caller to open a project first

#### Scenario: Read-only and cheap

- **WHEN** `ae_project_context` succeeds
- **THEN** the open project MUST NOT be modified solely as a result of the call, and the response MUST NOT include effect dependency audits or missing-footage rollups

### Requirement: Dirty-state warning for agents

When `dirty` is true, `ae_project_context` MUST include a machine-readable warning that the live project may differ from the last saved file on disk.

#### Scenario: Unsaved changes flagged

- **WHEN** context succeeds and the project is dirty
- **THEN** the response MUST include a warning field or equivalent structured signal indicating unsaved live state

### Requirement: Distinct from project summary

Operator docs and tool descriptions MUST state that `ae_project_context` is the cheap bind/poll tool and `ae_project_summary` is the heavier health/portability passport.

#### Scenario: Tool description distinguishes use cases

- **WHEN** an agent reads the `ae_project_context` tool description
- **THEN** the description MUST tell agents to prefer context for fingerprint binding and summary for dependency/health orientation
