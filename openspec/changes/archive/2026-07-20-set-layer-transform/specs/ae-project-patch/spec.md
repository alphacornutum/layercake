## ADDED Requirements

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

## MODIFIED Requirements

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
- **THEN** apply MUST NOT intentionally change unspecified text attributes such as size, fill, stroke, tracking, or text content

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

### Requirement: Control-plane ops use post-conditions and layer target parity

Layer-targeting control-plane ops (`set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`) MUST use the same id-or-name layer `target` rules as `rename_layer`. These ops MUST report `changed` only after post-condition re-read success and MUST use `already_satisfied` when the desired state is already present and detectable.

#### Scenario: Ambiguous layer name refused

- **WHEN** a layer-targeting control-plane op uses an ambiguous `layerName`
- **THEN** the tool MUST refuse before mutation with a candidate list
