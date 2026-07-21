## ADDED Requirements

### Requirement: Partial TextDocument style bag on set_text_style

`set_text_style` MUST accept a nested `style` object whose keys are drawn from a closed allowlist: `font` (string), `fontSize` (number), `fillColor` (RGB array length 3 in 0..1), `applyFill` (boolean), `strokeColor` (RGB array length 3 in 0..1), `applyStroke` (boolean), `strokeWidth` (number), `tracking` (number), `baselineShift` (number), `fauxBold` (boolean), `fauxItalic` (boolean), `allCaps` (boolean), `smallCaps` (boolean), `horizontalScale` (number), `verticalScale` (number), `autoLeading` (boolean), `leading` (number), `justification` (closed string enum mapped to After Effects `ParagraphJustification`), `text` (string), `boxTextSize` (number array length 2), and `boxTextPos` (number array length 2). Validation MUST require at least one allowlisted key and MUST reject unknown keys before mutation. Apply MUST write only supplied keys onto the authored / pre-expression `TextDocument` (using `allStyleRuns` for character-scoped attributes when that flag is true) and MUST NOT intentionally change omitted style attributes. `style.font` MUST remain optional when another allowlisted key is present. Box geometry keys (`boxTextSize`, `boxTextPos`) MUST refuse clearly when the layer is not box text. The op MUST NOT accept an expected-current bag; stale-project refuse remains `project.path` / `project.fingerprint`. The op MUST NOT clear, disable, or rewrite Source Text `expression` / `expressionEnabled` as part of the style write.

#### Scenario: autoLeading-only patch accepted

- **WHEN** a `set_text_style` operation supplies only `style.autoLeading: true` (no `font`)
- **THEN** validation MUST succeed and apply MUST set authored `autoLeading` without requiring `font`

#### Scenario: Unknown style key rejected

- **WHEN** `style` includes a key outside the allowlist
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: Empty style rejected

- **WHEN** `style` is present but contains no allowlisted keys
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: Point-text box size refused

- **WHEN** `style.boxTextSize` is supplied for a point-text layer
- **THEN** that target MUST fail with a clear message and MUST NOT mutate other style fields for that target beyond what already applied in the same target attempt (prefer refuse before write when boxText is known false)

#### Scenario: Omitted keys preserved

- **WHEN** `preserveUnspecified` is true (default) and only `autoLeading` is supplied
- **THEN** apply MUST NOT intentionally change font, fontSize, text content, fill, tracking, or box geometry

#### Scenario: Expression body untouched

- **WHEN** `set_text_style` applies a style change on a layer whose Source Text has a non-empty expression
- **THEN** apply MUST leave `expression` and `expressionEnabled` unchanged

### Requirement: Dual authored and evaluated style evidence for set_text_style

`set_text_style` per-target before/after evidence MUST include an authored style snapshot under `style` covering the readable allowlisted fields (plus read-only `boxText` / `pointText` when readable). When a post-expression sample is readable at composition time, evidence MUST also include `evaluatedStyle` with the same field shape. Post-condition success MUST depend only on authored values for **caller-supplied** `style` keys matching the request, not on `evaluatedStyle`. For font specifically, evidence MUST continue to include `fonts` (and `evaluatedFonts` when readable) as today so font-list consumers keep working; post-condition for a supplied `font` MUST remain consistent with authored font matching (via `fonts` and/or `style.font`). Operator documentation MUST state that `style` / `fonts` are authored / pre-expression (post-condition), `evaluatedStyle` / `evaluatedFonts` are post-expression when present, and that mismatch after success indicates an expression or other live override still driving appearance.

#### Scenario: Successful target includes style and evaluatedStyle when evaluated readable

- **WHEN** a successful `set_text_style` target returns before/after evidence and the host can sample post-expression text
- **THEN** evidence MUST include authored `style` and, when readable, `evaluatedStyle` on those before/after objects

#### Scenario: Evaluated mismatch does not fail authored success

- **WHEN** authored after-state matches all supplied style keys but `evaluatedStyle` still differs for those keys
- **THEN** that target MUST still report `changed` (or `already_satisfied` when authored already matched) and MUST NOT be reported as post-condition `failed` solely due to the evaluated mismatch

#### Scenario: Font-only callers still see fonts arrays

- **WHEN** a successful `set_text_style` target supplies only `style.font`
- **THEN** evidence MUST still include authored `fonts` (and `evaluatedFonts` when readable) in addition to the `style` snapshot

## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

#### Scenario: Unknown operation rejected

- **WHEN** an operation uses an unsupported `op` name
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: set_text_style applies exact font string

- **WHEN** a `set_text_style` operation specifies `style.font` as a string
- **THEN** LayerCake MUST set that exact string on the targeted TextDocument/CharacterRange font field(s) via ExtendScript without synonym mapping

#### Scenario: set_text_style preserves unspecified attributes

- **WHEN** `preserveUnspecified` is true (default) and only `font` is provided
- **THEN** apply MUST NOT intentionally change unspecified text attributes such as size, fill, stroke, tracking, leading, autoLeading, justification, box geometry, or text content

#### Scenario: Panel ops accepted in vocabulary

- **WHEN** the caller supplies a valid `create_folder`, `move_project_item`, or `delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as `set_text_style`

#### Scenario: rename_layer accepted in vocabulary

- **WHEN** the caller supplies a valid `rename_layer` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

#### Scenario: Control-plane ops accepted in vocabulary

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

### Requirement: Pre-expression TextDocument for set_text_style fonts

`set_text_style` MUST read, mutate, and post-condition-verify all supplied style fields against the authored / pre-expression `TextDocument` for each target’s Source Text property. When the property can vary over time or has a non-empty expression, apply MUST obtain that document via `valueAtTime` with the pre-expression flag set to true (composition time), not via post-expression `Property.value` alone. An active expression that still evaluates to different on-screen style values MUST NOT alone cause post-condition failure when the authored supplied fields match the request.

#### Scenario: Expression consumer succeeds on authored style match

- **WHEN** `set_text_style` writes requested style fields on a text layer whose Source Text expression still evaluates to different on-screen values
- **THEN** apply MUST report `changed` (or `already_satisfied` if authored already matched) when the pre-expression post-read matches the supplied keys, and MUST NOT fail solely because the post-expression sample still shows the expression result

#### Scenario: set_text_style does not bake post-expression TextDocument

- **WHEN** `set_text_style` applies a style change on a layer with an active Source Text expression
- **THEN** apply MUST base the mutation on the pre-expression `TextDocument` and MUST NOT use post-expression `Property.value` as the sole read path for that write

### Requirement: Dual authored and evaluated font evidence for set_text_style

`set_text_style` per-target before/after evidence MUST include authored font lists under `fonts` (pre-expression `TextDocument`) when readable. When a post-expression sample is readable at composition time, evidence MUST also include `evaluatedFonts` on the same before/after object (post-expression fonts). Post-condition success for a supplied `font` MUST depend only on authored `fonts` matching the request (consistent with the style-bag post-condition rule), not on `evaluatedFonts`. This requirement coexists with the dual style snapshot requirement: font arrays remain available for font-list workflows. Operator documentation MUST state that `fonts` is authored / pre-expression, `evaluatedFonts` is post-expression / on-screen when present, and that a mismatch after a successful change indicates an expression or other live override still driving appearance.

#### Scenario: Successful target includes both font lists when evaluated is readable

- **WHEN** a successful `set_text_style` target returns before/after evidence and the host can sample post-expression fonts
- **THEN** evidence MUST include `fonts` from the pre-expression document and `evaluatedFonts` from the post-expression sample on those before/after objects

#### Scenario: Evaluated mismatch does not fail authored success

- **WHEN** authored `after.fonts` match the requested font but `after.evaluatedFonts` still list a different font
- **THEN** that target MUST still report `changed` (or `already_satisfied` when authored already matched) and MUST NOT be reported as post-condition `failed` solely due to the evaluated mismatch

#### Scenario: Operator docs explain dual font evidence

- **WHEN** an operator reads `docs/mcp-tools.md` (or equivalent) for `ae_patch_project` / `set_text_style`
- **THEN** the docs MUST state that `fonts` is authored / pre-expression (post-condition), `evaluatedFonts` is post-expression when present, that `style` / `evaluatedStyle` cover the wider bag, and that mismatch after success means patch expression sources (or expressions) for on-screen change
