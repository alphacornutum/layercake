## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Best-effort property value serialization

The tool MUST serialize common numeric/color/index property values to JSON, and MUST serialize `TEXT_DOCUMENT` values as the structured TextDocument style projection defined for this capability. When a property value (or keyframe value) cannot be represented faithfully (for example shape, or a text field AE will not yield), the tool MUST omit a fake value for that unsupported case and MUST mark unsupported non-text types with `unserializable: true` and include the `propertyValueType` (or equivalent type discriminator). The tool MUST NOT invent a partial incorrect structure pretending to be a complete raw TextDocument DOM dump.

#### Scenario: Unserializable non-text type is flagged

- **WHEN** an included property has a value type that the serializer does not support (for example shape)
- **THEN** that value slot MUST report `unserializable: true` and MUST NOT invent a partial incorrect structure pretending to be complete

#### Scenario: Text document is projected not flagged unserializable

- **WHEN** an included property has value type `TEXT_DOCUMENT` at `extended` or `full`
- **THEN** that value slot MUST use the style projection and MUST NOT report solely `unserializable: true`
