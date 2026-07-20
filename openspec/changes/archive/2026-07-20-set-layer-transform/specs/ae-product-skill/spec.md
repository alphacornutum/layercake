## ADDED Requirements

### Requirement: Document set_layer_transform

The product skill MUST document `set_layer_transform` as the typed `ae_patch_project` op for authored 2D Transform values (`anchorPoint`, `position`, `scale`, `rotation`, `opacity`). The skill MUST state that callers supply only keys to change in a nested `transform` bag (omit key = preserve), that evidence includes actual authored/pre-expression numeric before/after transform snapshots, and that `changed` requires post-condition re-read success. The skill MUST tell agents to prefer this op over `ae_eval_script` for routine slot/transform repair after source replace (for example setting Position to the new Anchor Point), and MUST remind agents to use matching `project.fingerprint` on `ae_patch_project` for stale-project refuse. The skill MUST note that `reset_layer_surface` `resetTransforms` resets to AE defaults (typically Position at composition center), returns authored transform value evidence (not a transforms boolean), does not clear expressions (`clearExpressions` is separate), and may not equal “match new Anchor Point” — agents SHOULD use `set_layer_transform` with explicit numbers for that repair. The skill MUST warn that keyframed transform properties are refused until keys are cleared, and that authored success may still differ from post-expression on-screen values.

#### Scenario: Skill mentions set_layer_transform and slot repair

- **WHEN** an agent reads the product skill after `set_layer_transform` ships
- **THEN** the skill MUST mention `set_layer_transform`, MUST note omit-to-preserve semantics and authored numeric value evidence, MUST NOT document an op-level expected-current bag, MUST mention fingerprint guards for stale apply, and MUST steer slot repair after replace toward explicit `set_layer_transform` rather than assuming `resetTransforms` alone

## MODIFIED Requirements

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, layer source replace, frame-exact layer timing, layer switches (`set_layer_switches`), composition settings (`set_comp_settings`), property expressions, authored layer transforms (`set_layer_transform`), layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. The skill MUST state that `timeRemapEnabled` is set via `set_layer_switches`, not `set_layer_timing`. The skill MUST state that `reset_layer_surface` `resetTransforms` applies and verifies AE default authored transform values with value evidence (and MUST NOT be treated as proof of arbitrary slot geometry or as clearing expressions). For `set_property_expression`, the skill MUST prefer `matchNames` copied from `ae_get_layer` and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops (including `set_layer_switches`, `set_comp_settings`, and `set_layer_transform`) and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools
