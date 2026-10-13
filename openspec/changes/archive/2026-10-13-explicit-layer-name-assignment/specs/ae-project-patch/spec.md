# Spec Delta

## MODIFIED Requirements

### Requirement: Rename layer operation

`rename_layer` MUST ensure exactly one timeline layer has the caller-supplied `layerName` string as its explicitly assigned name. The operation MUST accept a nested `target` with exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName` for lookup of the current layer). Name matches MUST be case-sensitive exact matches. The desired `layerName` MUST be applied as an opaque string with no normalization, truncation, or brace stripping (including values such as `{message_01}` and `{message_10}`). The operation MUST change only the layer’s name assignment (not Source Text, styles, expressions, keyframes, effects, transforms, masks, parenting, track mattes, source references, layer order, enabled/shy/locked state, or timing). Batch renames MUST be expressed as multiple `rename_layer` operations in one `operations` array. The op MUST NOT accept broad multi-layer selectors (for example `all_text_layers`) or a shared name applied to many layers in one op.

#### Scenario: Rename by ids

- **WHEN** `rename_layer` is applied with resolvable `target.compId` and `target.layerId` and a `layerName` distinct from the current name
- **THEN** apply MUST set that layer’s name to `layerName`, verify it is explicitly assigned, and per-target evidence MUST include before/after name-assignment state plus resolved `compId` and `layerId`

#### Scenario: Rename by unique names

- **WHEN** `rename_layer` is applied with resolvable unique `target.compName` and `target.layerName` (lookup) and a desired `layerName`
- **THEN** apply MUST set that layer’s explicit name and evidence MUST report the resolved ids

#### Scenario: Opaque mustache names preserved

- **WHEN** the desired `layerName` is `{message_10}` or another mustache form with zero-padded counters
- **THEN** the live layer name after a successful change MUST equal that string exactly and be explicitly assigned

#### Scenario: Inherited matching name becomes explicit

- **WHEN** the resolved layer displays the desired `layerName` but its name is inherited from its source
- **THEN** apply MUST assign the desired name explicitly, report `changed`, and verify `isNameSet` is true even though the visible name text did not change

#### Scenario: Already satisfied

- **WHEN** the resolved layer’s explicit name already equals the desired `layerName`
- **THEN** that target MUST report `already_satisfied` without an unnecessary write that changes revision

#### Scenario: Assignment evidence distinguishes name state

- **WHEN** `rename_layer` returns before/after evidence
- **THEN** evidence MUST include the visible `name` and `isNameSet` state for both reads, MUST prove `after.isNameSet` is true for a successful result, and SHOULD include `isNameFromSource` and `sourceId` when AE exposes them

#### Scenario: Explicit name survives source replacement

- **WHEN** a layer with a successful explicit `rename_layer` result has its source replaced with differently named footage
- **THEN** the layer MUST retain the requested `layerName` and its source link MUST point to the replacement source

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

For every typed patch operation that mutates project state, apply MUST re-read the affected live field(s) after the write and MUST report `changed` only when the post-condition matches the request. If the post-condition does not match, that target MUST be reported as `failed` (or equivalent non-success) and the batch MUST NOT claim overall success. When a target is `failed` (including post-condition mismatch) and a post-read is possible, evidence MUST include the actual re-read `after` state in the same shape as a successful target — MUST NOT omit `after` or echo the requested value as if applied. If the target cannot be read after failure, evidence MAY omit `after` and MUST explain that in the target message. Idempotent already-matching state MUST use `already_satisfied` (or equivalent) without claiming a fresh change. This rule MUST apply to `rename_layer` (live `layer.name` equals desired `layerName` and `isNameSet` is true) and MUST be applied to existing ops in this capability (`set_text_style` fonts, `move_project_item` parent folder, `create_folder` identity/placement, `delete_project_item` absence) where post-read verification is not already guaranteed.

#### Scenario: Rename post-condition mismatch is failure with actual after

- **WHEN** a `rename_layer` write completes but a subsequent read shows either a name different from the requested `layerName` or `isNameSet` is not true
- **THEN** that target MUST be reported as `failed`, evidence `after` MUST contain the actual re-read name-assignment state when readable, and the apply response MUST NOT claim overall success

#### Scenario: Successful rename verifies name

- **WHEN** `rename_layer` succeeds
- **THEN** evidence `after` MUST reflect a re-read name equal to the requested `layerName` and `isNameSet` equal to true

#### Scenario: Existing ops honor post-condition

- **WHEN** `set_text_style`, `move_project_item`, `create_folder`, or `delete_project_item` mutates a target
- **THEN** apply MUST confirm the requested end state via post-read (fonts / `parentFolderId` / created folder fields / item absent) before reporting `changed` success for that target

#### Scenario: Failed existing op still reports actual after

- **WHEN** a mutating patch target fails post-condition verification for an existing op
- **THEN** that target’s evidence MUST include the actual re-read `after` fields when readable
