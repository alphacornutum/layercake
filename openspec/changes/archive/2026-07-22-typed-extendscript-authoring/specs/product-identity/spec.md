## ADDED Requirements

### Requirement: Documented After Effects version baseline

Operator-facing documentation (README requirements or equivalent top-level constraints, and linked setup docs as needed) MUST state that LayerCake's supported After Effects host baseline is **version 24.6 or newer**. Documentation MAY note that newer versions (including 26+) work as supersets. It MUST NOT state a higher exclusive minimum (for example 26+) as the supported floor while the product baseline is 24.6+.

#### Scenario: Baseline visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state After Effects **24.6+** as the supported host baseline

#### Scenario: No contradictory higher floor

- **WHEN** an operator reads README and linked setup documentation for version requirements
- **THEN** those docs MUST NOT claim After Effects 26+ is required as the minimum supported version
