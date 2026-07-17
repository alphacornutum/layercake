## ADDED Requirements

### Requirement: Recommend project summary for health and portability

The end-user product skill (`drive-after-effects`) MUST document `ae_project_summary` as an optional early step after the host is confirmed and a project is open, for project orientation and dependency/health checks (third-party effects, missing footage, missing fonts) before deep inventory or mutation when those concerns matter.

#### Scenario: Skill mentions ae_project_summary

- **WHEN** an agent reads `skills/drive-after-effects/SKILL.md` (or the equivalent MCP `skill://drive-after-effects/SKILL.md` resource)
- **THEN** the skill body MUST mention `ae_project_summary` and MUST state when to prefer it (health / third-party / missing media or fonts) relative to `ae_list_*` inventory tools
