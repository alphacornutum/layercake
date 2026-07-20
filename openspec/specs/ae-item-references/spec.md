## Purpose

Expose a read-only MCP tool that returns known inbound references to a project item (`Item.id`), plus an incompleteness flag for cleanup planning (shared fact model with `safe_delete_project_item`).

## Requirements

### Requirement: Item references inspect tool

The MCP server MUST expose a read-only tool `ae_get_item_refs` that returns structured JSON describing known inbound references to one project item (`Item.id`) in the open After Effects project, plus whether the scan may be incomplete.

#### Scenario: Successful refs by item id

- **WHEN** the caller invokes `ae_get_item_refs` with a resolvable `itemId` and a project is open
- **THEN** the tool MUST succeed with JSON that identifies the item (`id`, `name`, and a type discriminator) and includes a `refs` array plus `unknownRefsPossible` (boolean)

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

#### Scenario: Missing item

- **WHEN** `itemId` does not resolve to a project item
- **THEN** the tool MUST fail with a clear not-found error

#### Scenario: Read-only

- **WHEN** `ae_get_item_refs` succeeds
- **THEN** the open project MUST NOT be modified solely as a result of the call

### Requirement: Known reference classes

The tool MUST include reference entries for classes it can determine from the After Effects DOM without mutating the project: compositions that list the item in `usedIn` (when applicable), timeline layers whose `source` is the item, proxy relationships (`useProxy` / proxy source item), parent-layer links, and track-matte links discovered by scanning compositions.

#### Scenario: usedIn and layer source

- **WHEN** a FootageItem or CompItem is used as a layer source in one or more compositions
- **THEN** `refs` MUST include entries that identify those compositions and layers (at least `kind`, `compId`, and `layerId` for layer-source refs; `kind` and `compId` for used-in-comp refs)

#### Scenario: Proxy relationship

- **WHEN** the target item is a proxy for another item, or has a proxy assigned
- **THEN** `refs` MUST include a proxy relationship entry with both item ids involved

#### Scenario: Parent and track matte

- **WHEN** a layer in some composition parents to or uses as track matte a layer whose source is the target item (or the target is otherwise linked via parent/matte to a layer under scan rules defined by implementation docs)
- **THEN** `refs` MUST include parent-link and/or track-matte entries with stable `compId` and layer ids

### Requirement: Incompleteness over false safety

When the tool cannot prove that all reference classes are covered (including when layers carry expressions that might name or id-reference the item and those mentions were not fully resolved), it MUST set `unknownRefsPossible` to true and SHOULD include human-readable `incompleteReasons`. The tool MUST NOT expose a `deletionCandidate` (or equivalent policy) boolean.

#### Scenario: Unknown refs flagged

- **WHEN** expressions or other unresolved reference classes prevent a complete inbound-ref proof
- **THEN** `unknownRefsPossible` MUST be true

#### Scenario: No deletion policy bit

- **WHEN** the refs payload is returned
- **THEN** it MUST NOT include a field that asserts the item is safe to delete as a product policy decision

### Requirement: Agent-facing tool documentation

The MCP tool description for `ae_get_item_refs` MUST state that results are facts for cleanup planning, that `unknownRefsPossible` means agents and `safe_delete_project_item` MUST refuse deletion, and that template reachability policy is out of scope.

#### Scenario: Description mentions incompleteness

- **WHEN** an agent reads the `ae_get_item_refs` tool description
- **THEN** it MUST be able to determine that incomplete scans block safe deletion
