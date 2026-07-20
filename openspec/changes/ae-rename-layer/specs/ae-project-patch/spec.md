## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, and `rename_layer`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

## ADDED Requirements

### Requirement: Id-or-name targeting for layer patch selectors

Layer-targeting patch operations MUST resolve compositions and layers with the same id-or-name rules as `ae_get_layer`: exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName`) per explicit layer target; name matches MUST be case-sensitive exact matches; ambiguous names MUST refuse before mutation with candidate lists (comps: at least `id` and `name`; layers: at least `id`, `index`, and `name`); not-found MUST fail clearly. This MUST apply to `rename_layer.target` and to each entry of `set_text_style` when `selector.kind` is `layers`. For `set_text_style` when `selector.kind` is `comps`, the selector MUST accept `compIds` and/or `compNames` (union; at least one non-empty), resolve each name uniquely under the same ambiguity rules, and MUST continue to accept existing `compIds`-only payloads. `selector.kind` `all_text_layers` is unchanged. Existing `set_text_style` payloads that use only `compId`+`layerId` layer refs or only `compIds` MUST remain valid.

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
