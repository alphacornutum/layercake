## Context

Today `createAeHost` always returns `MacOsAeHost`, which hard-requires `darwin` and talks to AE via AppleScript (`osascript` + `DoScriptFile` / `open`). Inventory, inspect, docs, and the OK/ERR result-file protocol in `script-wrapper.ts` are already cross-platform. Adobe documents the Windows parallel as `AfterFX.exe -r <script.jsx>` (run in the existing instance).

This change adds a `WinAeHost` behind the same `AeHost` interface so MCP tools need no Windows-specific branches. Implementation and mocked unit tests land on macOS; live smoke is deferred to a Windows VM with AE.

## Goals / Non-Goals

**Goals:**

- `AeHost` implementations for `darwin` and `win32`, selected by `process.platform`.
- Preserve eval protocol: wrap → temp `.jsx` → host runs file → read OK/ERR result file → cleanup.
- Platform-native project open: macOS keeps AppleScript `open`; Windows uses a tiny `app.open(File(...))` script via `-r`.
- Config that works per platform: Windows primary knob is `AE_EXECUTABLE` (path to `AfterFX.exe`); macOS keeps `AE_APP_NAME` / `.app` derivation.
- Clear `ae_host_status` when platform is unsupported or config is incomplete.
- Public / operator docs (`product-identity` + README) state host control on **macOS and Windows**, not macOS-only.
- Unit tests with mocked `execFile` / fs; document VM smoke checklist.

**Non-Goals:**

- Linux AE host bridge.
- COM/OLE or UI Automation as the primary transport.
- Exhaustive Adobe install-path auto-discovery.
- Guaranteeing Windows CI with a licensed AE install.
- Changing public MCP tool names or inventory JSON shapes.
- Changing mutation-scope wording (still eval-only dedicated writes).
- Unifying macOS open onto eval-for-symmetry (rejected: shared contract, idiomatic transport).

## Decisions

### 1. Factory by platform, shared interface

**Choice:** Extract `createAeHost(config)` to `src/host/create-host.ts` (or `index` barrel) that returns `MacOsAeHost` | `WinAeHost` | unavailable stub based on `process.platform`. Keep `AeHost` in `types.ts` unchanged.

**Why:** Tools already depend only on `AeHost`; the seam is the factory.

**Alternatives considered:** Single class with `if (win32)` branches — messier escaping and lifecycle; plugin package — overkill for one bridge.

### 2. Windows eval transport: `AfterFX.exe -r`

**Choice:** Write wrapped script to a temp dir (same as macOS), then `execFile(executable, ["-r", scriptPath], { timeout })`. Prefer `-r` over `-s` (escaping/length). Reuse `wrapExtendScript` / `parseScriptResultFile` unchanged.

**Why:** Matches Adobe Scripting Guide; keeps result-file protocol as the return channel (CLI stdout is not the ExtendScript return value).

**Alternatives considered:** COM automation — poorly documented / fragile for AE; `-s` inline — escaping hell for wrapped polyfill scripts.

### 3. Open: platform-native, not open-via-eval everywhere

**Choice:**

- macOS: keep AppleScript `open POSIX file "…"`.
- Windows: after `ensureSession`, run a minimal ExtendScript that `app.open(File(path))` and returns success/error through the result-file protocol (same runner as eval).

**Why:** Agent contract stays `openProject` → `{ path, opened: true }`. Forcing macOS through eval adds temp I/O and script-permission failures without agent-visible benefit. Windows has no Apple Events, so DOM open via `-r` is the idiomatic bridge.

**Alternatives considered:** CLI `AfterFX.exe path.aep` — possible but version/attach behavior less clear; unify both on `app.open` — only if later options need ExtendScript control.

### 4. Config: platform-aware `assertHostConfigured`

**Choice:**

- **darwin:** require resolvable AppleScript app name (`AE_APP_NAME` or derived from `.app`); `AE_EXECUTABLE` optional but validated if set.
- **win32:** require `AE_EXECUTABLE` pointing at an existing `AfterFX.exe` (or configured AE binary); do not require AppleScript app name.
- Status may still echo `AE_APP_NAME` if set (display only).

**Why:** Current `assertHostConfigured` always demands an app name — that blocks Windows incorrectly.

**Alternatives considered:** Keep requiring both on all platforms — hostile UX on Windows.

### 5. `ensureSession` on Windows

**Choice:** If AE is not running, spawn `AE_EXECUTABLE` (detached/unref as appropriate) and wait briefly / retry a no-op probe; if already running, `-r` targets the existing instance per Adobe docs. Exact “is running” probe can be best-effort (e.g. attempt `-r` with a trivial script, or process-name check) — document limitation until VM smoke.

**Why:** Parallels macOS `activate` without inventing a second AE instance when one exists.

### 6. Verification strategy

**Choice:** Unit tests mock `child_process.execFile` and assert argv (`-r`, script path), timeout errors, and config gating. Document a short Windows VM smoke: `ae_host_status` → open fixture → eval probe → `ae_list_comps`. Do not block merge on AE-in-CI Windows.

**Why:** No licensed AE in CI; mocks prove wiring; VM proves Adobe behavior (`-r` blocking vs poll).

## Risks / Trade-offs

- **[`afterfx -r` returns before script finishes]** → Mitigation: after spawn, poll for result file until timeout (same end state as blocking wait); confirm on VM and adjust.
- **[Concurrent evals interleave on one AE instance]** → Mitigation: process-local mutex around Windows (and optionally macOS) eval/open script runs.
- **[Script file I/O prefs disabled]** → Mitigation: same as macOS — clear error when result file missing; README notes “Allow Scripts To Write Files And Access Network”.
- **[Path / temp / spaces on Windows]** → Mitigation: existing backslash escaping in `wrapExtendScript`; unit fixtures with spaces; VM smoke.
- **[False “supported” claim before VM smoke]** → Mitigation: README marks Windows as implemented, hardware verification pending (or “experimental”) until smoke passes.

## Migration Plan

1. Land factory + `WinAeHost` + config split behind platform switch (macOS behavior unchanged).
2. Update public README product scope / requirements (macOS + Windows), ARCHITECTURE, `.env.example`, and AgentSync host wording — retire “macOS only” operator claims from the public-identity change.
3. Merge with green unit CI on macOS/Linux runners.
4. Run VM smoke; fix transport wait/poll if needed; drop “unverified” caveat when green.

Rollback: revert the change; prior macOS-only factory and docs wording remain.

## Open Questions

- Exact best-effort “AE already running” detection on Windows (process list vs first `-r` attempt) — resolve during implementation with simplest reliable approach; refine after VM smoke.
- Whether to add a shared in-process eval mutex in this change or only if VM shows races — default: add a small mutex in `WinAeHost` only unless cheap to share.
