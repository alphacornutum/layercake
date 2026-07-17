## MODIFIED Requirements

### Requirement: Recommend project summary for health and portability

The end-user product skill (`drive-after-effects`) MUST document `ae_project_summary` as an optional early step after the host is confirmed and a project is open, for project orientation and dependency/health checks (third-party effects, missing footage, missing fonts) before deep inventory or mutation when those concerns matter. The skill MUST distinguish this from `ae_project_context`, which is the cheap bind/poll tool for path, dirty, and fingerprint.

#### Scenario: Skill mentions ae_project_summary

- **WHEN** an agent reads `skills/drive-after-effects/SKILL.md` (or the equivalent MCP `skill://drive-after-effects/SKILL.md` resource)
- **THEN** the skill body MUST mention `ae_project_summary` and MUST state when to prefer it (health / third-party / missing media or fonts) relative to `ae_list_*` inventory tools

#### Scenario: Skill distinguishes context from summary

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that `ae_project_context` is for frequent fingerprint binding and that `ae_project_summary` is for heavier health/portability orientation

## ADDED Requirements

### Requirement: Document guarded editing workflow

The product skill MUST document the safe mutation workflow: host check → open → `ae_project_context` bind → optional summary → inventory as needed → optional `ae_save_project` `create_backup` → `ae_patch_project` apply → re-bind context → `ae_save_project` `save_copy`. The skill MUST state that `ae_eval_script` bypasses typed safety and MUST warn not to open over another project without an explicit `ae_close_project` (or save) first.

#### Scenario: Skill mentions patch and save

- **WHEN** an agent reads the product skill after this capability ships
- **THEN** the skill body MUST mention `ae_project_context`, `ae_patch_project`, and `ae_save_project` and MUST tell agents to prefer typed patch over raw eval for routine fixes
