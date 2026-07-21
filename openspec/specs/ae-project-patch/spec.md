## Purpose

Declarative apply-only mutation tool with typed ops (text style, rename layer/item, panel create/move/delete, and control-plane mutators including solids, source replace, frame timing, layer switches, composition settings, expressions, layer reset/delete, and `safe_delete_project_item`), fingerprint guards, undo grouping, and post-condition-verified before/after evidence.

## Requirements

### Requirement: Patch project tool

The MCP server MUST expose `ae_patch_project` that applies declarative, typed mutations against the currently open After Effects project without persisting to disk. The tool applies operations directly; it MUST NOT expose a preview/dry-run mode or issue stateful plan tokens in this capability.

#### Scenario: Direct apply with fingerprint guard

- **WHEN** the caller invokes `ae_patch_project` with a matching `project.path` and `project.fingerprint` and a non-empty typed `operations` array
- **THEN** the server MUST validate every operation before mutating, execute the batch inside one named undo group when mutation is required, leave the project unsaved solely due to this tool, and return structured per-operation results plus the new fingerprint

#### Scenario: Stale fingerprint refused

- **WHEN** apply is requested with a fingerprint that does not match the open project
- **THEN** the tool MUST refuse mutation, return a structured stale error, and include or point to current context fields so the agent can recover by re-reading context

#### Scenario: Path mismatch refused

- **WHEN** the requested `project.path` does not match the open project path
- **THEN** the tool MUST refuse without opening or switching projects

#### Scenario: No implicit save

- **WHEN** patch apply completes
- **THEN** the tool MUST NOT save the project to disk as a side effect (an optional backup-before-apply MUST use `ae_save_project` `create_backup`, not `save_current`)

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

### Requirement: Id-or-name targeting for layer patch selectors

Layer-targeting patch operations MUST resolve compositions and layers with the same id-or-name rules as `ae_get_layer`: exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName`) per explicit layer target; name matches MUST be case-sensitive exact matches; ambiguous names MUST refuse before mutation with candidate lists (comps: at least `id` and `name`; layers: at least `id`, `index`, and `name`); not-found MUST fail clearly. This MUST apply to every layer-targeting patch op that uses a layer `target` or per-layer selector — including `rename_layer.target`, `set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`, and each entry of `set_text_style` when `selector.kind` is `layers`. LayerCake MUST NOT introduce an ids-only targeting exception for a new layer-targeting op unless a superseding ADR records that exception. For `set_text_style` when `selector.kind` is `comps`, the selector MUST accept `compIds` and/or `compNames` (union; at least one non-empty), resolve each name uniquely under the same ambiguity rules, and MUST continue to accept existing `compIds`-only payloads. `selector.kind` `all_text_layers` is unchanged. Existing `set_text_style` payloads that use only `compId`+`layerId` layer refs or only `compIds` MUST remain valid.

#### Scenario: set_text_style layers by unique names

- **WHEN** `set_text_style` uses `selector.kind` `layers` with an entry that supplies unique `compName` and `layerName` (and omits ids)
- **THEN** apply MUST resolve that single text layer and proceed with font mutation under existing op rules

#### Scenario: set_text_style layers id-only still works

- **WHEN** `set_text_style` uses `selector.kind` `layers` with an entry that supplies only `compId` and `layerId`
- **THEN** validation MUST accept the entry and apply MUST resolve by id as today

#### Scenario: set_text_style comps by name

- **WHEN** `set_text_style` uses `selector.kind` `comps` with a unique `compNames` entry (and optional `compIds`)
- **THEN** apply MUST include text layers from that composition in the resolved target set

#### Scenario: Ambiguous set_text_style name refused

- **WHEN** a `set_text_style` layer or comps name selector matches more than one object
- **THEN** the tool MUST refuse before mutation and MUST include a candidate list

#### Scenario: set_layer_switches uses shared target parity

- **WHEN** `set_layer_switches` supplies a valid id-or-name `target`
- **THEN** validation and resolve MUST use the same rules as `rename_layer.target` (no ids-only special case)

#### Scenario: set_layer_transform uses shared target parity

- **WHEN** `set_layer_transform` supplies a valid id-or-name `target`
- **THEN** validation and resolve MUST use the same rules as `rename_layer.target` (no ids-only special case)

### Requirement: Rename layer operation

`rename_layer` MUST rename exactly one timeline layer per operation to the caller-supplied `layerName` string. The operation MUST accept a nested `target` with exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName` for lookup of the current layer). Name matches MUST be case-sensitive exact matches. The desired `layerName` MUST be applied as an opaque string with no normalization, truncation, or brace stripping (including values such as `{message_01}` and `{message_10}`). The operation MUST change only the layer’s name (not Source Text, styles, expressions, keyframes, effects, transforms, masks, parenting, track mattes, source references, layer order, enabled/shy/locked state, or timing). Batch renames MUST be expressed as multiple `rename_layer` operations in one `operations` array. The op MUST NOT accept broad multi-layer selectors (for example `all_text_layers`) or a shared name applied to many layers in one op.

#### Scenario: Rename by ids

- **WHEN** `rename_layer` is applied with resolvable `target.compId` and `target.layerId` and a `layerName` distinct from the current name
- **THEN** apply MUST set that layer’s name to `layerName` and per-target evidence MUST include before/after names plus resolved `compId` and `layerId`

#### Scenario: Rename by unique names

- **WHEN** `rename_layer` is applied with resolvable unique `target.compName` and `target.layerName` (lookup) and a desired `layerName`
- **THEN** apply MUST rename that single layer and evidence MUST report the resolved ids

#### Scenario: Opaque mustache names preserved

- **WHEN** the desired `layerName` is `{message_10}` or another mustache form with zero-padded counters
- **THEN** the live layer name after a successful change MUST equal that string exactly

#### Scenario: Already satisfied

- **WHEN** the resolved layer’s current name already equals the desired `layerName`
- **THEN** that target MUST report `already_satisfied` and MUST NOT perform a no-op write that changes revision unnecessarily when detectable

#### Scenario: Ambiguous composition or layer name refused

- **WHEN** `target.compName` or lookup `target.layerName` matches more than one object
- **THEN** the tool MUST refuse before mutation and MUST include a candidate list (comps: at least `id` and `name`; layers: at least `id`, `index`, and `name`)

#### Scenario: Missing target refused

- **WHEN** the composition or layer selector matches nothing
- **THEN** the tool MUST fail that operation without renaming other layers in the batch until validate-all / apply rules dictate stop-and-rollback behavior consistent with existing patch failure handling

#### Scenario: Invalid target selector shape refused

- **WHEN** the caller omits both composition selectors, supplies both, omits both layer selectors, or supplies both layer selectors on `target`
- **THEN** the tool MUST fail validation before any mutation

#### Scenario: Multi-op batch rename

- **WHEN** the caller supplies several `rename_layer` operations with distinct targets and desired names in one apply
- **THEN** the tool MUST apply them in one undo group (when mutation is required) and return per-operation evidence for each

### Requirement: Post-condition verification for patch operations

For every typed patch operation that mutates project state, apply MUST re-read the affected live field(s) after the write and MUST report `changed` only when the post-condition matches the request. If the post-condition does not match, that target MUST be reported as `failed` (or equivalent non-success) and the batch MUST NOT claim overall success. When a target is `failed` (including post-condition mismatch) and a post-read is possible, evidence MUST include the actual re-read `after` state in the same shape as a successful target — MUST NOT omit `after` or echo the requested value as if applied. If the target cannot be read after failure, evidence MAY omit `after` and MUST explain that in the target message. Idempotent already-matching state MUST use `already_satisfied` (or equivalent) without claiming a fresh change. This rule MUST apply to `rename_layer` (live `layer.name` equals desired `layerName`) and MUST be applied to existing ops in this capability (`set_text_style` fonts, `move_project_item` parent folder, `create_folder` identity/placement, `delete_project_item` absence) where post-read verification is not already guaranteed.

#### Scenario: Rename post-condition mismatch is failure with actual after

- **WHEN** a `rename_layer` write completes but a subsequent read of the layer’s name does not equal the requested `layerName`
- **THEN** that target MUST be reported as `failed`, evidence `after` MUST contain the actual re-read name, and the apply response MUST NOT claim overall success

#### Scenario: Successful rename verifies name

- **WHEN** `rename_layer` succeeds
- **THEN** evidence `after` MUST reflect a re-read name equal to the requested `layerName`

#### Scenario: Existing ops honor post-condition

- **WHEN** `set_text_style`, `move_project_item`, `create_folder`, or `delete_project_item` mutates a target
- **THEN** apply MUST confirm the requested end state via post-read (fonts / `parentFolderId` / created folder fields / item absent) before reporting `changed` success for that target

#### Scenario: Failed existing op still reports actual after

- **WHEN** a mutating patch target fails post-condition verification for an existing op
- **THEN** that target’s evidence MUST include the actual re-read `after` fields when readable

### Requirement: Create folder operation

`create_folder` MUST create a new `FolderItem` under a caller-supplied parent folder identified by `Item.id` (`parentFolderId`), using the provided `name` string. The parent MUST resolve to a `FolderItem` (including the project root). On success the per-target evidence MUST include the new folder’s `id`, `name`, and `parentFolderId`.

#### Scenario: Create under inventory root id

- **WHEN** `create_folder` is applied with `parentFolderId` equal to `app.project.rootFolder.id` from a prior inventory read
- **THEN** apply MUST create the folder under the project root and return its new `Item.id` in the operation evidence

#### Scenario: Invalid parent refused

- **WHEN** `parentFolderId` does not resolve to a `FolderItem`
- **THEN** the tool MUST fail that operation without creating a folder

### Requirement: Move project item operation

`move_project_item` MUST set `Item.parentFolder` for each selected project item (`selector.kind` `items` with a non-empty `itemIds` list) to the `FolderItem` identified by `destinationFolderId`. Selectors MUST use stable `Item.id` values, not names. When an item is already under the destination, apply MUST report `already_satisfied` for that target without a no-op write that changes revision unnecessarily. Per-target evidence MUST include `before.parentFolderId` and `after.parentFolderId`.

#### Scenario: Move items by id

- **WHEN** `move_project_item` targets one or more existing item ids and a valid destination folder id
- **THEN** each moved item’s `parentFolder` MUST equal the destination and evidence MUST report before/after `parentFolderId`

#### Scenario: Already at destination

- **WHEN** an item’s current `parentFolder.id` already equals `destinationFolderId`
- **THEN** that target MUST report `already_satisfied` and MUST NOT be reported as newly `changed`

#### Scenario: Cycle refused

- **WHEN** the item being moved is a folder and the destination is that folder or a descendant of it
- **THEN** the tool MUST refuse that target (or the operation) without performing the move

#### Scenario: Missing item or destination refused

- **WHEN** an item id or `destinationFolderId` does not resolve, or the destination is not a `FolderItem`
- **THEN** the tool MUST fail validation or that target without applying a partial invalid move for that id

### Requirement: Delete project item operation

`delete_project_item` MUST delete selected project items via After Effects `Item.remove()` semantics for folders, footage, compositions, and other `Item` types alike (one op; type resolved at apply time). Folders MAY recursively remove nested items (AE default). In-use footage or compositions MAY be removed (AE default). The tool MUST refuse to delete `app.project.rootFolder`. Before removal, apply MUST record impact evidence: for folders, `nestedItemCount` (descendant items removed with the folder); for `AVItem` targets, the full `usedInCompIds` array and `usedInCompCount`. Delete MUST NOT remove files from disk.

#### Scenario: Delete footage with full usedIn list

- **WHEN** `delete_project_item` removes a footage or composition item that is used in compositions
- **THEN** the target evidence MUST include the complete `usedInCompIds` list (not truncated) and a matching `usedInCompCount` before the item is removed

#### Scenario: Delete non-empty folder reports nested count

- **WHEN** `delete_project_item` removes a folder that contains nested items
- **THEN** apply MUST proceed (AE recursive remove) and the evidence MUST include `nestedItemCount` reflecting those nested items

#### Scenario: Root folder refused

- **WHEN** a delete selector includes the project root folder id
- **THEN** the tool MUST refuse that delete without removing the root

#### Scenario: No disk deletion

- **WHEN** any project item is deleted through this operation
- **THEN** the tool MUST NOT delete corresponding media files or folders on disk

### Requirement: Authored project state for patch ops

`ae_patch_project` MUST mutate authored project/document state. Panel operations MUST select targets by stable `Item.id` (not by evaluating expressions) and MUST NOT read or write `Property.expression` as part of create, move, or delete. For `set_text_style`, apply MUST read and write the authored / pre-expression `TextDocument` (not post-expression `Property.value` when expressions or keyframes apply). Operator documentation for the tool MUST state this authored / pre-expression contract for the patch vocabulary (including `set_text_style` authored fonts and panel structure ops). Documentation MUST also note that deleting an item that owns layers removes those properties with the item, and that deleting in-use footage may leave expression strings intact while later evaluation fails.

#### Scenario: Move does not rewrite expressions

- **WHEN** `move_project_item` relocates a composition or footage item whose layers (or layers in other comps) have expression strings set
- **THEN** apply MUST change only project-panel placement (`parentFolder`) and MUST NOT modify those layers’ `Property.expression` strings as part of the move

#### Scenario: set_text_style does not bake post-expression TextDocument

- **WHEN** `set_text_style` applies a font change on a layer with an active Source Text expression
- **THEN** apply MUST base the mutation on the pre-expression `TextDocument` and MUST NOT use post-expression `Property.value` as the sole read path for that write

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

### Requirement: Post-apply bind fields on success

A successful `ae_patch_project` apply MUST return updated `fingerprint`, `dirty`, and `revision` suitable for a subsequent guarded `ae_save_project` or patch call. Per-operation results MUST include structured evidence appropriate to each op (text before/after fonts; move before/after `parentFolderId`; create folder identity; delete impact). Operator docs MUST note that agents MAY reuse the returned fingerprint without an immediate `ae_project_context` re-poll when no other mutator intervened.

#### Scenario: Success includes fingerprint and panel evidence

- **WHEN** a batch containing `move_project_item` applies successfully
- **THEN** the response MUST include a new `fingerprint` (and `dirty` / `revision`) and per-target move evidence with before/after `parentFolderId`

### Requirement: Idempotent desired-state ops

Desired-state operations MUST return `already_satisfied` for targets that already match the requested end state without performing a no-op write that changes revision unnecessarily when detectable.

#### Scenario: Repeat Arial patch

- **WHEN** the same successful `set_text_style` font normalization is applied again with a matching fingerprint
- **THEN** each already-normalized target MUST report `already_satisfied` (or equivalent) and MUST NOT be reported as newly `changed`

### Requirement: Broad selector gate

Discovery scopes MUST use explicit enums/id lists (not regex). When a broad scope resolves more targets than a built-in default maximum, apply MUST require an explicit `allowBroadTargetSet` flag or fail closed.

#### Scenario: Broad set requires acknowledgment

- **WHEN** a selector resolves more targets than the built-in default maximum and `allowBroadTargetSet` is not true
- **THEN** the tool MUST refuse before mutation and report the resolved count

### Requirement: Rollback reporting

Apply MUST validate all operations before mutating and run the batch in one undo group. On an unexpected failure after mutation has begun, the server MUST stop further ops, attempt a best-effort undo of the group, and report whether the rollback completed.

#### Scenario: Failure mid-batch

- **WHEN** an operation fails after earlier operations in the same apply batch mutated the project
- **THEN** the response MUST NOT claim overall success and MUST report whether the undo-group rollback completed

### Requirement: Arial normalization acceptance

Given an open project with text layers (including nested comps and mixed visibility flags supported by selectors), agents MUST be able to apply a typed `set_text_style` batch that sets authored/default fonts to a caller-provided font string and MUST receive structured per-target before/after evidence, then leave persistence to `ae_save_project`.

#### Scenario: End-to-end Arial path without eval

- **WHEN** an agent uses context + `ae_patch_project` + save (not `ae_eval_script`) for font normalization on the host test fixture
- **THEN** the apply response MUST report each target as `changed` (with before/after font) or `already_satisfied`, the project MUST remain dirty until save, `ae_project_context` MUST report an advanced revision after a mutating apply, and unsupported/uninspectable runs MUST be reported explicitly rather than silently omitted as success

### Requirement: Rename layer host acceptance

Given a host After Effects session and the committed test fixture (or a disposable copy), agents MUST be able to apply typed `rename_layer` (and id-or-name `set_text_style` targeting) through `ae_patch_project` without `ae_eval_script`, receive post-condition-verified per-target evidence, and compose with `ae_save_project` `save_copy`. These behaviors MUST be covered by host e2e tests gated like existing editing API tests (`describe.skipIf(!hasHost)` / fixture checks).

#### Scenario: End-to-end rename path without eval

- **WHEN** a host e2e test opens the fixture, binds context, applies one or more `rename_layer` ops (including a mustache/`{message_10}`-style `layerName`), and optionally `save_copy`
- **THEN** each intended target MUST report `changed` or `already_satisfied` with verified before/after names, the apply MUST NOT implicitly save, and a mutating apply MUST advance revision/fingerprint

#### Scenario: End-to-end id-or-name set_text_style path

- **WHEN** a host e2e test applies `set_text_style` using unique `compName`/`layerName` (or `compNames`) selectors on the fixture
- **THEN** apply MUST succeed with the same font post-condition evidence rules as the id-based path

#### Scenario: Ambiguous name refused on host

- **WHEN** a host e2e test can construct or use an ambiguous layer or composition name selector for `rename_layer` or `set_text_style`
- **THEN** apply MUST refuse before mutation and return candidates; if the stock fixture cannot express ambiguity, the suite MUST still cover ambiguity via unit tests of the resolve path and MUST document that gap

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

`set_layer_timing` MUST set timing on one layer (layer `target`) using integer frame fields (`startFrame`, `inFrame`, `outFrame` as applicable) converted with the containing composition’s `frameRate`. The op MUST reject payloads that supply only floating-point seconds for those timing fields when frame fields are required by the schema. Optional `stretch` MAY be included with an op-specific name. The op MUST NOT accept `timeRemapEnabled` (or other layer switches); callers MUST use `set_layer_switches` for remapping and other switch toggles.

For every supplied frame field, apply MUST write seconds as `frame / frameRate` and MUST report `changed` only when the post-read satisfies **both**: (1) nearest-integer frame equals the request (`timeToFrame` / equivalent), and (2) the edge is **on-grid** — `abs(seconds * frameRate - frame)` is within a tight implementation epsilon (frame units). When the effective in and out frames after the op are determined (from supplied fields and/or already-matching preserved edges), apply MUST also require that `durationFrames` (`outFrame - inFrame`) equals the expected span from those effective frames. Rounded-frame agreement alone MUST NOT be sufficient for `changed` when an edge is off-grid or `durationFrames` mismatches.

When the timing write runs (not `already_satisfied`), apply MUST snapshot all keyframes on the target layer’s property tree before mutating timing, MUST restore any keyframes whose composition times or values drift after the timing write (AE has no `setKeyTime`; restore MAY rebuild a property’s key timeline from the snapshot), and MUST report `changed` only when every pre-write keyframe’s composition time and authored value still match the snapshot within a tight implementation epsilon. Apply MUST NOT report `changed` when any key time or value remains drifted after restore. UI-equivalent “drag layer in time” (intentionally shifting keyframes with the layer bar) remains out of scope for this op.

Evidence MUST include before/after integer frame fields (`startFrame`, `inFrame`, `outFrame`, derived `durationFrames`) and raw seconds (`startTime`, `inPoint`, `outPoint`), plus stretch when applicable, and MUST include `keyframesPreserved` (boolean). On key-preservation failure, evidence MUST include a compact drift summary (property identity and before/after times) sufficient for agents to see what moved without requiring a full keyframe dump on success. The op MUST NOT save the project and MUST NOT claim persistence-across-reopen or render-contribution proof. Protected-layer product policy is out of scope for this op.

#### Scenario: Frame-exact in/out

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` for a resolvable layer
- **THEN** apply MUST set layer in/out so post-read integer frames match the request and both edges are on-grid

#### Scenario: Exact durationFrames

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` such that the expected span is `outFrame - inFrame`
- **THEN** post-condition success MUST require that re-read `durationFrames` equals that expected span exactly

#### Scenario: Off-grid edge fails post-condition

- **WHEN** after write the re-read seconds for a supplied edge round to the requested frame but are not on-grid within epsilon
- **THEN** apply MUST NOT report `changed` for that target and MUST include actual after frames and seconds in evidence

#### Scenario: Seconds-only timing refused

- **WHEN** the caller omits required frame fields and supplies only second-based timing
- **THEN** validation MUST fail before mutation

#### Scenario: timeRemapEnabled on timing refused

- **WHEN** the caller supplies `timeRemapEnabled` on a `set_layer_timing` operation
- **THEN** validation MUST fail before mutation

#### Scenario: Keyframes preserved across timing write

- **WHEN** `set_layer_timing` successfully changes `startFrame` and/or `inFrame`/`outFrame` on a layer that has keyframes
- **THEN** post-read composition times and authored values for those keyframes MUST match the pre-write snapshot within epsilon and evidence MUST report `keyframesPreserved: true`

#### Scenario: Keyframe drift fails post-condition

- **WHEN** after the timing write (and any restore attempt) a keyframe’s composition time or authored value still differs from the pre-write snapshot beyond epsilon
- **THEN** apply MUST NOT report `changed` for that target and MUST set `keyframesPreserved: false` with a compact drift summary in evidence

#### Scenario: Source slip keeps parent window

- **WHEN** the caller wants the same parent composition in/out span but a different layer `startFrame` (source slip, e.g. nested comp showing source 0–N instead of an offset range)
- **THEN** a single `set_layer_timing` that supplies the new `startFrame` together with the unchanged `inFrame` and `outFrame` MUST be accepted as the documented way to keep that parent window (callers MUST NOT rely on `startFrame` alone when the trim window must stay fixed)

### Requirement: Document set_layer_timing source-slip and keyframe semantics

Operator documentation for `ae_patch_project` / `set_layer_timing` MUST state that successful timing writes preserve keyframe composition times and values (snapshot/restore inside the op; not merely “the op does not call key APIs”), MUST document the source-slip recipe (new `startFrame` plus preserved `inFrame` and `outFrame` in one op), MUST warn that setting `startFrame` alone can let After Effects nudge the trim, and MUST state that UI drag-with-keys is not provided by this op (use `ae_eval_script` until a dedicated typed op exists). A brief caveat MUST note that source slip via `startFrame` assumes time remapping is not driving the visible range. Documentation MUST also state that success requires on-grid edges and exact `durationFrames` (not merely nearest-frame rounding), that evidence includes seconds as well as frames and `keyframesPreserved`, and that save/reopen plus optional boundary-frame contribution checks remain agent-composed outside this op.

#### Scenario: mcp-tools documents slip vs keys

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST cover verified keyframe preservation, the slip payload (start + preserved in/out), the start-alone trim warning, and that drag-with-keys is out of scope for this op

#### Scenario: mcp-tools documents on-grid exactness

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `set_layer_timing`
- **THEN** the documentation MUST state on-grid / exact-durationFrames post-conditions, seconds-in-evidence, and that persistence/render probes are outside the op

### Requirement: set_layer_timing on-grid evidence contract

Per-target evidence for `set_layer_timing` MUST expose both integer frame fields and raw layer timing seconds so agents can detect half-frame / off-grid edges without a separate eval. `already_satisfied` MUST apply only when every supplied field already matches on integer frames and is on-grid (and durationFrames matches when in/out are in scope).

#### Scenario: Evidence includes seconds

- **WHEN** `set_layer_timing` returns target evidence after a write attempt
- **THEN** `before` and `after` MUST include `startTime`, `inPoint`, and `outPoint` seconds alongside integer frame fields and `durationFrames`

### Requirement: set_layer_timing keyframe snapshot evidence

Per-target evidence for `set_layer_timing` MUST expose `keyframesPreserved` so agents can trust key-time preservation without a separate inspect pass on the success path. When preservation fails, evidence MUST include a compact `keyframeDrift` (or equivalent) summary identifying at least property path and before/after times for drifted keys (implementation MAY cap the list length and mark truncation).

#### Scenario: Success marks keys preserved

- **WHEN** `set_layer_timing` reports `changed` or `already_satisfied` for a target
- **THEN** evidence MUST include `keyframesPreserved: true`

#### Scenario: Failure includes drift summary

- **WHEN** `set_layer_timing` fails because keyframes could not be preserved
- **THEN** evidence MUST include `keyframesPreserved: false` and a compact drift summary with before/after times

### Requirement: Set layer switches operation

`set_layer_switches` MUST set caller-supplied timeline/layer switch booleans on exactly one layer identified by layer `target` (id-or-name inspect parity). The payload MUST include a nested `switches` object that accepts only an explicit allowlist of boolean keys: `enabled`, `audioEnabled`, `solo`, `shy`, `locked`, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlending`, `motionBlur`, and `timeRemapEnabled`. Validation MUST require at least one allowlisted key and MUST reject unknown keys before mutation. Apply MUST write only keys present in `switches` and MUST NOT intentionally change omitted switches or non-switch layer state (timing, sources, effects, transforms, masks, parenting, expressions, names, or index). Per-target evidence MUST include a full switch-snapshot `before` and `after` covering the allowlist keys readable on that layer. Post-condition success MUST require that each supplied key’s re-read value equals the request; unspecified keys MUST NOT affect post-condition success. Already-matching supplied keys MUST report `already_satisfied` when detectable without a no-op write that changes revision unnecessarily. Inapplicable attributes for a layer type MUST fail that target (with actual `after` when readable), not silently skip. The op MUST NOT save the project. Write ownership of `timeRemapEnabled` MUST live only on this op (not on `set_layer_timing`).

#### Scenario: Disable video preserving audio via omit

- **WHEN** `set_layer_switches` is applied with `switches.enabled` false and `audioEnabled` omitted on a resolvable AV layer that currently has `audioEnabled` true
- **THEN** apply MUST set `enabled` false, MUST leave `audioEnabled` true, MUST report full switch-snapshot before/after including both keys when readable, and MUST NOT intentionally alter timing, source, or effects

#### Scenario: Set by unique names

- **WHEN** `set_layer_switches` uses unique `target.compName` and `target.layerName` with a valid `switches` bag
- **THEN** apply MUST resolve that single layer and proceed under the same post-condition rules as id targeting

#### Scenario: Empty or unknown switches refused

- **WHEN** `switches` is empty or contains a key outside the allowlist
- **THEN** validation MUST fail before any mutation

#### Scenario: Ambiguous layer name refused

- **WHEN** `target.layerName` matches more than one layer in the resolved composition
- **THEN** the tool MUST refuse before mutation and MUST include a candidate list (at least `id`, `index`, and `name`)

#### Scenario: Already satisfied

- **WHEN** every supplied switch already equals the live value
- **THEN** that target MUST report `already_satisfied` with full before/after snapshots and MUST NOT be reported as newly `changed`

#### Scenario: Post-condition mismatch is failure with actual after

- **WHEN** a write completes but a supplied switch’s re-read value does not match the request
- **THEN** that target MUST be reported as `failed`, evidence `after` MUST contain the actual re-read switch snapshot when readable, and the apply response MUST NOT claim overall success

#### Scenario: Multi-op batch

- **WHEN** the caller supplies several `set_layer_switches` operations with distinct targets in one apply
- **THEN** the tool MUST apply them in one undo group (when mutation is required) and return per-operation evidence for each

#### Scenario: No implicit save

- **WHEN** `set_layer_switches` apply completes
- **THEN** the tool MUST NOT save the project to disk as a side effect of this op

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

### Requirement: Set layer transform operation

`set_layer_transform` MUST set caller-supplied authored Transform values on exactly one layer identified by layer `target` (id-or-name inspect parity). The payload MUST include a nested `transform` object that accepts only an explicit allowlist of keys: `anchorPoint` (number array), `position` (number array), `scale` (number array), `rotation` (number, degrees), and `opacity` (number). Validation MUST require at least one allowlisted key and MUST reject unknown keys before mutation. Spatial arrays MUST have length 2 or 3. Apply MUST write only keys present in `transform` and MUST NOT intentionally change omitted transform keys or non-transform layer state (timing, sources, effects, masks, parenting, switches, expressions, names, or index). The op MUST NOT accept an expected-current / `if_match` bag; stale-project refuse remains the existing `ae_patch_project` `project.path` / `project.fingerprint` guards. Per-target evidence MUST include a full transform-snapshot `before` and `after` covering the allowlist keys readable on that layer, using actual authored/pre-expression numeric values (not boolean flags and not post-expression evaluated samples). Post-condition success MUST require that each supplied `transform` key’s re-read authored/pre-expression value equals the request within epsilon; unspecified keys MUST NOT affect post-condition success. Already-matching supplied keys MUST report `already_satisfied` when detectable without an unnecessary write. If a supplied property has keyframes (`numKeys > 0`), apply MUST refuse that target before write with a clear message. Inapplicable attributes for a layer type MUST fail that target (with actual `after` when readable), not silently skip. The op MUST NOT save the project and MUST NOT claim pixel/render proof. The op MUST NOT accept a generic untyped property/matchName setter bag.

#### Scenario: Slot repair sets Position to match new Anchor

- **WHEN** `set_layer_transform` is applied with `transform.position` `[300, 550]` on a resolvable layer whose authored Anchor Point is already `[300, 550]` and Position is `[960, 540]`
- **THEN** apply MUST set Position to `[300, 550]` within epsilon, MUST leave omitted transform keys unchanged, MUST report actual numeric before/after snapshots including both Position and Anchor Point when readable, and MUST report `changed` only after post-condition success

#### Scenario: Partial bag preserves omitted keys

- **WHEN** `set_layer_transform` supplies only `transform.opacity` `50`
- **THEN** apply MUST change opacity to 50 within epsilon and MUST NOT intentionally alter Anchor Point, Position, Scale, or Rotation

#### Scenario: Empty or unknown transform refused

- **WHEN** `transform` is empty or contains a key outside the allowlist
- **THEN** validation MUST fail before any mutation

#### Scenario: Ambiguous layer name refused

- **WHEN** `target.layerName` matches more than one layer in the resolved composition
- **THEN** the tool MUST refuse before mutation and MUST include a candidate list (at least `id`, `index`, and `name`)

#### Scenario: Already satisfied

- **WHEN** every supplied `transform` key already equals the live authored value within epsilon
- **THEN** that target MUST report `already_satisfied` with full before/after snapshots and MUST NOT be reported as newly `changed`

#### Scenario: Keyframed property refused

- **WHEN** a supplied transform property has one or more keyframes
- **THEN** apply MUST refuse that target before write and MUST NOT report `changed`

#### Scenario: Post-condition mismatch is failure with actual after

- **WHEN** a write completes but a supplied transform key’s re-read authored value does not match the request within epsilon
- **THEN** that target MUST be reported as `failed`, evidence `after` MUST contain the actual re-read transform snapshot when readable, and the apply response MUST NOT claim overall success

#### Scenario: No implicit save

- **WHEN** `set_layer_transform` apply completes
- **THEN** the tool MUST NOT save the project to disk as a side effect of this op

#### Scenario: Generic property setter rejected

- **WHEN** the caller attempts a generic untyped property-value or matchName bag as a patch op in place of `set_layer_transform`
- **THEN** validation MUST reject it as outside the closed vocabulary

### Requirement: Reset layer surface operation

`reset_layer_surface` MUST clear caller-selected authored surface features on one layer (layer `target`): keyframes, effects, masks, layer styles, markers, track matte, parenting, and/or listed switches, via explicit boolean flags in the op payload. Optional `resetTransforms` MUST reset authored 2D Transform baseline properties (`anchorPoint`, `position`, `scale`, `rotation`, `opacity`) to AE defaults for that layer/source when true — at minimum Anchor Point to source center when readable, Position to composition center when readable, Scale to 100%, Rotation to 0, Opacity to 100 — and MUST verify those authored/pre-expression values via post-condition re-read. When `resetTransforms` is true, evidence MUST include actual authored numeric transform before/after values for the baseline keys and MUST NOT use a `cleared.transforms` boolean as proof of transform reset. `resetTransforms` MUST NOT clear expressions; optional `clearExpressions` remains a separate flag that MUST clear expressions when true. The op MUST NOT claim pixel-identical render proof. Evidence MUST report which non-transform categories were cleared and verified post-counts/flags, and MUST report transform value evidence when `resetTransforms` is true. If transform reset was requested and verification fails, the target MUST fail (MUST NOT succeed solely because other surface categories cleared).

#### Scenario: Clear effects and keys

- **WHEN** flags request clearing effects and keyframes
- **THEN** apply MUST remove those features and post-read MUST show zero effects and no remaining keys on cleared properties when readable

#### Scenario: resetTransforms applies and verifies defaults with value evidence

- **WHEN** `resetTransforms` is true on a resolvable layer whose Position is not at composition center
- **THEN** apply MUST write AE default authored transform values for the 2D baseline, MUST re-read those authored values, MUST include actual numeric transform before/after in evidence, MUST NOT emit `cleared.transforms` as the proof signal, and MUST report target success for the transform work only when defaults match within epsilon

#### Scenario: resetTransforms must not lie

- **WHEN** `resetTransforms` is true but authored Position (or another baseline key) remains different from the AE default after the op’s transform write attempt
- **THEN** apply MUST NOT treat the target as successful solely because other surface categories cleared, and evidence MUST still expose the actual authored after transform snapshot when readable

#### Scenario: resetTransforms does not clear expressions

- **WHEN** `resetTransforms` is true and `clearExpressions` is false
- **THEN** apply MUST NOT clear property expressions as a side effect of transform reset

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

Layer-targeting control-plane ops (`set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`) MUST use the same id-or-name layer `target` rules as `rename_layer`. These ops MUST report `changed` only after post-condition re-read success and MUST use `already_satisfied` when the desired state is already present and detectable.

#### Scenario: Ambiguous layer name refused

- **WHEN** a layer-targeting control-plane op uses an ambiguous `layerName`
- **THEN** the tool MUST refuse before mutation with a candidate list
