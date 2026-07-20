## Context

macOS `MacOsAeHost.ensureSession` always runs `tell application "…" to activate`. Every `evalScript` and `openProject` calls `ensureSession`, so After Effects becomes frontmost on each MCP host call. A local spike on AE 2026 showed:

- `DoScriptFile` without `activate` completes and leaves the previous frontmost app focused.
- `activate` alone steals focus.
- `launch` while AE is already running does not steal focus.

Windows already soft-attaches (process check, launch only if missing) and is out of scope except for parity documentation.

## Goals / Non-Goals

**Goals:**

- When AE is already running, macOS attach + eval MUST NOT call `activate`.
- When AE is not running, prefer AppleScript `launch` over `activate`, then wait until ready.
- Keep the same agent-facing success/error contracts for `ensureSession`, `evalScript`, and `openProject`.
- Cover the behavior in `ae-host` requirements and host tests where feasible.

**Non-Goals:**

- Non-blocking ExtendScript on AE’s UI thread.
- Persistent ScriptUI/CEP bridge panels.
- Async / fire-and-forget MCP tool results.
- Changing Windows transport or adding a focus-control env flag (unless a cold-start failure forces an escape hatch later).

## Decisions

### 1. Soft attach via `application "…" is running` + `launch`

**Choice:** In `ensureSession` on darwin: if `application "<AE_APP_NAME>" is running` is true, return immediately; otherwise `tell application "…" to launch` and poll/wait until running (or timeout with the existing ConfigError style).

**Why not keep `activate` for “reliability”:** Spike shows it is unnecessary for `DoScriptFile` when AE is up, and it is the entire user pain.

**Why not System Events process-name checks only:** AppleScript `application "…" is running` uses the same app name LayerCake already configures; process display name is `"After Effects"` and would need a separate mapping.

### 2. Eval path: no activate before `DoScriptFile`

**Choice:** `evalScript` continues to call `ensureSession`, then only the existing `DoScriptFile` tell-block (no `activate` inside that block).

**Alternative considered:** Skip `ensureSession` when a process is detected outside AppleScript — rejected; keep one attach helper.

### 3. `openProject`: drop unconditional `activate`

**Choice:** Call soft `ensureSession`, then AppleScript `open POSIX file "…"` without `activate`. If cold-start open proves unreliable without frontmost in AE testing, document and fix with the smallest escalation (e.g. activate only on cold start), not on every open.

**Alternative considered:** Keep activate for open only — rejected for v1 unless AE tests fail; open is less frequent than eval but still steals focus today.

### 4. No new public config flag

**Choice:** Soft attach is always on for macOS. No `AE_ACTIVATE_ON_EVAL` unless we discover a machine where launch/DoScript fails without activate.

**Why:** Fewer knobs; the desired behavior is the product default.

### 5. Verification

**Choice:** Prefer a unit-testable seam (injectable `runAppleScript` / deps object) if macOS host tests are thin today; plus a manual or AE host check that frontmost is unchanged across eval when AE was already running. Do not require UI automation in CI if the host suite cannot observe frontmost reliably — then document a manual verification step in tasks.

## Risks / Trade-offs

- **[Risk] Cold start: `launch` leaves AE not ready for immediate `DoScriptFile`** → Mitigation: wait/poll for `is running` (and optionally a short readiness probe) with timeout; surface ConfigError with app name.
- **[Risk] Cold start or `open` briefly brings AE forward anyway (OS/AE behavior)** → Mitigation: accept one-time surface on launch; steady-state eval must stay quiet; note in operator docs.
- **[Risk] Some AE versions need frontmost for `open`** → Mitigation: AE test for open without activate; escalate only if needed.
- **[Risk] Removing activate hides “AE didn’t start” failures behind later eval timeouts** → Mitigation: ensureSession still fails clearly when launch does not become running within the wait window.

## Migration Plan

- Behavior change only; no MCP schema migration.
- Operators notice less focus stealing immediately after upgrade.
- Rollback: restore activate in `ensureSession` / `openProject` if a critical host fails soft attach.

## Open Questions

- Cold-start focus: does first `launch` + first `DoScriptFile` steal focus once? (Spike during implement if AE can be quit briefly.)
- Exact wait strategy after `launch` (poll `is running` only vs tiny eval probe) — prefer poll-only unless DoScript fails while “running.”
