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
