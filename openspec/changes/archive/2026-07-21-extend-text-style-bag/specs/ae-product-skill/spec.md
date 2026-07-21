## MODIFIED Requirements

### Requirement: Document guarded editing workflow

The product skill MUST document the safe mutation workflow: host check → open → `ae_project_context` bind → optional summary → inventory as needed → optional `ae_save_project` `create_backup` → `ae_patch_project` apply → use returned fingerprint (or re-bind context if another mutator may have run) → `ae_save_project` `save_copy`. The skill MUST state that agents MAY `save_copy` (or otherwise work on a copy) before mutating when the original project file must remain pristine. The skill MUST state that `ae_eval_script` bypasses typed safety and MUST warn not to open over another project without an explicit `ae_close_project` (or save) first. The skill MUST tell agents to prefer typed patch over raw eval for routine text-style fixes (partial `set_text_style` `style` bag), layer renames (`rename_layer`), layer switch toggles (`set_layer_switches`), and Project panel create/move/delete (`create_folder`, `move_project_item`, `delete_project_item`). The skill MUST state that **all** layer-targeting patch ops (`rename_layer`, `set_layer_switches`, other control-plane layer `target` ops, and `set_text_style` layer/comp selectors) accept id or unique name with the same ambiguity rules as inspect, that ambiguous names refuse with candidates, and that agents SHOULD prefer stable ids when names may collide — with no ids-only exceptions for new ops. Panel item ops remain `Item.id`-based. The skill MUST note that delete follows After Effects defaults (recursive folder remove; in-use items may be deleted), that impact evidence includes nested counts and full `usedInCompIds`, that patch mutates authored / pre-expression project state without rewriting expression strings as a side effect of panel ops or `set_text_style`, and that successful patch targets include post-condition-verified before/after evidence. The skill MUST state that `set_text_style` accepts a partial allowlisted `style` bag (omit key = preserve; at least one key required; `font` not mandatory when other keys are supplied), that evidence uses authored `style` (and `fonts` for font lists) for post-condition success and may include `evaluatedStyle` / `evaluatedFonts`, and that when authored matches but evaluated still differs, agents SHOULD patch expression source layers or use `set_property_expression` so on-screen results update. The skill MUST state that agents SHOULD read SourceText style via `ae_get_layer` (`extended` / `full`) before planning text mutations, and MUST NOT document an op-level expected-current bag (fingerprint guards only).

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
- **THEN** the skill MUST state that `set_text_style` verifies authored `fonts` / `style`, MAY report `evaluatedFonts` / `evaluatedStyle`, and MUST advise patching expression source layers when evaluated style still differs after an authored success

#### Scenario: Skill documents text style bag and inspect read path

- **WHEN** an agent reads the product skill after the text style bag ships
- **THEN** the skill MUST mention the partial `style` allowlist on `set_text_style`, MUST mention reading SourceText style via `ae_get_layer` extended/full, and MUST state that fingerprint guards are the stale-apply mechanism (no expected-current bag)
