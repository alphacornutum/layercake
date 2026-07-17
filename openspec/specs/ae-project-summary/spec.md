## Purpose

Expose a read-only MCP project passport for the open After Effects project: identity, orientation counts, effect dependency audit (first-party vs third-party), missing footage rollup, and missing/substituted fonts.

## Requirements

### Requirement: Project summary tool

The MCP server MUST expose a read-only tool `ae_project_summary` that returns structured JSON summarizing the open After Effects project for agent orientation and dependency/health checks.

#### Scenario: Successful summary

- **WHEN** the caller invokes `ae_project_summary` and a project is open
- **THEN** the tool MUST return a JSON object including project identity, orientation counts, effect dependency audit, missing-footage rollup, font status, and the cheap project settings defined by this capability

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

#### Scenario: Read-only operation

- **WHEN** `ae_project_summary` runs successfully
- **THEN** the open project MUST NOT be modified solely as a result of the summary call

### Requirement: Project identity

The summary MUST identify the open project and the host After Effects version.

#### Scenario: Name and path

- **WHEN** summary succeeds
- **THEN** the result MUST include `projectName` and `projectPath`, where `projectPath` is the absolute filesystem path when the project is saved and `null` when unsaved

#### Scenario: AE version

- **WHEN** summary succeeds
- **THEN** the result MUST include `aeVersion` equal to the host `app.version` string

### Requirement: Orientation counts

The summary MUST include counts that help agents size the project before calling list tools.

#### Scenario: Core counts present

- **WHEN** summary succeeds
- **THEN** the result MUST include integer fields `numComps`, `numFootage`, `numFolders`, and `numLayers` reflecting compositions, `FootageItem`s, folder items (excluding the root folder from the folder count or documenting inclusion consistently), and total layers across all compositions respectively

### Requirement: Cheap project settings

The summary MUST include a small set of project settings useful for orientation without duplicating full Project Settings UI.

#### Scenario: Bits and time display

- **WHEN** summary succeeds
- **THEN** the result MUST include `bitsPerChannel` and `timeDisplayType` read from the open project

### Requirement: Effect dependency audit

The summary MUST audit every effect instance on every layer in every composition, aggregate by effect `matchName`, and classify each unique effect as first-party or third-party.

#### Scenario: Unique effects listed

- **WHEN** the project contains one or more effect instances
- **THEN** the result MUST include an `effects` array with one entry per distinct effect `matchName`, each with `matchName`, `displayName`, `origin` (`firstParty` or `thirdParty`), `available` (boolean), and `instanceCount`

#### Scenario: Empty effects

- **WHEN** no layer in the project has any effects
- **THEN** `effects` MUST be an empty array and `hasThirdPartyEffects` MUST be `false`

#### Scenario: Third-party boolean

- **WHEN** at least one unique used effect has `origin` `thirdParty`
- **THEN** `hasThirdPartyEffects` MUST be `true`; otherwise it MUST be `false`

#### Scenario: Availability against installed plugins

- **WHEN** an effect’s `matchName` is present in `app.effects`
- **THEN** that effect entry’s `available` MUST be `true`; otherwise `available` MUST be `false`

### Requirement: First-party effect classification

First-party classification MUST use an allowlist of match names derived from the vendored After Effects Scripting Guide first-party effects corpus (`matchnames/effects/firstparty.md` or a generated artifact extracted from it). Match names not on the allowlist MUST be classified as `thirdParty`. Classification MUST NOT rely solely on an `ADBE` prefix heuristic.

#### Scenario: Stock non-ADBE effect is first-party

- **WHEN** a used effect’s `matchName` appears in the first-party allowlist (including non-`ADBE` stock names such as bundled `CC` effects when listed)
- **THEN** its `origin` MUST be `firstParty`

#### Scenario: Unknown matchName is third-party

- **WHEN** a used effect’s `matchName` is not in the first-party allowlist
- **THEN** its `origin` MUST be `thirdParty`

### Requirement: Missing footage rollup

The summary MUST roll up footage items that are missing without requiring a separate `ae_list_sources` call for the boolean/count question.

#### Scenario: Missing footage entries

- **WHEN** one or more `FootageItem`s report missing footage
- **THEN** the result MUST include `missingFootageCount` equal to that number and a `missingFootage` array of compact objects each with at least `id`, `name`, and `missingFootagePath` (null when unavailable)

#### Scenario: No missing footage

- **WHEN** no footage is missing
- **THEN** `missingFootageCount` MUST be `0` and `missingFootage` MUST be an empty array

### Requirement: Missing or substituted fonts

The summary MUST report missing or substituted fonts when the After Effects Fonts API is available, and MUST soft-fail when it is not.

#### Scenario: Fonts API available

- **WHEN** `app.fonts.missingOrSubstitutedFonts` is available
- **THEN** `fontsApiAvailable` MUST be `true` and `missingOrSubstitutedFonts` MUST be an array of font identity strings suitable for agents (at least a stable name or postscript name per entry)

#### Scenario: Fonts API unavailable

- **WHEN** the Fonts API is missing or throws
- **THEN** the summary MUST still succeed with `fontsApiAvailable` `false` and an empty `missingOrSubstitutedFonts` array
