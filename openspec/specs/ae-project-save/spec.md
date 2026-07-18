## Purpose

Explicit persistence tool (`save_copy`, `create_backup`) with fingerprint preconditions and overwrite protection. No implicit save from patch/context/open.

## Requirements

### Requirement: Explicit save tool

The MCP server MUST expose `ae_save_project` as the only tool that persists the live After Effects project to disk. Query, context, patch, inventory, and eval tools MUST NOT implicitly save as part of their normal success path. In this capability the tool MUST support `save_copy` and `create_backup` only; overwriting the active project file in place (`save_current`) is out of scope for this change.

#### Scenario: save_copy preferred path

- **WHEN** the caller invokes `ae_save_project` with `mode` `save_copy`, an absolute destination path, and a matching `expectedProjectFingerprint`
- **THEN** the server MUST write a project file to that path without requiring overwrite of the active project path, and MUST return the written path, whether the active AE project path changed, and the post-save fingerprint/dirty state

#### Scenario: Overwrite protection

- **WHEN** `save_copy` targets an existing filesystem path and `allowOverwrite` is not true
- **THEN** the tool MUST refuse without writing

#### Scenario: create_backup

- **WHEN** the caller invokes `mode` `create_backup`
- **THEN** the server MUST write a backup under `AE_ARTIFACT_DIR` or a caller-provided path, MUST NOT switch the active project to that backup unless explicitly documented otherwise, and MUST return the backup path

#### Scenario: create_backup copies project file only

- **WHEN** the caller invokes `mode` `create_backup` on a clean, saved project
- **THEN** the server MUST copy the open project file (`.aep` / `.aepx`) only — it MUST NOT collect, copy, or rewrite linked footage/media (not AE Collect Files). Operator and tool docs MUST state that opening the backup from a new location can report missing footage when file sources use relative paths that no longer resolve.

#### Scenario: Fingerprint precondition

- **WHEN** the provided expected fingerprint does not match the open project
- **THEN** the tool MUST refuse to save and return a structured stale error
