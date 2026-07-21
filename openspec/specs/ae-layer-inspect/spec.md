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

The tool MUST serialize common numeric/color/index property values to JSON, and MUST serialize `TEXT_DOCUMENT` values as the structured TextDocument style projection defined for this capability. When a property value (or keyframe value) cannot be represented faithfully (for example shape, or a text field AE will not yield), the tool MUST omit a fake value for that unsupported case and MUST mark unsupported non-text types with `unserializable: true` and include the `propertyValueType` (or equivalent type discriminator). The tool MUST NOT invent a partial incorrect structure pretending to be a complete raw TextDocument DOM dump.

#### Scenario: Unserializable non-text type is flagged

- **WHEN** an included property has a value type that the serializer does not support (for example shape)
- **THEN** that value slot MUST report `unserializable: true` and MUST NOT invent a partial incorrect structure pretending to be complete

#### Scenario: Text document is projected not flagged unserializable

- **WHEN** an included property has value type `TEXT_DOCUMENT` at `extended` or `full`
- **THEN** that value slot MUST use the style projection and MUST NOT report solely `unserializable: true`

### Requirement: TextDocument style projection on Source Text

On `detail` `extended` or `full`, when a included property’s value type is `TEXT_DOCUMENT` (Source Text / text document), `ae_get_layer` MUST serialize a structured projection instead of marking the value `unserializable`. The projection MUST expose the same allowlisted style fields used by `set_text_style` (readable subset) plus read-only `boxText` and `pointText` when readable, under a documented envelope (for example a tagged object that includes a `style` object). Fields that cannot be read MUST be omitted rather than invented. Shape and other still-unsupported value types MUST continue to use `unserializable: true`.

#### Scenario: SourceText style fields readable on extended

- **WHEN** the caller inspects a text layer at `detail: "extended"` and SourceText is included
- **THEN** the SourceText value slot MUST include a structured style projection with at least readable fields such as `font`, `fontSize`, and `autoLeading` when AE exposes them, and MUST NOT report only `unserializable: true` for that text document

#### Scenario: Shape remains unserializable

- **WHEN** an included property has value type shape (or another type still outside the serializer)
- **THEN** that value slot MUST still report `unserializable: true`

### Requirement: Dual authored and evaluated TextDocument samples

On `detail` `extended` or `full`, for SourceText / `TEXT_DOCUMENT` properties that have keyframes or a non-empty expression, `ae_get_layer` MUST include dual samples analogous to Transform: `authoredValue` from `valueAtTime(..., true)` and `evaluatedValue` from `valueAtTime(..., false)`, each as the TextDocument style projection. The primary `value` field MUST follow the caller’s `preExpression` flag. When the property has neither keys nor expression, a single projected sample MUST suffice.

#### Scenario: Dual text samples when expression present

- **WHEN** `detail` is `extended` or `full` and SourceText has a non-empty expression
- **THEN** the property node MUST include `authoredValue` and `evaluatedValue` as style projections and MUST set `value` according to `preExpression`

#### Scenario: Docs mention text dual samples

- **WHEN** an operator reads `docs/mcp-tools.md` (or the `ae_get_layer` tool description) after this change ships
- **THEN** the docs MUST state that SourceText is projected to style fields and that dual authored/evaluated samples apply when keys or expressions are present

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

### Requirement: Dual authored and evaluated transform samples

For `detail` values `extended` and `full`, when the property walk includes Transform properties that support `valueAtTime` (at least Scale; and Anchor Point, Position, Rotation/Orientation, and Opacity when included), the property node MUST expose dual samples when the property has an expression and/or keyframes: `authoredValue` from `valueAtTime(..., true)` (pre-expression) and `evaluatedValue` from `valueAtTime(..., false)` (post-expression) at the effective `atTime`. The existing `value` field MUST continue to reflect the caller’s `preExpression` flag (default `true`) so current clients remain valid. Operator documentation MUST state that authored/wrapper purity checks MUST use `authoredValue` (or `value` with `preExpression: true`), not post-expression samples alone.

#### Scenario: Scale with expression includes both samples

- **WHEN** `ae_get_layer` is called with `detail` `extended` or `full` and the layer’s Scale property has a non-empty expression
- **THEN** the Scale property node MUST include `authoredValue` and `evaluatedValue` at the effective `atTime`, and MUST still include `value` consistent with the request’s `preExpression`

#### Scenario: Default value remains pre-expression

- **WHEN** the caller omits `preExpression` (default true) with `extended` or `full`
- **THEN** `value` MUST match the pre-expression sample and MUST NOT silently switch to post-expression-only serialization

#### Scenario: Docs warn against treating evaluated as authored

- **WHEN** an operator reads `docs/mcp-tools.md` (or equivalent) for `ae_get_layer`
- **THEN** the docs MUST state that `authoredValue` is pre-expression authored state and `evaluatedValue` is post-expression, and that purity/normalization checks MUST not treat post-expression Scale as authored state
