## ADDED Requirements

### Requirement: Public package and CLI identity

The distributable Node package MUST use the name `after-effects-driver-mcp`. When a CLI binary is exposed via `package.json` `bin`, that binary name MUST be `after-effects-driver-mcp` and MUST invoke the MCP server entrypoint.

#### Scenario: Package metadata

- **WHEN** a consumer inspects `package.json` in the repository or published package
- **THEN** the `name` field MUST equal `after-effects-driver-mcp`

#### Scenario: CLI bin

- **WHEN** the package defines a `bin` entry for the server
- **THEN** the bin key MUST be `after-effects-driver-mcp`

### Requirement: MCP server initialize name

The MCP server MUST advertise the initialize/server name `after-effects-driver` (without an `-mcp` suffix). Public tool names MUST remain the existing `ae_*` surface; this requirement does not rename tools.

#### Scenario: Server name on create

- **WHEN** the MCP server is constructed for stdio transport
- **THEN** its configured server name MUST be `after-effects-driver`

### Requirement: Documented operator product scope

Operator-facing documentation (README) MUST state that host control runs on macOS only, and MUST state that dedicated mutation tools are out of scope: project mutations are performed only through `ae_eval_script` unless and until dedicated write tools are deliberately added later.

#### Scenario: macOS constraint visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state that After Effects host control is macOS-only

#### Scenario: Mutation scope visible to operators

- **WHEN** an operator reads the project README scope section or equivalent
- **THEN** the documentation MUST state that dedicated mutation tools are out of scope and that `ae_eval_script` is the mutation path
