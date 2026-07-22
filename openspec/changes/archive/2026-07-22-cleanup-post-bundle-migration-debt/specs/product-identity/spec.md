## MODIFIED Requirements

### Requirement: Documented After Effects version baseline

Operator-facing documentation (README requirements or equivalent top-level constraints, **and** the linked setup doc that the README version badge or requirements section points to) MUST state that LayerCake's supported After Effects host baseline is **version 24.6 or newer**. Documentation MAY note that newer versions (including 26+) work as supersets. It MUST NOT state a higher exclusive minimum (for example 26+) as the supported floor while the product baseline is 24.6+. Troubleshooting docs that discuss After Effects version or host eligibility MUST NOT contradict the 24.6+ floor (they MAY omit a version line when silent).

#### Scenario: Baseline visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state After Effects **24.6+** as the supported host baseline

#### Scenario: Linked setup states the floor

- **WHEN** an operator opens the setup doc linked from the README After Effects version badge or requirements
- **THEN** that setup doc MUST state After Effects **24.6+** as the supported host baseline

#### Scenario: No contradictory higher floor

- **WHEN** an operator reads README and linked setup documentation for version requirements
- **THEN** those docs MUST NOT claim After Effects 26+ is required as the minimum supported version

## ADDED Requirements

### Requirement: Version-floor error and tool messaging

First-party host error messages and MCP tool descriptions that state LayerCake's supported After Effects version floor (including messages that `Layer.id` is unavailable) MUST cite **After Effects 24.6+** (or equivalent “24.6 or newer”). They MUST NOT present After Effects 22 as the product support floor.

#### Scenario: Missing Layer.id error cites 24.6+

- **WHEN** a first-party inventory script fails because `Layer.id` is unavailable
- **THEN** the error text MUST require After Effects **24.6+** (not AE 22 as the product floor)

#### Scenario: Tool copy matches product floor

- **WHEN** an agent reads an MCP tool description that mentions the After Effects version needed for stable `Layer.id`
- **THEN** that description MUST cite **24.6+** (or newer) as the product floor, not AE 22 alone
