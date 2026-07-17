## Purpose

Safe open/close session transitions — refuse opening over any already-open project; explicit close policy; never prompt-blocking dialogs in agent paths.

## Requirements

### Requirement: Close project tool

The MCP server MUST expose `ae_close_project` that closes the open After Effects project using an explicit non-interactive policy. The tool MUST NOT use `CloseOptions.PROMPT_TO_SAVE_CHANGES` (or equivalent UI prompt) because prompts hang headless agents.

#### Scenario: Discard dirty project

- **WHEN** the caller invokes `ae_close_project` with `policy` `discard` and a project is open
- **THEN** the server MUST close via `CloseOptions.DO_NOT_SAVE_CHANGES` (or equivalent) and MUST NOT show a save prompt

#### Scenario: Save then close

- **WHEN** the caller invokes `ae_close_project` with `policy` `save` and the project has a savable path
- **THEN** the server MUST save changes and close without a blocking prompt

#### Scenario: Fingerprint guard on close

- **WHEN** the caller supplies an expected fingerprint that does not match the open project
- **THEN** close MUST refuse so agents cannot discard an unexpected live state

### Requirement: Open must not discard another project

`ae_open_project` MUST refuse to open a different project path whenever any project is already open, regardless of dirty state, unless the caller has first closed it through `ae_close_project` (or an equally explicit prior close). Opening MUST NOT rely on dismissing an “Unsaved Changes” dialog and MUST NOT auto-close the currently open project.

#### Scenario: Different project blocks open

- **WHEN** project A is open and the caller requests open of a different path B
- **THEN** open MUST fail with a structured error including A’s path, dirty state, and fingerprint, and MUST instruct the caller to save and/or `ae_close_project` first

#### Scenario: Same path already open

- **WHEN** the requested path is already the open project
- **THEN** open MUST succeed as a no-op (or equivalent) and MUST NOT discard in-memory changes

### Requirement: Single open project assumption

LayerCake session tools MUST assume After Effects has at most one open project document for targeting and guards.

#### Scenario: Context after open

- **WHEN** open succeeds
- **THEN** a subsequent `ae_project_context` MUST report the opened path (when saved) and a fingerprint for binding
