## Purpose

Expose a read-only MCP inventory of project footage sources (`FootageItem`s) with stable `Item.id` handles, media metadata, and folder placement.

## Requirements

### Requirement: Project sources inventory tool

The MCP server MUST expose a read-only tool `ae_list_sources` that returns structured JSON describing every `FootageItem` in the open After Effects project.

#### Scenario: Inventory all footage sources

- **WHEN** the caller invokes `ae_list_sources` and a project is open
- **THEN** the tool MUST return a `sources` array containing one entry for each `FootageItem` in the project

#### Scenario: Empty footage set

- **WHEN** the open project contains no `FootageItem`s
- **THEN** the tool MUST succeed with an empty `sources` array

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

### Requirement: Stable source identifiers

Each listed source MUST include After Effects’ native persistent item id so agents can re-find the same footage after rename or folder moves within the same project file.

#### Scenario: Source id is AE Item.id

- **WHEN** a source is listed
- **THEN** the payload MUST include `id` equal to that footage item’s `Item.id` (integer)

#### Scenario: Ids survive rename and move

- **WHEN** a footage item is renamed or moved to another project folder and sources are listed again
- **THEN** that item’s `id` MUST be unchanged

### Requirement: Source metadata coverage

Each listed source MUST include identity and media metadata read from the live session: `name`, `label`, `comment`, `footageKind`, `width`, `height`, `pixelAspect`, `frameRate`, `duration`, `hasVideo`, `hasAudio`, `footageMissing`, `isStill`, `useProxy`, `file`, `missingFootagePath`, `solidColor`, and `usedInCompIds`.

#### Scenario: Footage kind classification

- **WHEN** a source is listed
- **THEN** `footageKind` MUST be one of `file`, `solid`, or `placeholder`, derived from the item’s `mainSource` type (not from localized `typeName`)

#### Scenario: File and missing paths

- **WHEN** a file-based source is listed
- **THEN** `file` MUST be the absolute filesystem path when available, `footageMissing` MUST reflect whether the footage is missing, and `missingFootagePath` MUST carry the missing path string when AE provides one (otherwise null)

#### Scenario: Solid color

- **WHEN** a solid source is listed
- **THEN** `solidColor` MUST be an `[R, G, B]` array in `0.0`–`1.0` and `file` MUST be null

#### Scenario: Used-in compositions

- **WHEN** a source is listed
- **THEN** `usedInCompIds` MUST be an array of composition `Item.id` values from `AVItem.usedIn` (empty if unused)

### Requirement: Folder placement on sources

Each listed source MUST include its Project panel folder location so agents can relate footage to project organization without a separate lookup.

#### Scenario: Parent folder id and path

- **WHEN** a source is listed
- **THEN** the payload MUST include `parentFolderId` equal to `parentFolder.id` and `folderPath` as a `/`-joined chain of folder names from the project root to the parent folder (empty string when the item is directly under the root folder)

### Requirement: Agent-readable JSON result

The tool MUST return a single JSON object suitable for agent consumption (stringified in MCP text content consistent with other host tools).

#### Scenario: Top-level shape

- **WHEN** `ae_list_sources` runs successfully
- **THEN** the result MUST include `projectName` and `sources`
