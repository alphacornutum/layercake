## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Typed operation vocabulary

`ae_patch_project` MUST accept operations only through a closed, typed vocabulary. The vocabulary MUST include `set_text_style`, `create_folder`, `move_project_item`, `delete_project_item`, `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, and `safe_delete_project_item`. Arbitrary ExtendScript or a generic untyped property setter MUST NOT be accepted inside this tool.

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

- **WHEN** the caller supplies a valid `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, or `safe_delete_project_item` operation
- **THEN** the tool MUST accept it through the same Zod-validated operations array as other typed ops

### Requirement: Id-or-name targeting for layer patch selectors

Layer-targeting patch operations MUST resolve compositions and layers with the same id-or-name rules as `ae_get_layer`: exactly one composition selector (`compId` or `compName`) and exactly one layer selector (`layerId` or `layerName`) per explicit layer target; name matches MUST be case-sensitive exact matches; ambiguous names MUST refuse before mutation with candidate lists (comps: at least `id` and `name`; layers: at least `id`, `index`, and `name`); not-found MUST fail clearly. This MUST apply to every layer-targeting patch op that uses a layer `target` or per-layer selector — including `rename_layer.target`, `set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `reset_layer_surface`, `delete_layer`, and each entry of `set_text_style` when `selector.kind` is `layers`. LayerCake MUST NOT introduce an ids-only targeting exception for a new layer-targeting op unless a superseding ADR records that exception. For `set_text_style` when `selector.kind` is `comps`, the selector MUST accept `compIds` and/or `compNames` (union; at least one non-empty), resolve each name uniquely under the same ambiguity rules, and MUST continue to accept existing `compIds`-only payloads. `selector.kind` `all_text_layers` is unchanged. Existing `set_text_style` payloads that use only `compId`+`layerId` layer refs or only `compIds` MUST remain valid.

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

### Requirement: Set layer timing operation

`set_layer_timing` MUST set timing on one layer (layer `target`) using integer frame fields (`startFrame`, `inFrame`, `outFrame` as applicable) converted with the containing composition’s `frameRate`. The op MUST reject payloads that supply only floating-point seconds for those timing fields when frame fields are required by the schema. Optional `stretch` MAY be included with an op-specific name. The op MUST NOT accept `timeRemapEnabled` (or other layer switches); callers MUST use `set_layer_switches` for remapping and other switch toggles. Evidence MUST include before/after frame fields (and stretch when applicable). Protected-layer product policy is out of scope for this op.

#### Scenario: Frame-exact in/out

- **WHEN** `set_layer_timing` supplies `inFrame` and `outFrame` for a resolvable layer
- **THEN** apply MUST set layer in/out so post-read integer frames match the request

#### Scenario: Seconds-only timing refused

- **WHEN** the caller omits required frame fields and supplies only second-based timing
- **THEN** validation MUST fail before mutation

#### Scenario: timeRemapEnabled on timing refused

- **WHEN** the caller supplies `timeRemapEnabled` on a `set_layer_timing` operation
- **THEN** validation MUST fail before mutation

### Requirement: Control-plane ops use post-conditions and layer target parity

Layer-targeting control-plane ops (`set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `reset_layer_surface`, `delete_layer`) MUST use the same id-or-name layer `target` rules as `rename_layer`. These ops MUST report `changed` only after post-condition re-read success and MUST use `already_satisfied` when the desired state is already present and detectable.

#### Scenario: Ambiguous layer name refused

- **WHEN** a layer-targeting control-plane op uses an ambiguous `layerName`
- **THEN** the tool MUST refuse before mutation with a candidate list
