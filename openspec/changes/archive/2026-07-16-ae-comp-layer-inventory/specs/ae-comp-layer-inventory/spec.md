## ADDED Requirements

### Requirement: Composition and layer inventory tool

The MCP server MUST expose a read-only tool `ae_list_comps` that returns structured JSON describing compositions and their layers in the open After Effects project.

#### Scenario: Inventory all compositions

- **WHEN** the caller invokes `ae_list_comps` with no composition filter and a project is open
- **THEN** the tool MUST return every `CompItem` in the project, each with a `layers` array covering all layers in that composition

#### Scenario: Filter by composition id

- **WHEN** the caller provides `compIds` containing one or more composition item ids
- **THEN** the tool MUST return only compositions whose stable item id is in that list

#### Scenario: Filter by composition name

- **WHEN** the caller provides `compNames` containing one or more composition names
- **THEN** the tool MUST return only compositions whose name exactly matches an entry in that list

#### Scenario: Combined filters use union

- **WHEN** the caller provides both `compIds` and `compNames`
- **THEN** the tool MUST include a composition if it matches either filter

#### Scenario: Unmatched filter entries are reported

- **WHEN** a provided `compId` or `compName` does not match any composition
- **THEN** the tool MUST still succeed and MUST list that id or name under a `missing` field

#### Scenario: Empty project

- **WHEN** the open project contains no compositions
- **THEN** the tool MUST succeed with an empty `compositions` array

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

### Requirement: Stable layer and composition identifiers

Each composition and layer in the inventory MUST include After Effects’ native persistent id so agents can re-find the same object after reorder or rename within the same project file.

#### Scenario: Layer id is AE Layer.id

- **WHEN** a layer is listed
- **THEN** the payload MUST include `id` equal to that layer’s `Layer.id` (integer)

#### Scenario: Composition id is AE Item.id

- **WHEN** a composition is listed
- **THEN** the payload MUST include `id` equal to that composition’s `Item.id` (integer)

#### Scenario: Stack index is included but ephemeral

- **WHEN** a layer is listed
- **THEN** the payload MUST include the current 1-based `index` for convenience, and the tool description MUST state that `id` is the stable handle while `index` may change when layers are reordered

#### Scenario: Ids survive reorder

- **WHEN** a layer is moved to a different stack position and inventory is requested again
- **THEN** that layer’s `id` MUST be unchanged while `index` MAY differ

### Requirement: Layer attribute coverage

Each listed layer MUST include the following fields with values read from the live After Effects session: `name`, `type`, `inPoint`, `outPoint`, `duration`, `stretch`, `motionBlur`, `label`, and `hasEffects`.

#### Scenario: Timing and stretch

- **WHEN** a layer is listed
- **THEN** `inPoint` and `outPoint` MUST be the layer’s composition-time in/out points in seconds, `duration` MUST equal `outPoint - inPoint`, and `stretch` MUST be the layer’s stretch percentage

#### Scenario: Motion blur and label color

- **WHEN** a layer is listed
- **THEN** `motionBlur` MUST reflect whether the layer motion-blur switch is on (`false` when the attribute does not apply), and `label` MUST be the layer’s UI label color index (`0`–`16`)

#### Scenario: Effects presence

- **WHEN** a layer is listed
- **THEN** `hasEffects` MUST be `true` if the layer’s Effects property group contains one or more effects, otherwise `false`

#### Scenario: Layer type classification

- **WHEN** a layer is listed
- **THEN** `type` MUST be a lowercase classifier distinguishing at least camera, light, text, shape, null, adjustment, guide, and generic AV layers, with an `other` fallback for unrecognized kinds

### Requirement: Folded state out of scope

The inventory tool MUST NOT claim to report timeline fold/twirl (“folded”) state, because After Effects scripting does not expose that UI state.

#### Scenario: No folded field

- **WHEN** the inventory payload is returned
- **THEN** it MUST NOT include a `folded` (or equivalent) field that pretends to represent timeline twirl state

### Requirement: Agent-readable JSON result

The tool MUST return a JSON object suitable for agent consumption, including project identity context and the nested compositions/layers structure defined by this capability.

#### Scenario: Nested compositions and layers

- **WHEN** inventory succeeds
- **THEN** the result MUST be JSON with a `compositions` array where each composition object contains a `layers` array of layer objects

#### Scenario: Read-only operation

- **WHEN** `ae_list_comps` runs successfully
- **THEN** the open project MUST NOT be modified solely as a result of the inventory call
