## ADDED Requirements

### Requirement: Document create_text and point↔box recreate workflow

The product skill MUST tell agents to prefer typed `ae_patch_project` `create_text` over `ae_eval_script` when creating horizontal point or box text layers. The skill MUST state that `TextDocument.boxText` / `pointText` are read-only in After Effects and that LayerCake has no in-place layout convert op. The skill MUST document detecting layout via `ae_get_layer` (`extended` / `full`) SourceText projection (`boxText` / `pointText`), then changing layout by creating a new layer with the other `layout`, copying needed transform / timing / switches / name / index with typed ops, and `delete_layer` on the old layer — and MUST warn that the new layer has a new `Layer.id` and that effects, masks, parenting, expressions, and Source Text keyframes are not transferred by that recipe. The skill MUST state that point→box requires an intentional `boxTextSize` (no AE default inferred from point text). The skill MUST note optional `name` and optional `style` on `create_text` (style allowlist shared with `set_text_style`).

#### Scenario: Skill documents create_text

- **WHEN** an agent reads the product skill after `create_text` ships
- **THEN** the skill MUST mention `create_text` with `layout` `point` | `box` and MUST tell agents to prefer it over raw eval for creating those layers

#### Scenario: Skill documents convert as recreate

- **WHEN** an agent reads the product skill seeking to convert point↔box text
- **THEN** the skill MUST describe the inspect → `create_text` → copy typed state → `delete_layer` recipe and MUST warn that `Layer.id` changes

### Requirement: Document optional create names

The product skill MUST state that typed create patch ops (`create_folder`, `create_solid`, `create_text`, and future `create_*`) treat `name` as optional: omit keeps the host/AE default name for that create path; supply sets an opaque string after create; evidence returns the final `name`. The skill MAY note that explicit names remain useful for panel structure even when omit is allowed.

#### Scenario: Skill mentions optional create name

- **WHEN** an agent reads the product skill after optional create names ship
- **THEN** the skill MUST state that create ops may omit `name` and still succeed with a host-default name returned in evidence

## MODIFIED Requirements

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, text layer creation (`create_text`), layer source replace, frame-exact layer timing, layer switches (`set_layer_switches`), composition settings (`set_comp_settings`), property expressions, authored layer transforms (`set_layer_transform`), layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. The skill MUST state that `timeRemapEnabled` is set via `set_layer_switches`, not `set_layer_timing`. The skill MUST state that `reset_layer_surface` `resetTransforms` applies and verifies AE default authored transform values with value evidence (and MUST NOT be treated as proof of arbitrary slot geometry or as clearing expressions). For `set_property_expression`, the skill MUST prefer `matchNames` copied from `ae_get_layer` and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops (including `set_layer_switches`, `set_comp_settings`, `set_layer_transform`, and `create_text`) and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools
