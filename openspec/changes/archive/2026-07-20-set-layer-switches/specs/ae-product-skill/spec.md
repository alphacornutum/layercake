## ADDED Requirements

### Requirement: Document set_layer_switches

The product skill MUST document `set_layer_switches` as the typed `ae_patch_project` op for timeline/layer switches. The skill MUST state that callers supply only the switches to change in a nested `switches` bag, that omitted switches and non-switch layer state are preserved, that evidence includes a full switch snapshot before/after, and that `timeRemapEnabled` is written via `set_layer_switches` (not `set_layer_timing`). The skill MUST tell agents to prefer this op over `ae_eval_script` for routine switch toggles (for example disabling video while leaving audio enabled).

#### Scenario: Skill mentions set_layer_switches and remap ownership

- **WHEN** an agent reads the product skill after `set_layer_switches` ships
- **THEN** the skill MUST mention `set_layer_switches`, MUST note omit-to-preserve semantics and full switch evidence, and MUST state that `timeRemapEnabled` belongs on switches rather than timing

## MODIFIED Requirements

### Requirement: Document guarded editing workflow

The product skill MUST document the safe mutation workflow: host check → open → `ae_project_context` bind → optional summary → inventory as needed → optional `ae_save_project` `create_backup` → `ae_patch_project` apply → use returned fingerprint (or re-bind context if another mutator may have run) → `ae_save_project` `save_copy`. The skill MUST state that agents MAY `save_copy` (or otherwise work on a copy) before mutating when the original project file must remain pristine. The skill MUST state that `ae_eval_script` bypasses typed safety and MUST warn not to open over another project without an explicit `ae_close_project` (or save) first. The skill MUST tell agents to prefer typed patch over raw eval for routine text-style fixes, layer renames (`rename_layer`), layer switch toggles (`set_layer_switches`), and Project panel create/move/delete (`create_folder`, `move_project_item`, `delete_project_item`). The skill MUST state that **all** layer-targeting patch ops (`rename_layer`, `set_layer_switches`, other control-plane layer `target` ops, and `set_text_style` layer/comp selectors) accept id or unique name with the same ambiguity rules as inspect, that ambiguous names refuse with candidates, and that agents SHOULD prefer stable ids when names may collide — with no ids-only exceptions for new ops. Panel item ops remain `Item.id`-based. The skill MUST note that delete follows After Effects defaults (recursive folder remove; in-use items may be deleted), that impact evidence includes nested counts and full `usedInCompIds`, that patch mutates authored / pre-expression project state without rewriting expression strings as a side effect of panel ops, and that successful patch targets include post-condition-verified before/after evidence. The skill MUST state that `set_text_style` evidence uses authored `fonts` for post-condition success and may include `evaluatedFonts` (post-expression); when authored matches but evaluated still differs, agents SHOULD patch expression source layers (for example a `{font}` controller) before or with consumers so on-screen results update.

#### Scenario: Skill mentions patch and save

- **WHEN** an agent reads the product skill after this capability ships
- **THEN** the skill body MUST mention `ae_project_context`, `ae_patch_project`, and `ae_save_project` and MUST tell agents to prefer typed patch over raw eval for routine fixes

#### Scenario: Skill documents panel ops and fingerprint reuse

- **WHEN** an agent reads the product skill after panel ops ship
- **THEN** the skill MUST mention `create_folder`, `move_project_item`, and `delete_project_item`, MUST warn about recursive folder delete and in-use removal, and MUST state that a successful patch response’s fingerprint MAY be reused for the next save when no other mutator intervened

#### Scenario: Skill documents rename_layer and copy-first option

- **WHEN** an agent reads the product skill after `rename_layer` ships
- **THEN** the skill MUST mention `rename_layer`, MUST tell agents to prefer it over `ae_eval_script` for layer renames, and MUST note that agents MAY `save_copy` before mutating when the original must stay pristine

#### Scenario: Skill documents id-or-name layer patch targeting

- **WHEN** an agent reads the product skill after id-or-name patch targeting ships
- **THEN** the skill MUST state that all layer-targeting patch ops accept id or unique name, with ambiguous names refused, and MUST recommend preferring ids when names may collide

#### Scenario: Skill documents dual font evidence and expression-linked order

- **WHEN** an agent reads the product skill after dual font evidence ships
- **THEN** the skill MUST state that `set_text_style` verifies authored `fonts`, MAY report `evaluatedFonts`, and MUST advise patching expression source layers when evaluated fonts still differ after an authored success

### Requirement: Document control-plane patch ops and safe delete

The product skill MUST tell agents to prefer typed `ae_patch_project` ops over `ae_eval_script` for: project-item rename, layer reorder, solid creation, layer source replace, frame-exact layer timing, layer switches (`set_layer_switches`), property expressions, layer surface reset, layer delete, and guarded cleanup via `safe_delete_project_item`. The skill MUST state that `timeRemapEnabled` is set via `set_layer_switches`, not `set_layer_timing`. For `set_property_expression`, the skill MUST prefer `matchNames` copied from `ae_get_layer` and MAY document nexrender-style `propertyPath` (`.` / `->`) as an alternative; exactly one selector. The skill MUST contrast `safe_delete_project_item` (refuse in-use / unknown refs; empty folders only) with permissive `delete_project_item`. The skill MUST state that Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility PASS criteria, and `main`/`config` reachability policy remain agent/domain concerns outside LayerCake.

#### Scenario: Skill prefers typed control-plane ops

- **WHEN** an agent reads the product skill after control-plane ops ship
- **THEN** the skill MUST list or clearly reference the new ops (including `set_layer_switches`) and MUST tell agents to prefer them over raw eval for those tasks

#### Scenario: Skill contrasts safe vs permissive delete

- **WHEN** an agent reads the product skill after `safe_delete_project_item` ships
- **THEN** the skill MUST warn that `delete_project_item` remains AE-permissive and MUST recommend `safe_delete_project_item` / `ae_get_item_refs` for cleanup

#### Scenario: Skill keeps domain policy outside LayerCake

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that approved expression corpora and template protected-layer rules are not enforced by LayerCake tools
