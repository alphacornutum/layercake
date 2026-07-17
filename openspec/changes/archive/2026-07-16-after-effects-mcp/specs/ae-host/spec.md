## ADDED Requirements

### Requirement: Configurable After Effects host

The MCP server MUST accept configuration that identifies the local After Effects installation, including an executable/application path and/or AppleScript application name, and MUST resolve that configuration before performing host operations.

#### Scenario: Host configured via environment

- **WHEN** the server is started with a valid `AE_EXECUTABLE` and/or `AE_APP_NAME`
- **THEN** host status reporting MUST show the resolved executable and/or application name without error

#### Scenario: Missing host configuration

- **WHEN** a host operation is requested and no usable After Effects host configuration is available
- **THEN** the server MUST return a clear error instructing the user to set `AE_EXECUTABLE` and/or `AE_APP_NAME`

### Requirement: Ensure After Effects session is available

The server MUST be able to launch or attach to the configured After Effects application so subsequent project and scripting operations can run against a live session.

#### Scenario: Launch or attach succeeds

- **WHEN** the caller requests a host session and After Effects can be started or is already running
- **THEN** the server MUST report the session as available

#### Scenario: Host cannot start

- **WHEN** the configured After Effects application cannot be found or launched
- **THEN** the server MUST fail with an error that includes the configured path or application name

### Requirement: Open a local AEP project

The server MUST provide an operation to open a local `.aep` project file in the active After Effects session using an absolute filesystem path.

#### Scenario: Open valid project

- **WHEN** the caller provides an absolute path to an existing `.aep` file and the host session is available
- **THEN** After Effects MUST open that project and the operation MUST report success

#### Scenario: Project path missing

- **WHEN** the caller provides a path that does not exist
- **THEN** the operation MUST fail without attempting a silent fallback project

#### Scenario: Invalid project type

- **WHEN** the caller provides a path that is not an After Effects project file
- **THEN** the operation MUST fail with an error indicating the path is not a valid project
