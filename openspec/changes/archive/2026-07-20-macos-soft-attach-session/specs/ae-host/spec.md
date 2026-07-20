## MODIFIED Requirements

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

## ADDED Requirements

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
