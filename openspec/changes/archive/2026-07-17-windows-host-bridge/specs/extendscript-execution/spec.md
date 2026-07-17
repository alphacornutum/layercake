## ADDED Requirements

### Requirement: Windows script-file evaluation transport

On Windows, ExtendScript evaluation MUST invoke the configured After Effects executable with the `-r` switch and the path to a temporary script file that uses the shared wrap/result-file protocol (OK/ERR payload file). Evaluation MUST NOT depend on AppleScript. Validation of empty scripts, structured OK/ERR results, line information when available, and configurable timeouts MUST behave the same as on macOS from the caller’s perspective.

#### Scenario: Successful evaluation on Windows transport

- **WHEN** the server runs on Windows with a host session available and the caller submits valid ExtendScript that completes without throwing
- **THEN** the operation MUST return success and include the script's result payload as text using the shared result-file protocol

#### Scenario: Timeout on Windows transport

- **WHEN** evaluation on Windows does not complete before the configured timeout
- **THEN** the operation MUST fail with a timeout error and MUST NOT report success

#### Scenario: Empty script still rejected without invoking After Effects

- **WHEN** the caller submits an empty or whitespace-only script on Windows
- **THEN** the operation MUST fail validation without invoking the After Effects executable
