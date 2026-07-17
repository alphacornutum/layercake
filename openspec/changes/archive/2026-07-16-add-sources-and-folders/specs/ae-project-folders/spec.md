## ADDED Requirements

### Requirement: Project folder tree tool

The MCP server MUST expose a read-only tool `ae_list_folders` that returns structured JSON describing the Project panel folder hierarchy of the open After Effects project.

#### Scenario: Hierarchical root tree

- **WHEN** the caller invokes `ae_list_folders` and a project is open
- **THEN** the tool MUST return a `root` object representing `app.project.rootFolder` with a nested `children` array

#### Scenario: Nested folders preserved

- **WHEN** the project contains folders inside folders
- **THEN** each folder node MUST include its own `children` array so nesting depth matches the Project panel

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

### Requirement: Stable folder and item identifiers in the tree

Every folder and item node in the tree MUST include After Effects’ native persistent `Item.id`.

#### Scenario: Folder id

- **WHEN** a folder node is listed
- **THEN** it MUST include `id` equal to that folder’s `Item.id` and `type` equal to `"folder"`

#### Scenario: Child item ids

- **WHEN** a non-folder child is listed
- **THEN** it MUST include `id` equal to that item’s `Item.id`

### Requirement: Compact child summaries

Non-folder children in the tree MUST be compact identity summaries, not full footage or composition inventories.

#### Scenario: Footage and composition leaves

- **WHEN** a child item is a `FootageItem` or `CompItem`
- **THEN** the node MUST include at least `id`, `name`, and `type` (`"footage"` or `"comp"`), and footage nodes MUST also include `footageKind` (`file` \| `solid` \| `placeholder`)

#### Scenario: No deep media metadata in the tree

- **WHEN** the folder tree is returned
- **THEN** footage leaves MUST NOT be required to include full media metadata such as `file`, `width`, or `usedInCompIds` (those belong to `ae_list_sources`)

### Requirement: Folder node shape

Folder nodes MUST expose name and children suitable for agent skimming.

#### Scenario: Folder fields

- **WHEN** a folder node is listed
- **THEN** it MUST include `id`, `name`, `type` (`"folder"`), and `children` (array, possibly empty)

#### Scenario: Root name fallback

- **WHEN** the root folder’s AE name is empty
- **THEN** the tool MUST still return a usable `name` (normalized to `"Root"`)

### Requirement: Agent-readable JSON result

The tool MUST return a single JSON object suitable for agent consumption (stringified in MCP text content consistent with other host tools).

#### Scenario: Top-level shape

- **WHEN** `ae_list_folders` runs successfully
- **THEN** the result MUST include `projectName` and `root`
