## Purpose

Ship one end-user Agent Skill (`drive-after-effects`) from a top-level `skills/` tree, expose it as MCP `skill://` resources per SEP-2640, and document filesystem + MCP consumption without AgentSync.

## Requirements

### Requirement: Ship a single end-user product skill on disk

The project MUST provide exactly one end-user product skill named `drive-after-effects` as an Agent Skills directory at `skills/drive-after-effects/`, containing at least a `SKILL.md` whose YAML frontmatter `name` field is `drive-after-effects`. This directory is the canonical source for end-user workflow guidance and MUST be independent of contributor AgentSync trees (`.ai/src/`).

#### Scenario: Skill directory present in the repository

- **WHEN** a consumer inspects the repository or an installed package that includes product skills
- **THEN** `skills/drive-after-effects/SKILL.md` MUST exist with frontmatter `name` equal to `drive-after-effects` and a non-empty `description`

#### Scenario: Skill is package-shipped

- **WHEN** the npm (or equivalent) package artifact is built for distribution
- **THEN** the `skills/drive-after-effects/` tree MUST be included in the published package contents

### Requirement: Serve the product skill as MCP skill resources

The server MUST expose the product skill files as MCP resources using the SEP-2640 Skills Extension convention under the `skill://` URI scheme. The skill entrypoint MUST be readable at `skill://drive-after-effects/SKILL.md`. Any additional files under the skill directory MUST be readable at `skill://drive-after-effects/<relative-path>`.

#### Scenario: Read skill entrypoint

- **WHEN** the caller reads the resource URI `skill://drive-after-effects/SKILL.md` and the skill directory is available
- **THEN** the server MUST return the `SKILL.md` contents with markdown MIME type

#### Scenario: List skill resources

- **WHEN** the caller lists MCP resources and the skill directory is available
- **THEN** the server MUST include `skill://drive-after-effects/SKILL.md` (and any other files from that skill directory that are served)

#### Scenario: Skill directory unavailable

- **WHEN** the skill directory cannot be loaded at server start
- **THEN** the server MUST still start and expose its existing tools, and MUST NOT register skill resources for the missing skill

### Requirement: Expose skill discovery index

When the product skill is available, the server MUST expose a `skill://index.json` resource whose JSON body lists that skill with `type` `skill-md`, `name` `drive-after-effects`, a description matching the skill frontmatter description, and `url` pointing at `skill://drive-after-effects/SKILL.md`.

#### Scenario: Index lists the product skill

- **WHEN** the caller reads `skill://index.json` and the product skill is loaded
- **THEN** the response MUST be JSON that includes a skills entry for `drive-after-effects` with `url` `skill://drive-after-effects/SKILL.md`

### Requirement: Point agents at the skill from server instructions

When the product skill is available, the MCP server MUST include initialization `instructions` that tell agents to load `skill://drive-after-effects/SKILL.md` for After Effects workflow guidance. When the skill is unavailable, the server MUST NOT claim the skill URI is available.

#### Scenario: Instructions reference the skill URI

- **WHEN** a client completes MCP initialize and the product skill is loaded
- **THEN** the server instructions MUST mention `skill://drive-after-effects/SKILL.md`

### Requirement: Document end-user skill consumption

The project README MUST document how end users obtain and use the product skill both as filesystem files under `skills/` and as MCP `skill://` resources following the SEP-2640 Skills Extension proposal, without requiring AgentSync.

#### Scenario: README covers both channels

- **WHEN** an end user reads the README skill section
- **THEN** the documentation MUST explain installing or copying the `skills/drive-after-effects` directory into their agent’s skill location, and MUST state that the same skill is also served over MCP as `skill://` resources

### Requirement: Recommend project summary for health and portability

The end-user product skill (`drive-after-effects`) MUST document `ae_project_summary` as an optional early step after the host is confirmed and a project is open, for project orientation and dependency/health checks (third-party effects, missing footage, missing fonts) before deep inventory or mutation when those concerns matter. The skill MUST distinguish this from `ae_project_context`, which is the cheap bind/poll tool for path, dirty, and fingerprint.

#### Scenario: Skill mentions ae_project_summary

- **WHEN** an agent reads `skills/drive-after-effects/SKILL.md` (or the equivalent MCP `skill://drive-after-effects/SKILL.md` resource)
- **THEN** the skill body MUST mention `ae_project_summary` and MUST state when to prefer it (health / third-party / missing media or fonts) relative to `ae_list_*` inventory tools

#### Scenario: Skill distinguishes context from summary

- **WHEN** an agent reads the product skill
- **THEN** the skill MUST state that `ae_project_context` is for frequent fingerprint binding and that `ae_project_summary` is for heavier health/portability orientation

### Requirement: Document guarded editing workflow

The product skill MUST document the safe mutation workflow: host check → open → `ae_project_context` bind → optional summary → inventory as needed → optional `ae_save_project` `create_backup` → `ae_patch_project` apply → use returned fingerprint (or re-bind context if another mutator may have run) → `ae_save_project` `save_copy`. The skill MUST state that agents MAY `save_copy` (or otherwise work on a copy) before mutating when the original project file must remain pristine. The skill MUST state that `ae_eval_script` bypasses typed safety and MUST warn not to open over another project without an explicit `ae_close_project` (or save) first. The skill MUST tell agents to prefer typed patch over raw eval for routine text-style fixes, layer renames (`rename_layer`), and Project panel create/move/delete (`create_folder`, `move_project_item`, `delete_project_item`). The skill MUST state that layer patch targets (`rename_layer`, `set_text_style` layer/comp selectors) accept id or unique name with the same ambiguity rules as inspect, and that agents SHOULD prefer stable ids when names may collide. Panel item ops remain `Item.id`-based. The skill MUST note that delete follows After Effects defaults (recursive folder remove; in-use items may be deleted), that impact evidence includes nested counts and full `usedInCompIds`, that patch mutates authored / pre-expression project state without rewriting expression strings as a side effect of panel ops, and that successful patch targets include post-condition-verified before/after evidence. The skill MUST state that `set_text_style` evidence uses authored `fonts` for post-condition success and may include `evaluatedFonts` (post-expression); when authored matches but evaluated still differs, agents SHOULD patch expression source layers (for example a `{font}` controller) before or with consumers so on-screen results update.

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
- **THEN** the skill MUST state that `rename_layer` and `set_text_style` layer/comp selectors accept id or unique name, with ambiguous names refused, and MUST recommend preferring ids when names may collide

#### Scenario: Skill documents dual font evidence and expression-linked order

- **WHEN** an agent reads the product skill after dual font evidence ships
- **THEN** the skill MUST state that `set_text_style` verifies authored `fonts`, MAY report `evaluatedFonts`, and MUST advise patching expression source layers when evaluated fonts still differ after an authored success
