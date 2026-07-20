## ADDED Requirements

### Requirement: Set composition settings operation

`set_comp_settings` MUST mutate composition settings on exactly one composition identified by a nested `target` with exactly one of `compId` or `compName` (case-sensitive exact name match; ambiguous names MUST refuse before mutation with a candidate list of at least `id` and `name`). Mutation fields MUST be supplied under a nested `settings` object. `settings` MUST accept only an explicit allowlist: integer `width` and `height`; `pixelAspect`; `frameRate`; integer `durationFrames` and `displayStartFrame`; integer `workAreaStartFrame` and `workAreaDurationFrames`; optional string `renderer`; and an optional nested `switches` object with boolean keys from the closed set `motionBlur`, `frameBlending`, `draft3d`, `hideShyLayers`, `dropFrame`, and `preserveNestedResolution`. Validation MUST require at least one allowlisted mutation field inside `settings` and MUST reject unknown keys on `settings` or `settings.switches` before mutation. Apply MUST write only fields present in `settings` and MUST NOT intentionally change omitted settings. Integer frame fields MUST be converted using the composition’s frame rate (after applying a supplied `settings.frameRate` change within the same op when present). Evidence MUST include a full allowlist settings snapshot `before` and `after` (integer frames for duration/display-start/work-area fields; switches object; `renderer` when readable). Post-condition success MUST require that each supplied field’s re-read value matches the request; unspecified fields MUST be preserved. Idempotent already-matching state MUST report `already_satisfied`. The op MUST NOT save the project. Path and fingerprint guards remain those of `ae_patch_project` (no expected-current field bag).

#### Scenario: Partial duration and work area by comp id

- **WHEN** `set_comp_settings` supplies resolvable `target.compId` with `settings.durationFrames` and `settings.workAreaDurationFrames` that fit the resulting duration
- **THEN** apply MUST set those values, evidence MUST include integer-frame before/after, and post-condition success MUST require the re-read frames match the request

#### Scenario: Resolve by unique comp name

- **WHEN** `set_comp_settings` supplies a unique `target.compName` (and omits `compId`) with at least one allowlisted `settings` field
- **THEN** apply MUST resolve that composition and proceed under the same rules as id targeting

#### Scenario: Ambiguous comp name refused

- **WHEN** `target.compName` matches more than one composition
- **THEN** the tool MUST refuse before mutation and MUST include a candidate list with at least `id` and `name` for each match

#### Scenario: Omitted settings preserved

- **WHEN** `settings` contains only `durationFrames`
- **THEN** apply MUST NOT intentionally change width, height, pixel aspect, frame rate, display start, work area (except as required by the work-area duration policy), renderer, or switches

#### Scenario: Invalid target shape refused

- **WHEN** the caller omits both `target.compId` and `target.compName`, or supplies both
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: Unknown or empty settings refused

- **WHEN** `settings` includes an unknown field, or supplies no allowlisted mutation field (including an empty or omitted `switches` with no other keys)
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: Renderer must be installed

- **WHEN** `settings.renderer` is supplied and is not a member of the live composition’s `renderers` list
- **THEN** that target MUST fail without claiming success

#### Scenario: Already satisfied

- **WHEN** every supplied `settings` field already matches the live re-readable state
- **THEN** the target MUST report `already_satisfied` and MUST NOT perform a no-op write that changes revision unnecessarily when detectable

#### Scenario: No implicit save

- **WHEN** `set_comp_settings` completes successfully
- **THEN** the tool MUST NOT save the project to disk as a side effect of this op

### Requirement: Composition settings work-area policy

When applying `set_comp_settings`, if `settings.durationFrames` is supplied and would leave the resulting work area ending past the resulting composition duration, apply MUST first adjust the work area so it ends at the new duration end (clamp), then continue applying other supplied `settings` fields. When the caller explicitly supplies `settings.workAreaStartFrame` and/or `settings.workAreaDurationFrames` and the resulting work area would end past the resulting duration, apply MUST fail that target and MUST NOT claim success.

#### Scenario: Duration shrink clamps work area

- **WHEN** the caller supplies a shorter `settings.durationFrames` without explicit work-area fields and the current work area would end past the new duration
- **THEN** apply MUST clamp the work area to end at the new duration and MUST report success when post-conditions for supplied fields hold

#### Scenario: Explicit work area past duration fails

- **WHEN** the caller supplies work-area fields under `settings` that would end past the resulting duration
- **THEN** that target MUST fail and the batch MUST NOT claim overall success for that failure path

### Requirement: Composition settings batch order with layer timing

`set_comp_settings` MUST participate in the same validate-all, single undo-group, and rollback-reporting rules as other `ae_patch_project` operations so it can compose atomically with `set_layer_timing` in one batch. Operator documentation and the product skill MUST state that callers SHOULD place `set_comp_settings` before `set_layer_timing` operations in the same batch when composition settings (especially `frameRate`) and layer frame timing are both changed, because each timing op interprets integer frames using the composition frame rate live at the time that op runs. Apply MUST NOT silently reorder operations to enforce that convention.

#### Scenario: Same-batch undo group

- **WHEN** a batch contains `set_comp_settings` and one or more `set_layer_timing` operations and mutation is required
- **THEN** the server MUST execute them inside one named undo group and MUST report rollback completion status if a later op fails after mutation began

#### Scenario: Docs state settings-before-timing order

- **WHEN** an operator or agent reads `docs/mcp-tools.md` or the product skill after this change ships
- **THEN** the documentation MUST state that `set_comp_settings` should precede `set_layer_timing` in a mixed batch

## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

#### Scenario: Unknown operation rejected

- **WHEN** an operation uses an unsupported `op` name
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: set_text_style applies exact font string

- **WHEN** a `set_text_style` operation specifies `style.font` as a string
- **THEN** LayerCake MUST set that exact string on the targeted TextDocument/CharacterRange font field(s) via ExtendScript without synonym mapping

#### Scenario: set_text_style preserves unspecified attributes

- **WHEN** `preserveUnspecified` is true (default) and only `font` is provided
- **THEN** apply MUST NOT intentionally change unspecified text attributes such as size, fill, stroke, tracking, or text content

#### Scenario: Panel ops accepted in vocabulary

- **WHEN** the caller supplies a valid `create_folder`, `move_project_item`, or `delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as `set_text_style`

#### Scenario: rename_layer accepted in vocabulary

- **WHEN** the caller supplies a valid `rename_layer` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

#### Scenario: Control-plane ops accepted in vocabulary

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops
