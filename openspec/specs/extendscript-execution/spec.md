## Purpose

Evaluate caller-supplied ExtendScript in the active After Effects session with structured results, validation, and timeouts.

## Requirements

### Requirement: Evaluate ExtendScript in the active session

The server MUST provide an operation that evaluates caller-supplied ExtendScript source in the active After Effects session and returns the script result or a structured error.

#### Scenario: Successful evaluation

- **WHEN** the caller submits valid ExtendScript that completes without throwing
- **THEN** the operation MUST return success and include the script's result payload as text

#### Scenario: Script runtime error

- **WHEN** the caller submits ExtendScript that throws or fails at runtime inside After Effects
- **THEN** the operation MUST return a failure that includes an error message from the host (and line information when available)

#### Scenario: Empty script rejected

- **WHEN** the caller submits an empty or whitespace-only script
- **THEN** the operation MUST fail validation without invoking After Effects

### Requirement: Session prerequisite for script evaluation

ExtendScript evaluation MUST require an available After Effects host session. If a project-scoped operation is implied by the caller's script, the server MUST still evaluate the script against the current host state (open project or lack thereof) rather than inventing project context.

#### Scenario: Evaluate without open project

- **WHEN** a host session is available but no project has been opened via the server
- **THEN** evaluation MUST still be attempted against the current After Effects state and MUST return whatever result or error After Effects produces

#### Scenario: Evaluate after opening fixture project

- **WHEN** a fixture `.aep` has been opened successfully and the caller evaluates a read-only probe such as reading `app.project.numItems`
- **THEN** the operation MUST return a successful result reflecting that open project

### Requirement: Evaluation timeout

The server MUST enforce a configurable timeout around ExtendScript evaluation and MUST surface a timeout error when After Effects does not complete within that limit.

#### Scenario: Script exceeds timeout

- **WHEN** evaluation does not complete before the configured timeout
- **THEN** the operation MUST fail with a timeout error and MUST NOT report success

### Requirement: Windows script-file evaluation transport

On Windows, ExtendScript evaluation MUST invoke the configured After Effects executable with the `-r` switch and the path to a temporary script file that uses the shared wrap/result-file protocol (OK/ERR payload file). Evaluation MUST NOT depend on AppleScript. Validation of empty scripts, structured OK/ERR results, line information when available, and configurable timeouts MUST behave the same as on macOS from the caller's perspective.

#### Scenario: Successful evaluation on Windows transport

- **WHEN** the server runs on Windows with a host session available and the caller submits valid ExtendScript that completes without throwing
- **THEN** the operation MUST return success and include the script's result payload as text using the shared result-file protocol

#### Scenario: Timeout on Windows transport

- **WHEN** evaluation on Windows does not complete before the configured timeout
- **THEN** the operation MUST fail with a timeout error and MUST NOT report success

#### Scenario: Empty script still rejected without invoking After Effects

- **WHEN** the caller submits an empty or whitespace-only script on Windows
- **THEN** the operation MUST fail validation without invoking the After Effects executable
