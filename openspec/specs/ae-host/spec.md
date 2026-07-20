## Purpose

Configure, launch/attach, and open projects against a local After Effects host so MCP tools can operate on a live session.

## Requirements

### Requirement: Configurable After Effects host

The MCP server MUST accept configuration that identifies the local After Effects installation in a platform-appropriate way, and MUST resolve that configuration before performing host operations.

On macOS (`darwin`), configuration MUST accept an AppleScript application name (`AE_APP_NAME`) and/or an application/executable path (`AE_EXECUTABLE`) from which the app name can be derived. On Windows (`win32`), configuration MUST require an executable path (`AE_EXECUTABLE`) to the After Effects CLI binary (typically `AfterFX.exe`); an application display name MUST NOT be required for host operations.

#### Scenario: Host configured via environment on macOS

- **WHEN** the server is started on macOS with a valid `AE_EXECUTABLE` and/or `AE_APP_NAME`
- **THEN** host status reporting MUST show the resolved executable and/or application name without error

#### Scenario: Host configured via executable on Windows

- **WHEN** the server is started on Windows with a valid `AE_EXECUTABLE` pointing at the After Effects binary
- **THEN** host status reporting MUST show the resolved executable and MUST report the host as available for configuration purposes without requiring `AE_APP_NAME`

#### Scenario: Missing host configuration

- **WHEN** a host operation is requested and no usable After Effects host configuration is available for the current platform
- **THEN** the server MUST return a clear error instructing the user to set the platform-appropriate variables (`AE_APP_NAME` and/or `AE_EXECUTABLE` on macOS; `AE_EXECUTABLE` on Windows)

### Requirement: Ensure After Effects session is available

The server MUST be able to launch or attach to the configured After Effects application so subsequent project and scripting operations can run against a live session.

On macOS, ensuring a session MUST soft-attach: when the configured application is already running, the server MUST NOT bring After Effects to the front (MUST NOT use AppleScript `activate` solely to attach). When the application is not running, the server MUST start it using a non-activating launch path when available (AppleScript `launch`) and wait until the application is running or fail with an error that includes the configured path or application name.

#### Scenario: Launch or attach succeeds

- **WHEN** the caller requests a host session and After Effects can be started or is already running
- **THEN** the server MUST report the session as available

#### Scenario: Host cannot start

- **WHEN** the configured After Effects application cannot be found or launched
- **THEN** the server MUST fail with an error that includes the configured path or application name

#### Scenario: macOS attach when already running does not activate

- **WHEN** the caller requests a host session on macOS and the configured After Effects application is already running
- **THEN** the server MUST attach without using AppleScript `activate`

#### Scenario: macOS cold start uses non-activating launch

- **WHEN** the caller requests a host session on macOS and the configured After Effects application is not running
- **THEN** the server MUST attempt to start it without AppleScript `activate` (preferring `launch`) and MUST wait until the application is running or fail with a clear error

### Requirement: Open a local AEP project

The server MUST provide an operation to open a local `.aep` project file in the active After Effects session using an absolute filesystem path. Opening MUST be a session transition only: it MUST NOT be performed as a side effect of patch, save, context, or inventory tools. If another project is already open and the requested path differs, open MUST refuse (regardless of dirty state) rather than prompting the user, auto-closing, or silently discarding changes (see `ae-project-session`).

#### Scenario: Open valid project

- **WHEN** the caller provides an absolute path to an existing `.aep` file, the host session is available, and no other project is open
- **THEN** After Effects MUST open that project and the operation MUST report success

#### Scenario: Project path missing

- **WHEN** the caller provides a path that does not exist
- **THEN** the operation MUST fail without attempting a silent fallback project

#### Scenario: Invalid project type

- **WHEN** the caller provides a path that is not an After Effects project file
- **THEN** the operation MUST fail with an error indicating the path is not a valid project

#### Scenario: Open project blocks conflicting open

- **WHEN** any project is open and the caller requests a different path
- **THEN** open MUST fail without showing a save dialog and without discarding or auto-closing the open project

### Requirement: Artifact directory configuration

The server MUST accept an optional absolute `AE_ARTIFACT_DIR` configuration used for backups and other LayerCake-generated artifacts. When unset, the server MUST use a process-scoped temporary directory and document the choice in operator docs.

#### Scenario: Configured artifact dir

- **WHEN** `AE_ARTIFACT_DIR` is set to a writable absolute path
- **THEN** backup and artifact helpers MUST write under that directory by default

### Requirement: Platform-specific host bridge

The server MUST implement After Effects host operations on macOS via the AppleScript bridge and on Windows via the After Effects command-line script runner. On any other platform, host status MUST report the host as unavailable with a message that the bridge is only implemented on macOS and Windows, and host operations MUST fail with a clear error.

#### Scenario: Windows host status when configured

- **WHEN** the server runs on Windows with a valid `AE_EXECUTABLE`
- **THEN** `ae_host_status` MUST report `platform` as `win32` (or the Node Windows platform string) and MUST NOT claim the host is unavailable solely because the platform is not macOS

#### Scenario: Unsupported platform

- **WHEN** the server runs on a platform that is neither macOS nor Windows
- **THEN** host status MUST report `available: false` with a message that the After Effects host bridge is only implemented on macOS and Windows

### Requirement: Platform-native project open transport

Opening a project MUST preserve the same agent-facing success/error contract on supported platforms while using a platform-native transport: macOS MUST open via AppleScript application `open`; Windows MUST open by evaluating ExtendScript that calls `app.open` on the absolute project path through the Windows script-file runner.

#### Scenario: Open valid project on Windows

- **WHEN** the caller provides an absolute path to an existing `.aep` file on Windows and the host session is available
- **THEN** After Effects MUST open that project and the operation MUST report success

### Requirement: macOS evaluation does not force frontmost

On macOS, ExtendScript evaluation via AppleScript `DoScriptFile` MUST NOT depend on bringing After Effects to the front. When After Effects is already running, evaluation MUST proceed without AppleScript `activate` before or during the `DoScriptFile` invocation.

#### Scenario: Eval while AE running leaves focus policy soft

- **WHEN** After Effects is already running on macOS and the caller evaluates ExtendScript through the host
- **THEN** the evaluation path MUST NOT call AppleScript `activate` as a prerequisite to `DoScriptFile`

### Requirement: macOS project open does not force frontmost to succeed

On macOS, opening a project via AppleScript `open` MUST NOT require AppleScript `activate` when After Effects is already running. The open operation MUST preserve the existing success and refusal contracts (valid path, conflicting open) without using frontmost activation solely to perform the open.

#### Scenario: Open without activate when session already running

- **WHEN** After Effects is already running on macOS, no conflicting project is open, and the caller opens a valid absolute `.aep` path
- **THEN** the project MUST open successfully without AppleScript `activate` as part of the open tell-block
