## Purpose

Declarative apply-only mutation tool with typed ops (`set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`), fingerprint guards, undo grouping, and structured before/after evidence.

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
