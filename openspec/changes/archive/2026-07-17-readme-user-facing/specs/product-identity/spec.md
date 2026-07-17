## ADDED Requirements

### Requirement: Operator README is user-facing showcase and quickstart

The project README MUST be written primarily for end users and lightly technical operators. It MUST lead with product outcome and an easy quickstart. It MUST defer reference-depth operator detail and contributor-oriented depth to linked documents (for example under `docs/`, plus `CONTRIBUTING.md` and `ARCHITECTURE.md` as appropriate).

#### Scenario: Outcome-first opening

- **WHEN** an operator opens the project README
- **THEN** the opening sections MUST explain what LayerCake does for an agent and After Effects before diving into full reference tables or contributor/build-system detail

#### Scenario: Depth is linked, not primary

- **WHEN** an operator needs full MCP configuration variants, complete tool reference, troubleshooting, scripting-guide attribution, or contribution/architecture guidance
- **THEN** the README MUST point to dedicated linked docs rather than embedding that depth as the main landing narrative

### Requirement: Operator reference docs under docs/

Operator-facing reference detail that is removed from the root README MUST be available in linked Markdown under `docs/` (or equally discoverable linked paths), so readers can complete setup and operations without hunting the git history.

#### Scenario: Setup depth linked from README

- **WHEN** an operator follows the README quickstart and needs fuller MCP or environment configuration
- **THEN** the README MUST link to a setup doc that covers those details

### Requirement: README documents current product identity only

The project README MUST present the current product identity (`layercake` machine IDs and **LayerCake** display name) and MUST NOT document former package or repository names as part of the operator-facing narrative.

#### Scenario: No rename history in README

- **WHEN** an operator reads the README identity or introduction sections
- **THEN** the documentation MUST NOT require the reader to know previous names such as `after-effects-driver-mcp` or `afx-inspector`

### Requirement: Windows host support documented as available

The project README MUST document After Effects host control on Windows as available alongside macOS. It MUST NOT describe Windows host support as pending live verification when that verification has been completed.

#### Scenario: Windows stated without pending caveat

- **WHEN** an operator reads the README requirements or platform notes
- **THEN** the documentation MUST present Windows host support as available and MUST NOT claim Windows is hardware-unverified

### Requirement: Optional light emoji branding

The project README MAY include a single emoji or a combination of exactly two emoji as a light LayerCake brand mark (for example near the title). It MUST NOT use emoji decoration as a substitute for clear prose or scatter emoji across every section.

#### Scenario: Brand mark stays light

- **WHEN** the README includes emoji branding for LayerCake
- **THEN** that branding MUST be limited to one mark of one or two emoji and MUST remain secondary to the product name and description

## MODIFIED Requirements

### Requirement: Documented operator product scope

Operator-facing documentation (README) MUST state that host control runs on macOS and Windows, and MUST state that dedicated mutation tools are out of scope: project mutations are performed only through `ae_eval_script` unless and until dedicated write tools are deliberately added later. These facts MAY appear under plain-language section titles and MAY be brief when fuller explanation lives in linked `docs/` pages.

#### Scenario: Host platform constraint visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state that After Effects host control is supported on macOS and Windows

#### Scenario: Mutation scope visible to operators

- **WHEN** an operator reads the project README capability or limitations section (or equivalent)
- **THEN** the documentation MUST state that dedicated mutation tools are out of scope and that `ae_eval_script` is the mutation path
