# Spec Delta

## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `create_text`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_property_keyframes`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `create_text`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_property_keyframes`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

## ADDED Requirements

### Requirement: Property keyframe operation targets one property

`set_property_keyframes` MUST identify one Property leaf by exactly one ordered `matchNames` or `propertyPath` selector, including intermediate groups. Property segments MUST resolve uniquely by exact matchName or exact display name; ambiguous and unresolved segments MUST fail before mutation.

#### Scenario: Resolve nested property by match names

- **WHEN** a caller targets Opacity with `matchNames: ["ADBE Transform Group", "ADBE Opacity"]`
- **THEN** the operation MUST resolve that leaf and return its resolved path

#### Scenario: Resolve property path

- **WHEN** a caller supplies only `propertyPath` with segments separated by `.` or `->`
- **THEN** the operation MUST use the existing path delimiter rules and resolve the same ordered property walk

#### Scenario: Ambiguous or missing property rejected

- **WHEN** any property path segment is ambiguous or does not resolve to a unique leaf property
- **THEN** the operation MUST fail before any mutation and report the failing segment

### Requirement: Property keyframe operation uses standard layer targets

`set_property_keyframes` MUST use the standard layer target contract: exactly one composition selector and one layer selector, each by stable ID or case-sensitive exact name. Name selectors MUST resolve uniquely; ambiguous targets MUST fail before mutation with candidate evidence.

#### Scenario: Target by stable IDs

- **WHEN** a caller supplies `compId` and `layerId`
- **THEN** the operation MUST resolve the requested layer

#### Scenario: Target by unique names

- **WHEN** a caller supplies a unique exact `compName` and `layerName`
- **THEN** the operation MUST resolve the requested layer under the same rules as other layer-targeting patch operations

#### Scenario: Ambiguous layer name rejected

- **WHEN** the composition resolves but `layerName` matches multiple layers
- **THEN** the operation MUST fail before mutation and include the matching layer candidates

### Requirement: Property keyframe operation replaces a complete timeline or restores a sampled static value

The operation MUST accept exactly one desired state: a non-empty complete `keyframes` timeline, or `staticValueAtTime` in composition seconds. The timeline MUST replace all existing keys; static mode MUST sample the authored value at the supplied time before removing keys and restore it as the static value. Empty desired timelines and simultaneous or absent desired-state fields MUST be rejected.

#### Scenario: Replace complete timeline

- **WHEN** `keyframes` contains ordered time/value entries
- **THEN** the operation MUST leave the target property with exactly those keys and no omitted prior keys

#### Scenario: Remove keys and restore sampled value

- **WHEN** `staticValueAtTime` is supplied
- **THEN** the operation MUST sample the authored pre-expression value at that composition time, remove the target property's keys, and restore that sample as its static value

#### Scenario: Reject ambiguous desired state

- **WHEN** both or neither desired-state fields are supplied, or desired `keyframes` is empty
- **THEN** validation MUST fail before mutation

#### Scenario: Reject unsupported property values

- **WHEN** the property type or supplied value is not in the supported finite numeric scalar/vector/color domain or has a mismatched dimension
- **THEN** the operation MUST refuse before mutation with a clear unsupported-type or invalid-value error

### Requirement: Property keyframe timelines use bounded composition-time input

All desired key times and static sample times MUST be finite composition seconds. Desired key times MUST be strictly increasing and separated beyond the comparison tolerance. The operation MUST reject timelines beyond its documented key-count bound before mutation.

#### Scenario: Times are composition seconds

- **WHEN** the caller supplies a key or sample time
- **THEN** the operation MUST use it directly as composition seconds without implicit frame or display-start conversion

#### Scenario: Unordered or near-duplicate times rejected

- **WHEN** supplied key times are not strictly increasing or are equal within the documented tolerance
- **THEN** the operation MUST reject the request before mutation

#### Scenario: Timeline exceeds bound

- **WHEN** the supplied or observed timeline exceeds the operation's documented maximum
- **THEN** the operation MUST refuse before mutation without truncating evidence

### Requirement: Property keyframe operation sets temporal interpolation and easing

Each desired key MUST accept incoming and outgoing `LINEAR`, `BEZIER`, or `HOLD` interpolation, defaulting to `LINEAR`. Temporal ease MUST be accepted only when both sides are `BEZIER`, with a correctly dimensioned ease array of finite `{speed, influence}` values and influence in `[0.1, 100]`; ease on a non-Bezier side MUST be rejected.

#### Scenario: Default interpolation is linear

- **WHEN** a desired key omits both interpolation fields
- **THEN** the operation MUST request `LINEAR` interpolation on both sides independent of AE preferences

#### Scenario: Apply Bezier curves with independent ease

- **WHEN** a desired key specifies `BEZIER` on both sides with valid per-side ease
- **THEN** the operation MUST set and verify the requested temporal ease on each side

#### Scenario: Apply mixed non-ease interpolation

- **WHEN** a desired key specifies `LINEAR`/`HOLD` interpolation with no ease
- **THEN** the operation MUST set and verify those interpolation types as requested

#### Scenario: Invalid ease rejected

- **WHEN** a Bezier side omits ease, ease cardinality does not match the property type, influence is outside `[0.1, 100]`, or ease is supplied with a non-Bezier side
- **THEN** validation MUST fail before mutation (After Effects forces both sides to Bezier whenever ease is applied, so mixed or HOLD interpolation with ease cannot be honored)

#### Scenario: Unsupported interpolation refused

- **WHEN** the property does not support a requested interpolation type
- **THEN** the operation MUST refuse before mutation

### Requirement: Property keyframe operation accepts expected-state guards

An optional `expected` guard MUST accept `numKeys`, a complete ordered keyframe timeline, or both. Expected timeline entries MUST require time/value and MAY assert incoming/outgoing interpolation and ease; omitted curve fields are not assertions. When both guard forms are supplied, their counts MUST agree, and every supplied expectation MUST match the live authored property before mutation.

#### Scenario: Count-only guard matches

- **WHEN** `expected.numKeys` matches the current target property's key count
- **THEN** the guard MUST pass without asserting curve or value equality

#### Scenario: Complete timeline guard matches

- **WHEN** expected keyframes match the complete current time/value timeline and all supplied curve assertions
- **THEN** the guard MUST pass

#### Scenario: Either guard can refuse stale state

- **WHEN** the key count, any expected key time/value, or any supplied curve assertion differs from current state
- **THEN** the operation MUST fail before mutation

#### Scenario: Inconsistent guards rejected

- **WHEN** both `numKeys` and `keyframes` are supplied but the count differs from the expected timeline length
- **THEN** validation MUST fail before mutation

#### Scenario: Guard checked for idempotent request

- **WHEN** the desired state already matches but a supplied expected guard does not match
- **THEN** the operation MUST fail rather than report `already_satisfied`

### Requirement: Property keyframe operation preserves expression state by default

The operation MUST preserve a target's expression body and enabled state. An enabled expression MUST cause a pre-mutation refusal by default. An explicit `expressionHandling: "clear"` MUST clear only the target property's expression and verify empty/disabled state; expression replacement remains the responsibility of `set_property_expression`.

#### Scenario: Enabled expression refused by default

- **WHEN** the target property has an enabled expression and expression handling is omitted
- **THEN** the operation MUST fail before mutation

#### Scenario: Explicitly clear enabled expression

- **WHEN** the target has an enabled expression and `expressionHandling: "clear"` is requested
- **THEN** the operation MUST clear that expression, perform the requested keyframe mutation, and verify the expression is empty and disabled

#### Scenario: Preserve disabled expression

- **WHEN** the target has a disabled expression and expression handling is omitted
- **THEN** the operation MUST preserve the exact expression body and disabled state

### Requirement: Property keyframe operation preflights and bounds mutation

The operation MUST preflight target resolution, supported property type, all inputs, expression policy, sample, expected state, evidence limits, and preservation baseline before any batch mutation. It MUST bound property walks and evidence, reject duplicate target properties within one batch, revalidate the planned target before writing, and refuse stale plans rather than silently recapturing state.

#### Scenario: Invalid later operation causes no earlier mutation

- **WHEN** a batch contains a valid mutating operation followed by a `set_property_keyframes` operation that fails preflight
- **THEN** the batch MUST fail before applying the earlier operation

#### Scenario: Stale planned property rejected

- **WHEN** an earlier batch operation changes the planned property or invalidates its resolved path before keyframe apply
- **THEN** the operation MUST fail and use the existing rollback reporting rather than silently recapture

#### Scenario: Bounds fail closed

- **WHEN** property traversal, sibling key snapshots, or planned evidence exceed documented limits or cannot be faithfully compared
- **THEN** the operation MUST refuse before mutation without truncating evidence or claiming preservation

### Requirement: Property keyframe operation verifies results and unrelated keyframes

The result MUST report target property identity, actual before/after key counts and timelines, authored static samples where applicable, expression state, and requested versus actual curve settings. The operation MUST verify other keyed properties on the target layer are unchanged within its documented bounded scope (key times, values, interpolation, authored Bezier ease) and report checked counts.

#### Scenario: Successful timeline replacement evidence

- **WHEN** a requested timeline is applied and AE reads back the requested state within documented tolerances
- **THEN** the result MUST report `changed` or `already_satisfied`, actual before/after timeline evidence, and preservation evidence showing checked properties and keys

#### Scenario: Successful static restore evidence

- **WHEN** keys are removed and the sampled authored value is restored
- **THEN** evidence MUST show zero remaining keys, the actual static authored value, sample time, and unchanged expression state (or the explicitly cleared state)

#### Scenario: Preservation scope stays bounded

- **WHEN** a caller reads the preservation evidence
- **THEN** it MUST reflect only the documented sibling check (key times, values, interpolation, authored Bezier ease) and MUST NOT imply whole-project deep equality or assert AE-derived metadata (auto ease on non-Bezier keys, spatial tangents, continuity/auto-Bezier/roving flags) that AE may recompute during unrelated evaluation

#### Scenario: Unrelated keyframe drift fails

- **WHEN** another keyed property on the target layer differs from its pre-write snapshot in key times, values, interpolation, or authored Bezier ease
- **THEN** the operation MUST fail, include bounded drift evidence, and invoke existing batch rollback reporting when mutation occurred

#### Scenario: Host normalizes requested curve

- **WHEN** AE's actual interpolation/ease differs from the requested curve beyond documented tolerances
- **THEN** the operation MUST fail with the actual post-read rather than claim success

### Requirement: Property keyframe operation never saves implicitly

`set_property_keyframes` MUST use required project path and fingerprint guards, participate in `ae_patch_project` undo/rollback and post-condition reporting, and MUST NOT persist the project. Operators MUST use `ae_save_project` separately when persistence is required.

#### Scenario: Stale project guard refused

- **WHEN** the supplied project path or fingerprint does not match the open project
- **THEN** the operation MUST fail before mutation

#### Scenario: Successful patch leaves project unsaved

- **WHEN** a valid keyframe mutation succeeds
- **THEN** the result MUST report the updated project context and MUST NOT save the project to disk

#### Scenario: Apply failure reports rollback honestly

- **WHEN** a write or post-condition fails after mutation starts
- **THEN** the batch MUST report actual readable post-state and whether rollback was attempted/completed without claiming success when restoration is unverified
