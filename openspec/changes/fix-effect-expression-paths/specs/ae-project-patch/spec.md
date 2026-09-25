## MODIFIED Requirements

### Requirement: Set property expression operation

`set_property_expression` MUST set or clear the expression on one PropertyBase of one layer. The property MUST be identified by exactly one of: an ordered segment array (`matchNames`) from the layer root, or a `propertyPath` string. Each segment is passed to After Effects `property(segment)` and MAY be a matchName or, where AE accepts it, an effect display name for disambiguation. When both or neither selector forms are supplied, validation MUST fail before mutation. `propertyPath` MUST parse like nexrender: if the string contains `->`, split on `->`; otherwise split on `.`. Both forms MUST resolve by walking `property(segment)` from the layer and MUST NOT follow non-PropertyBase object-field tails (for example `Source Text.font`). Effect **parameter** paths under `ADBE Effect Parade` MUST include the parent **effect instance** segment between the parade and the parameter — a path that jumps from `ADBE Effect Parade` directly to a parameter matchName (for example `ADBE Slider Control-0001`) MUST fail resolution when that parameter is nested under an applied effect group. When `expression` is a string, apply MUST set that body and honor `expressionEnabled`. When `expression` is null, apply MUST clear the expression (and disable as applicable). Evidence MUST include before/after expression body and enabled flag, the input selector used, and when readable the resolved `matchNames` after a successful walk. Post-condition MUST verify authored expression fields (not post-expression property values). Operator docs MUST prefer matchName segments from `ae_get_layer` for locale stability, MUST document the effect-instance segment rule with a Slider Control example, and MUST note that display-name middle segments and nexrender-style `propertyPath` (`.` / `->`) are supported when matchNames alone are ambiguous.

#### Scenario: Install scale expression via matchNames

- **WHEN** `set_property_expression` targets Scale via `matchNames` `["ADBE Transform Group", "ADBE Scale"]` with a non-empty `expression` and `expressionEnabled: true`
- **THEN** apply MUST set that expression string and enable it, verified by post-read

#### Scenario: Install via propertyPath

- **WHEN** `set_property_expression` supplies `propertyPath` `"ADBE Transform Group.ADBE Scale"` (and omits `matchNames`) with a valid expression payload
- **THEN** apply MUST resolve the same property walk and succeed under the same post-conditions

#### Scenario: Arrow delimiter when segment contains a dot

- **WHEN** `propertyPath` contains `->`
- **THEN** parsing MUST split only on `->` (not on `.` inside segments) before walking

#### Scenario: Both selectors refused

- **WHEN** the caller supplies both `matchNames` and `propertyPath`
- **THEN** validation MUST fail before mutation

#### Scenario: Clear expression

- **WHEN** `expression` is null
- **THEN** apply MUST clear the property expression and post-read MUST show an empty/disabled expression per AE semantics documented for the op

#### Scenario: Effect parameter path requires effect instance segment

- **WHEN** `set_property_expression` targets a Slider Control slider via `matchNames` `["ADBE Effect Parade", "ADBE Slider Control", "ADBE Slider Control-0001"]` on a layer with one Slider Control effect
- **THEN** apply MUST resolve the property, set the expression, and evidence MUST include `resolvedMatchNames` matching that three-segment path

#### Scenario: Effect parameter via display name segment

- **WHEN** `set_property_expression` targets the same slider via `matchNames` `["ADBE Effect Parade", "<effect display name>", "ADBE Slider Control-0001"]` where `<effect display name>` is the renamed effect instance label
- **THEN** apply MUST succeed and `resolvedMatchNames` MUST normalize the middle segment to the effect group's matchName

#### Scenario: Skipping effect instance segment fails

- **WHEN** `set_property_expression` supplies `matchNames` `["ADBE Effect Parade", "ADBE Slider Control-0001"]` omitting the effect instance segment
- **THEN** apply MUST fail before mutation with a clear not-found error for the parameter segment

## ADDED Requirements

### Requirement: Document effect expression paths in operator docs

Operator documentation for `ae_patch_project` / `set_property_expression` MUST explain that effect parameters are not direct children of `ADBE Effect Parade`, MUST show working three-segment examples for Slider Control (effect matchName middle segment and effect display name middle segment), MUST show an optional `propertyPath` example using `->` when effect names contain dots, and MUST warn that flattening `ae_get_layer` matchNames without intermediate group segments fails for nested effect params.

#### Scenario: mcp-tools documents effect path rule

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_property_expression` after this change ships
- **THEN** the documentation MUST include the effect-instance segment rule and at least one Slider Control path example
