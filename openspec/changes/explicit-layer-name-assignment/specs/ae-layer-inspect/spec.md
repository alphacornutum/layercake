# Spec Delta

## ADDED Requirements

### Requirement: Layer name-assignment state

`ae_get_layer` MUST expose the resolved layer’s explicit-name state as read-only identity metadata, independently of the requested property detail tier. Where After Effects exposes the fields, the result MUST include `isNameSet` and `isNameFromSource`; it MUST continue to include the layer source identity when a source exists.

#### Scenario: Inspect inherited name

- **WHEN** `ae_get_layer` inspects a layer whose visible name is inherited from its source
- **THEN** the result MUST include the visible `name`, `isNameSet: false`, `isNameFromSource: true` when exposed by After Effects, and its source identity

#### Scenario: Inspect explicitly assigned name after reopening

- **WHEN** a project with an explicitly named layer is saved, closed, reopened, and inspected with `ae_get_layer`
- **THEN** the result MUST show the saved visible name and `isNameSet: true`, and MUST report the current source identity when a source exists

#### Scenario: Name-state property unavailable

- **WHEN** After Effects does not expose `isNameFromSource` for a resolved layer
- **THEN** `ae_get_layer` MAY omit or return null for `isNameFromSource` and MUST NOT infer its value from visible name equality
