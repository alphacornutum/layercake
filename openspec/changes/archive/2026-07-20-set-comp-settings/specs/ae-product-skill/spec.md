## ADDED Requirements

### Requirement: Document composition settings inventory and patch

The product skill MUST document that `ae_list_comps` exposes composition settings fields (`width`, `height`, `pixelAspect`, `frameRate`, `durationFrames`, `displayStartFrame`, work-area frames, `renderer`, and composition `switches`) for planning. The skill MUST document `set_comp_settings` as the typed `ae_patch_project` op for those settings: nested `target` with comps-only `compId` XOR `compName`, nested partial `settings` bag (omit key = preserve; optional nested `settings.switches`), integer-frame evidence, work-area clamp-on-duration-shrink vs fail-on-explicit-overrun, and no expected-current bag. The skill MUST tell agents to place `set_comp_settings` before `set_layer_timing` in the same batch when both composition settings (especially frame rate) and layer timing change.

#### Scenario: Skill mentions list settings and set_comp_settings

- **WHEN** an agent reads the product skill after this change ships
- **THEN** the skill MUST mention composition settings on `ae_list_comps` and MUST document `set_comp_settings` with the batch-order guidance

## MODIFIED Requirements

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, layer source replace, frame-exact layer timing, layer switches (`set_layer_switches`), composition settings (`set_comp_settings`), property expressions, layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. The skill MUST state that `timeRemapEnabled` is set via `set_layer_switches`, not `set_layer_timing`. For `set_property_expression`, the skill MUST prefer `matchNames` copied from `ae_get_layer` and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops (including `set_layer_switches` and `set_comp_settings`) and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools
