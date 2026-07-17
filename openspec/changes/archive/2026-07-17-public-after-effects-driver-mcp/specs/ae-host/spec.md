## ADDED Requirements

### Requirement: macOS-only host bridge

The After Effects host bridge MUST be implemented only for macOS (`darwin`). On any other platform, host status MUST report that the host is unavailable with a message that clearly states macOS is required, and host operations that need the bridge (session ensure, open project, script evaluation via the host) MUST fail with a clear platform error rather than attempting unsupported automation.

#### Scenario: Non-macOS host status

- **WHEN** `ae_host_status` (or equivalent host status reporting) runs on a non-`darwin` platform
- **THEN** the result MUST indicate the host is unavailable and MUST mention that the bridge requires macOS

#### Scenario: Non-macOS host operation rejected

- **WHEN** a caller requests a host bridge operation (open project or evaluate script) on a non-`darwin` platform
- **THEN** the operation MUST fail with an error that indicates macOS is required
