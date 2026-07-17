## Purpose

Expose a read-only MCP tool to inspect one layer’s property tree in an open After Effects composition, with detail tiers, id-or-name lookup, and a hard size limit for agent-usable JSON.

## Requirements

### Requirement: Layer inspect tool

The MCP server MUST expose a read-only tool `ae_get_layer` that returns structured JSON describing one layer in one composition of the open After Effects project, including a walk of that layer’s property tree according to the requested detail level.

#### Scenario: Successful inspect by ids

- **WHEN** the caller invokes `ae_get_layer` with a resolvable `compId` and `layerId` and a project is open
- **THEN** the tool MUST succeed with JSON that identifies the composition and layer (including stable `comp.id` / `layer.id`) and includes a property-tree payload shaped by `detail`

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

### Requirement: Comp and layer lookup by id or name

The tool MUST accept exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName`). Name matches MUST be case-sensitive exact matches against the live project.

#### Scenario: Reject missing or duplicate selectors

- **WHEN** the caller omits both composition selectors, supplies both, omits both layer selectors, or supplies both layer selectors
- **THEN** the tool MUST fail with a clear validation error

#### Scenario: Ambiguous composition name

- **WHEN** `compName` matches more than one composition
- **THEN** the tool MUST fail and MUST include a candidate list of matching compositions with at least `id` and `name` for each

#### Scenario: Ambiguous layer name

- **WHEN** the composition resolves uniquely but `layerName` matches more than one layer in that composition
- **THEN** the tool MUST fail and MUST include a candidate list of matching layers with at least `id`, `index`, and `name` for each

#### Scenario: Not found

- **WHEN** the composition or layer selector matches nothing
- **THEN** the tool MUST fail with a clear not-found error (not a soft success payload)

### Requirement: Detail tiers and property selectors

The tool MUST accept `detail` with allowed values `overview`, `extended`, and `full`, defaulting to `overview`. The tool MUST accept optional `matchNames` (array of strings) that scopes the property walk to PropertyBase nodes whose `matchName` exactly matches an entry (including descendants of matched groups). Selectors MUST compose with `detail`.

#### Scenario: Default overview is lean

- **WHEN** the caller omits `detail`
- **THEN** the tool MUST behave as `detail: "overview"`: property nodes include identity/skeleton fields and animation flags/counts (`numKeys`, `hasExpression`, `expressionEnabled` as applicable) and MUST NOT include expression body text, keyframe arrays, or sampled property values

#### Scenario: Extended includes expressions and key times/values

- **WHEN** `detail` is `extended`
- **THEN** for included properties the payload MUST include sampled value metadata, the full `expression` string when an expression is present, `expressionEnabled` when applicable, and keyframe entries with at least `time` and serialized `value` for each key

#### Scenario: Full includes richer keyframe metadata

- **WHEN** `detail` is `full`
- **THEN** the payload MUST include everything required for `extended` and MUST include keyframe ease and spatial tangent data when the After Effects DOM exposes them for that property

#### Scenario: matchNames scopes the walk

- **WHEN** the caller provides `matchNames`
- **THEN** the property-tree payload MUST only include matched nodes and their descendants (plus whatever layer-level identity fields the tool always returns)

### Requirement: Value sampling time and preExpression

The tool MUST accept optional `atTime` (composition seconds) defaulting to the composition’s current time (`comp.time`), and optional `preExpression` defaulting to `true`. The result MUST echo the `atTime` and `preExpression` used. For `extended` and `full`, sampled values MUST use After Effects `valueAtTime` semantics consistent with `preExpression` when applicable.

#### Scenario: Defaults

- **WHEN** the caller omits `atTime` and `preExpression` and requests `extended` or `full`
- **THEN** sampling MUST use the composition CTI and `preExpression: true`, and the result MUST echo those values

#### Scenario: Explicit post-expression sample

- **WHEN** the caller sets `preExpression` to `false` with `extended` or `full`
- **THEN** sampled values MUST reflect post-expression evaluation at the effective `atTime`

### Requirement: Best-effort property value serialization

The tool MUST serialize common numeric/color/index property values to JSON. When a property value (or keyframe value) cannot be represented faithfully in v1, the tool MUST omit a fake value and MUST mark that value with `unserializable: true` and include the `propertyValueType` (or equivalent type discriminator).

#### Scenario: Unserializable type is flagged

- **WHEN** a included property has a value type that the serializer does not support (for example shape or text document)
- **THEN** that value slot MUST report `unserializable: true` and MUST NOT invent a partial incorrect structure pretending to be complete

### Requirement: Agent-facing tool documentation

The MCP tool description for `ae_get_layer` MUST document depth tiers, that full expression text and keyframe timelines require `extended` or `full` (or selectors under those tiers), `atTime` / `preExpression` defaults, id-or-name lookup with ambiguity errors, the `unserializable` policy, and that over-limit results are hard errors (narrow with leaner `detail` / `matchNames`).

#### Scenario: Description mentions how to get expressions

- **WHEN** an agent reads the `ae_get_layer` tool description
- **THEN** it MUST be able to determine that `overview` does not return expression bodies and that `extended` or `full` does

### Requirement: Inspect result size limit

The tool MUST refuse to return a success payload whose UTF-8 JSON text exceeds the configured inspect size limit. The default limit MUST be 512 KiB (524288 bytes). The limit MUST be overridable via the `AE_INSPECT_MAX_BYTES` environment variable (positive integer). Over-limit responses MUST be hard errors that include the actual size, the limit, and guidance to narrow with a leaner `detail` and/or `matchNames`. The tool MUST NOT silently truncate the payload to fit.

#### Scenario: Over-limit hard error

- **WHEN** a successful inspect would stringify to more bytes than the configured limit
- **THEN** the tool MUST fail with a clear error that reports size and limit and MUST NOT return a truncated success JSON body

#### Scenario: Default limit

- **WHEN** `AE_INSPECT_MAX_BYTES` is unset
- **THEN** the effective limit MUST be 524288 bytes

### Requirement: Agent-readable JSON result

The tool MUST return a single JSON object suitable for agent consumption (stringified in MCP text content consistent with other host tools).

#### Scenario: Top-level echo fields

- **WHEN** `ae_get_layer` runs successfully
- **THEN** the result MUST include the resolved composition and layer identity, the effective `detail`, `atTime`, and `preExpression`, and the property-tree payload
