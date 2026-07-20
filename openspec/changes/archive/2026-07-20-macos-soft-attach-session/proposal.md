## Why

On macOS, every LayerCake host call currently runs AppleScript `activate` before ExtendScript evaluation. That steals keyboard focus from Cursor (or any other app) on every inventory, patch, or eval — even when After Effects is already running. A live spike confirmed that bare `DoScriptFile` succeeds without bringing AE forward; the activate is LayerCake’s choice, not an AE requirement.

## What Changes

- Soft-attach the macOS host session: when After Effects is already running, attach and evaluate without calling `activate`.
- When After Effects is not running, launch it without forcing frontmost when possible (`launch` rather than `activate`), then wait until the session is ready.
- Stop unconditionally activating as part of macOS `openProject` (keep open reliable; do not steal focus solely to open).
- Document the operator-facing behavior (steady-state evals should leave the previous frontmost app focused).
- No MCP tool rename, schema, or result-shape changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ae-host`: Require that ensuring/attaching a session on macOS MUST NOT force After Effects to become frontmost when it is already running; cold start SHOULD prefer non-activating launch. Clarify that ExtendScript evaluation via `DoScriptFile` MUST NOT depend on a prior `activate`.

## Impact

- Code: `src/host/macos.ts` (`ensureSession`, `openProject`; eval path that calls `ensureSession`).
- Specs: `openspec/specs/ae-host/spec.md` (delta in this change).
- Tests: host unit/AE tests that assume activate-based ensure; add coverage for “already running → no activate” where practical.
- Docs: brief note in troubleshooting or setup if operator-visible; `ARCHITECTURE.md` only if the host attach description needs a one-line accuracy fix.
- Windows: no behavior change required for this change (no per-call `activate` today).
- Out of scope: making ExtendScript non-blocking on AE’s UI thread; bridge panels; async MCP jobs.
