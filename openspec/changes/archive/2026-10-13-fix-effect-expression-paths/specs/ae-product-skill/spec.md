## MODIFIED Requirements

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, text layer creation (`create_text`), layer source replace, frame-exact layer timing, layer switches (`set_layer_switches`), composition settings (`set_comp_settings`), property expressions, authored layer transforms (`set_layer_transform`), layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. The skill MUST state that `timeRemapEnabled` is set via `set_layer_switches`, not `set_layer_timing`. The skill MUST state that `reset_layer_surface` `resetTransforms` applies and verifies AE default authored transform values with value evidence (and MUST NOT be treated as proof of arbitrary slot geometry or as clearing expressions). For `set_property_expression`, the skill MUST prefer matchName segments from `ae_get_layer` where they uniquely identify the target, MUST document that effect parameter paths require the parent effect instance segment (matchName when unique on the layer, display name when multiple effects share the same matchName), MUST give a Slider Control example, and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops (including `set_layer_switches`, `set_comp_settings`, `set_layer_transform`, and `create_text`) and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill documents effect expression paths

- **WHEN** an agent reads the product skill after this change ships
- **THEN** the skill MUST explain the effect-instance segment rule for `set_property_expression` and MUST include a Slider Control path example so agents need not fall back to raw eval for that case

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools
