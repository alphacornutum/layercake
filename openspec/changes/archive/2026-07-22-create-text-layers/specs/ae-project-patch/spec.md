## ADDED Requirements

### Requirement: Create text operation

`create_text` MUST create a new horizontal text layer in exactly one composition identified by a nested comps-only `target` with exactly one of `compId` or `compName` (case-sensitive exact name match; ambiguous names MUST refuse before mutation with a candidate list of at least `id` and `name`). The payload MUST include `layout` as exactly `"point"` or `"box"`, and MUST include a `text` string (empty string MUST be allowed). When `layout` is `"box"`, the payload MUST include `boxTextSize` as a number array of length 2 (positive dimensions per After Effects box-text rules); when `layout` is `"point"`, `boxTextSize` MUST be rejected. Optional `name` MUST follow the optional-create-name rule for typed create ops. Optional `style` MUST accept only the same closed allowlist as `set_text_style` (omit key = leave After Effects create defaults for that attribute) and MUST reject unknown keys before mutation. Apply MUST use After Effects `LayerCollection.addText` for point layout and `LayerCollection.addBoxText` for box layout (horizontal orientation as those APIs provide). When `style` is supplied, apply MUST write those keys onto the authored / pre-expression `TextDocument` using the same write semantics as `set_text_style` (including caps / leading / box-geometry guards that apply after the layer exists). Evidence MUST include at least the new `layerId`, composition id, final `name`, `layout`, `text`, `boxText` / `pointText` booleans when readable, and for box layout the authored `boxTextSize`. Post-condition success MUST require that layout flags match `layout`, authored `text` matches the request, box create size matches when `layout` is `"box"`, optional supplied `name` matches when provided, and every supplied `style` key matches the authored style snapshot under the same equality rules as `set_text_style`. If create succeeds but style application or post-condition fails, apply MUST best-effort delete the newly created layer and MUST report that target as failed (MUST NOT report `changed` success while leaving the orphan). The op MUST always create a new layer identity on success (new `layerId`); it MUST NOT reuse an existing text layer by name. The op MUST NOT save the project. Vertical text create APIs and in-place point↔box conversion MUST NOT be accepted by this op.

#### Scenario: Create point text with style

- **WHEN** `create_text` targets a resolvable composition with `layout: "point"`, non-empty `text`, and a valid partial `style` bag
- **THEN** apply MUST create a point text layer, apply the supplied style keys, and evidence MUST include the new `layerId` with `pointText` true (when readable) and authored style matching the supplied keys

#### Scenario: Create box text requires size

- **WHEN** `create_text` uses `layout: "box"` without `boxTextSize`
- **THEN** validation MUST fail before any mutation

#### Scenario: Box create refuses point-only payload keys misuse

- **WHEN** `create_text` uses `layout: "point"` and also supplies top-level `boxTextSize`
- **THEN** validation MUST fail before any mutation

#### Scenario: Optional name applied

- **WHEN** `create_text` supplies `name` distinct from AE’s default
- **THEN** apply MUST set the layer name to that opaque string and evidence MUST report the final `name`

#### Scenario: Omit name keeps host default

- **WHEN** `create_text` omits `name`
- **THEN** apply MUST leave the After Effects default layer name for that create path and evidence MUST still include the final `name`

#### Scenario: Style failure rolls back layer

- **WHEN** the text layer is created but a supplied `style` key cannot be applied or fails post-condition
- **THEN** apply MUST best-effort remove the new layer and MUST report failure without `changed` success for that create

#### Scenario: Ambiguous comp name refused

- **WHEN** `target.compName` matches more than one composition
- **THEN** the tool MUST refuse before mutation with a candidate list of at least `id` and `name`

#### Scenario: Always new layer id

- **WHEN** `create_text` is applied twice with the same `text`, `layout`, and optional `name`
- **THEN** each successful apply MUST return a distinct `layerId`

### Requirement: Optional name on typed create operations

Typed create patch operations (`create_folder`, `create_solid`, `create_text`, and any future `create_*` in this vocabulary) MUST treat `name` as optional. When `name` is omitted, apply MUST keep After Effects’ (or the host API’s) default name for that create path; when the After Effects API requires a name argument, apply MAY pass a short conventional placeholder that the host uniquifies (documented per op) rather than inventing LayerCake uniqueness schemes. When `name` is supplied, apply MUST set that opaque string after create with no normalization. Per-target evidence MUST include the final `name` and the new id(s). This rule MUST NOT change rename ops (`rename_layer`, `rename_project_item`), which continue to require an explicit desired name.

#### Scenario: create_solid without name

- **WHEN** `create_solid` is applied with valid dimensions/color and omits `name`
- **THEN** apply MUST create the solid using the host default naming path for solids and evidence MUST include the final `name` and new `itemId`

#### Scenario: create_folder without name

- **WHEN** `create_folder` is applied with a valid `parentFolderId` and omits `name`
- **THEN** apply MUST create the folder using the host default naming path for folders and evidence MUST include the final `name` and new folder `id`

#### Scenario: Explicit name still works

- **WHEN** any typed create op supplies a non-empty `name`
- **THEN** apply MUST set that exact string on the created object and evidence MUST report it

## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `create_text`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `create_text`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_comp_settings`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

### Requirement: Create folder operation

`create_folder` MUST create a new `FolderItem` under a caller-supplied parent folder identified by `Item.id` (`parentFolderId`). Optional `name` MUST follow the optional-create-name rule for typed create ops (omit = host default naming path for folders; supply = opaque string after create). The parent MUST resolve to a `FolderItem` (including the project root). On success the per-target evidence MUST include the new folder’s `id`, final `name`, and `parentFolderId`.

#### Scenario: Create under inventory root id

- **WHEN** `create_folder` is applied with `parentFolderId` equal to `app.project.rootFolder.id` from a prior inventory read and a supplied `name`
- **THEN** apply MUST create the folder under the project root and return its new `Item.id` in the operation evidence

#### Scenario: Invalid parent refused

- **WHEN** `parentFolderId` does not resolve to a `FolderItem`
- **THEN** the tool MUST fail that operation without creating a folder

#### Scenario: Omit name allowed

- **WHEN** `create_folder` omits `name` with a valid `parentFolderId`
- **THEN** apply MUST create the folder and evidence MUST include the final host-default `name`

### Requirement: Create solid operation

`create_solid` MUST create a new Solid `FootageItem` via After Effects APIs with caller-supplied integer `width`/`height`, `pixelAspect`, and RGB `color`. Optional `name` MUST follow the optional-create-name rule for typed create ops. Optional `parentFolderId` MUST place the solid under that folder when provided. Evidence MUST include the new `itemId`, final `name`, and solid identity fields. The op MUST NOT infer dimensions from a layer. The op MUST NOT accept a reuse/reuse-if-exists flag in v1.

#### Scenario: Create solid under folder

- **WHEN** `create_solid` is applied with valid dimensions/color, a supplied `name`, and a folder `parentFolderId`
- **THEN** apply MUST create a Solid footage item under that folder and return its `itemId`

#### Scenario: Omit name allowed

- **WHEN** `create_solid` is applied with valid dimensions/color and omits `name`
- **THEN** apply MUST create the solid and evidence MUST include the final host-default `name` and new `itemId`
