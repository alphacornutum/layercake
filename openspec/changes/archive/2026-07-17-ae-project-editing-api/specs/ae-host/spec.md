## MODIFIED Requirements

### Requirement: Open a local AEP project

The server MUST provide an operation to open a local `.aep` project file in the active After Effects session using an absolute filesystem path. Opening MUST be a session transition only: it MUST NOT be performed as a side effect of patch, save, context, or inventory tools. If another project is already open and the requested path differs, open MUST refuse (regardless of dirty state) rather than prompting the user, auto-closing, or silently discarding changes (see `ae-project-session`).

#### Scenario: Open valid project

- **WHEN** the caller provides an absolute path to an existing `.aep` file, the host session is available, and no other project is open
- **THEN** After Effects MUST open that project and the operation MUST report success

#### Scenario: Project path missing

- **WHEN** the caller provides a path that does not exist
- **THEN** the operation MUST fail without attempting a silent fallback project

#### Scenario: Invalid project type

- **WHEN** the caller provides a path that is not an After Effects project file
- **THEN** the operation MUST fail with an error indicating the path is not a valid project

#### Scenario: Open project blocks conflicting open

- **WHEN** any project is open and the caller requests a different path
- **THEN** open MUST fail without showing a save dialog and without discarding or auto-closing the open project

## ADDED Requirements

### Requirement: Artifact directory configuration

The server MUST accept an optional absolute `AE_ARTIFACT_DIR` configuration used for backups and other LayerCake-generated artifacts. When unset, the server MUST use a process-scoped temporary directory and document the choice in operator docs.

#### Scenario: Configured artifact dir

- **WHEN** `AE_ARTIFACT_DIR` is set to a writable absolute path
- **THEN** backup and artifact helpers MUST write under that directory by default
