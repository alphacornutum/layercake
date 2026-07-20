## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

## ADDED Requirements

### Requirement: Rename project item operation

`rename_project_item` MUST rename exactly one project item identified by stable `Item.id` (`itemId`) to the caller-supplied opaque `name` string (no normalization). The operation MUST change only `Item.name`. Idempotent already-matching names MUST report `already_satisfied`. Evidence MUST include before/after names and `itemId`.

#### Scenario: Rename footage or comp by id

- **WHEN** `rename_project_item` targets a resolvable footage or composition `itemId` with a distinct `name`
- **THEN** apply MUST set that item’s name and evidence MUST verify the re-read name equals `name`

#### Scenario: Already satisfied

- **WHEN** the item’s current name already equals `name`
- **THEN** the target MUST report `already_satisfied`

### Requirement: Set layer index operation

`set_layer_index` MUST move exactly one timeline layer (layer `target` with id-or-name inspect parity) to the caller-supplied 1-based `index` within its composition. Evidence MUST include before/after `index` and stable `layerId`. Already-at-index MUST report `already_satisfied`.

#### Scenario: Reorder by ids

- **WHEN** `set_layer_index` resolves a layer and `index` differs from the current index
- **THEN** apply MUST place the layer at that index and post-read `index` MUST match

### Requirement: Create solid operation

`create_solid` MUST create a new Solid `FootageItem` via After Effects APIs with caller-supplied `name`, integer `width`/`height`, `pixelAspect`, and RGB `color`. Optional `parentFolderId` MUST place the solid under that folder when provided. Evidence MUST include the new `itemId` and solid identity fields. The op MUST NOT infer dimensions from a layer. The op MUST NOT accept a reuse/reuse-if-exists flag in v1.

#### Scenario: Create solid under folder

- **WHEN** `create_solid` is applied with valid dimensions/color and a folder `parentFolderId`
- **THEN** apply MUST create a Solid footage item under that folder and return its `itemId`

### Requirement: Replace layer source operation

`replace_layer_source` MUST set the source of one AV layer (layer `target`) to the project item identified by `sourceItemId`. When After Effects preserves the layer identity, evidence MUST report `layerIdPreserved: true` with the same `layerId`. When identity cannot be preserved, apply MUST create a replacement layer, delete the old layer within the same operation, and report `layerIdPreserved: false` with `newLayerId`. Post-condition MUST verify the live layer’s `source.id` equals `sourceItemId`.

#### Scenario: Preserve layer id when possible

- **WHEN** replace succeeds via `replaceSource` (or equivalent) without recreating the layer
- **THEN** evidence MUST include `layerIdPreserved: true` and the same `layerId`

#### Scenario: Recreate when identity cannot be preserved

- **WHEN** AE cannot replace the source in place
- **THEN** apply MUST recreate, return `newLayerId`, set `layerIdPreserved: false`, and MUST NOT leave both old and new layers

### Requirement: Set layer timing operation

`set_layer_timing` MUST set timing on one layer (layer `target`) using integer frame fields (`startFrame`, `inFrame`, `outFrame` as applicable) converted with the containing composition’s `frameRate`. The op MUST reject payloads that supply only floating-point seconds for those timing fields when frame fields are required by the schema. Optional `stretch` and time-remap enable/value fields MAY be included with op-specific names. Evidence MUST include before/after frame fields. Protected-layer product policy is out of scope for this op.

#### Scenario: Frame-exact in/out

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` for a resolvable layer
- **THEN** apply MUST set layer in/out so post-read integer frames match the request

#### Scenario: Seconds-only timing refused

- **WHEN** the caller omits required frame fields and supplies only second-based timing
- **THEN** validation MUST fail before mutation

### Requirement: Set property expression operation

`set_property_expression` MUST set or clear the expression on one PropertyBase of one layer. The property MUST be identified by exactly one of: an ordered `matchNames` string array from the layer root, or a `propertyPath` string. When both or neither are supplied, validation MUST fail before mutation. `propertyPath` MUST parse like nexrender: if the string contains `->`, split on `->`; otherwise split on `.`. Both forms MUST resolve by walking `property(segment)` from the layer and MUST NOT follow non-PropertyBase object-field tails (for example `Source Text.font`). When `expression` is a string, apply MUST set that body and honor `expressionEnabled`. When `expression` is null, apply MUST clear the expression (and disable as applicable). Evidence MUST include before/after expression body and enabled flag, the input selector used, and when readable the resolved `matchNames` after a successful walk. Post-condition MUST verify authored expression fields (not post-expression property values). Operator docs MUST prefer `matchNames` from `ae_get_layer` for locale stability while noting that AE may also resolve display-name segments in `propertyPath`.

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

### Requirement: Create solid always creates

`create_solid` MUST always create a new Solid FootageItem on success (new `itemId`). It MUST NOT silently reuse an existing solid by name or dimensions. Reuse is agent-side via inventory + `replace_layer_source` with an existing `sourceItemId`.

#### Scenario: Second create yields new id

- **WHEN** `create_solid` is applied twice with the same name, dimensions, and color
- **THEN** each successful apply MUST return a distinct `itemId`

### Requirement: Reset layer surface operation

`reset_layer_surface` MUST clear caller-selected authored surface features on one layer (layer `target`): keyframes, effects, masks, layer styles, markers, track matte, parenting, and/or listed switches, via explicit boolean flags in the op payload. Optional `resetTransforms` MUST reset authored transform properties to AE defaults for that layer/source when true. Optional `clearExpressions` MUST clear expressions when true. The op MUST NOT claim pixel-identical render proof. Evidence MUST report which categories were cleared and verified post-counts/flags.

#### Scenario: Clear effects and keys

- **WHEN** flags request clearing effects and keyframes
- **THEN** apply MUST remove those features and post-read MUST show zero effects and no remaining keys on cleared properties when readable

### Requirement: Delete layer operation

`delete_layer` MUST delete exactly one timeline layer identified by layer `target` (id-or-name inspect parity). Evidence MUST include the deleted `layerId` and composition id. Post-condition MUST verify the layer id is absent from the composition.

#### Scenario: Delete by ids

- **WHEN** `delete_layer` resolves a layer
- **THEN** apply MUST remove it and a subsequent lookup by that `layerId` in the comp MUST fail

### Requirement: Safe delete project item operation

`safe_delete_project_item` MUST delete selected project items only when a fresh inbound-reference check equivalent to `ae_get_item_refs` reports zero known refs and `unknownRefsPossible` is false. Folder targets MUST have zero children at apply time (non-recursive). The op MUST refuse `app.project.rootFolder`. The permissive `delete_project_item` op MUST remain available and MUST NOT gain these preconditions. After successful deletes, apply MUST best-effort verify that previously non-missing retained footage sources did not newly become missing solely due to this op (report failure if detected).

#### Scenario: Refuse in-use footage

- **WHEN** any known inbound ref exists or `unknownRefsPossible` is true for a target
- **THEN** apply MUST refuse that target without deleting it

#### Scenario: Empty folder only

- **WHEN** a folder target still has children
- **THEN** apply MUST refuse without recursive deletion

#### Scenario: Unused footage deleted

- **WHEN** a FootageItem has zero known inbound refs and `unknownRefsPossible` is false
- **THEN** apply MUST delete it and evidence MUST record the pre-delete ref snapshot

#### Scenario: Root refused

- **WHEN** a selector includes the project root folder id
- **THEN** the tool MUST refuse that delete

### Requirement: Control-plane ops use post-conditions and layer target parity

New layer-targeting control-plane ops (`set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_property_expression`, `reset_layer_surface`, `delete_layer`) MUST use the same id-or-name layer `target` rules as `rename_layer`. All new mutating ops in this change MUST report `changed` only after post-condition re-read success and MUST use `already_satisfied` when the desired state is already present and detectable.

#### Scenario: Ambiguous layer name refused

- **WHEN** a layer-targeting control-plane op uses an ambiguous `layerName`
- **THEN** the tool MUST refuse before mutation with a candidate list
