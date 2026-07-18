## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, and `delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

## ADDED Requirements

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

`ae_patch_project` MUST mutate authored project/document state. Panel operations MUST select targets by stable `Item.id` (not by evaluating expressions) and MUST NOT read or write `Property.expression` as part of create, move, or delete. Operator documentation for the tool MUST state this authored / pre-expression contract for the patch vocabulary (including `set_text_style` authored fonts and panel structure ops). Documentation MUST also note that deleting an item that owns layers removes those properties with the item, and that deleting in-use footage may leave expression strings intact while later evaluation fails.

#### Scenario: Move does not rewrite expressions

- **WHEN** `move_project_item` relocates a composition or footage item whose layers (or layers in other comps) have expression strings set
- **THEN** apply MUST change only project-panel placement (`parentFolder`) and MUST NOT modify those layers’ `Property.expression` strings as part of the move

### Requirement: Post-apply bind fields on success

A successful `ae_patch_project` apply MUST return updated `fingerprint`, `dirty`, and `revision` suitable for a subsequent guarded `ae_save_project` or patch call. Per-operation results MUST include structured evidence appropriate to each op (text before/after fonts; move before/after `parentFolderId`; create folder identity; delete impact). Operator docs MUST note that agents MAY reuse the returned fingerprint without an immediate `ae_project_context` re-poll when no other mutator intervened.

#### Scenario: Success includes fingerprint and panel evidence

- **WHEN** a batch containing `move_project_item` applies successfully
- **THEN** the response MUST include a new `fingerprint` (and `dirty` / `revision`) and per-target move evidence with before/after `parentFolderId`
