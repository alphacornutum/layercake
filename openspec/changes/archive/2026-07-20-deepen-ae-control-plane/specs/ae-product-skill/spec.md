## ADDED Requirements

### Requirement: Document control-plane inventory and refs

The product skill MUST document the richer `ae_list_comps` layer control-plane fields (switches, parent/matte ids, frame timing, Solid `footageKind`) and MUST document `ae_get_item_refs` as the read-only inbound-reference inspect for cleanup planning. The skill MUST state that `unknownRefsPossible: true` means agents MUST NOT treat the item as safe to delete.

#### Scenario: Skill mentions item refs and list fields

- **WHEN** an agent reads the product skill after this change ships
- **THEN** the skill MUST mention `ae_get_item_refs` and MUST note frame timing / Solid source kind on `ae_list_comps` layers

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, layer source replace, frame-exact layer timing, property expressions, layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. For `set_property_expression`, the skill MUST prefer `matchNames` copied from `ae_get_layer` and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools

### Requirement: Document authored vs evaluated inspect samples

The product skill MUST state that `ae_get_layer` `extended`/`full` may include `authoredValue` and `evaluatedValue` for transform properties, and that wrapper purity checks MUST use authored/pre-expression samples, not post-expression Scale alone.

#### Scenario: Skill warns on post-expression Scale

- **WHEN** an agent reads the product skill after dual transform samples ship
- **THEN** the skill MUST warn not to treat post-expression Scale as authored wrapper state
