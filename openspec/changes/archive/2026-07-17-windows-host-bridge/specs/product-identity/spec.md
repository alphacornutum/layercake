## MODIFIED Requirements

### Requirement: Documented operator product scope

Operator-facing documentation (README) MUST state that host control runs on macOS and Windows, and MUST state that dedicated mutation tools are out of scope: project mutations are performed only through `ae_eval_script` unless and until dedicated write tools are deliberately added later.

#### Scenario: Host platform constraint visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state that After Effects host control is supported on macOS and Windows

#### Scenario: Mutation scope visible to operators

- **WHEN** an operator reads the project README scope section or equivalent
- **THEN** the documentation MUST state that dedicated mutation tools are out of scope and that `ae_eval_script` is the mutation path
