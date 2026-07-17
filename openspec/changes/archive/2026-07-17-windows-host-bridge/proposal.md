## Why

LayerCake’s MCP surface and ExtendScript inventory already work on any OS, but the host bridge is macOS-only (`osascript` + `DoScriptFile`). Windows After Effects users — a large share of AE installs — cannot use the server until a native Windows transport exists. Public release makes that gap a product limitation, not just an internal deferral.

## What Changes

- Add a Windows `AeHost` implementation that drives After Effects via `AfterFX.exe` (`-r` for script files), keeping the existing OK/ERR result-file eval protocol.
- Select the host implementation by platform (`darwin` → macOS AppleScript bridge; `win32` → Windows CLI bridge; other platforms remain unavailable with a clear status message).
- Keep **platform-native open**: macOS continues AppleScript `open`; Windows opens projects via a small ExtendScript `app.open(File(...))` invoked with `-r` (shared agent contract, different transport).
- Treat `AE_EXECUTABLE` as the primary Windows config (path to `AfterFX.exe`); `AE_APP_NAME` remains macOS-oriented / optional for status display.
- Update **public / operator-facing** docs (`README` requirements and product scope) so host control is documented as **macOS and Windows**, not macOS-only; also update `ARCHITECTURE`, env example, and agent guidance, plus the deferred Windows VM smoke note.
- Unit-test the Windows host with mocked process/fs on any OS; defer live `test:ae` smoke to a Windows VM with AE installed.

## Capabilities

### New Capabilities

- None. Windows support extends the existing host/eval/product-identity surface rather than introducing a separate product capability.

### Modified Capabilities

- `ae-host`: Host configuration, session ensure, and project open MUST work on Windows (`win32`) as well as macOS, with platform-appropriate transport and clear unavailable status elsewhere.
- `extendscript-execution`: ExtendScript evaluation MUST run on Windows via the CLI script-file transport while preserving validation, timeouts, and the OK/ERR result-file protocol.
- `product-identity`: Operator-facing documentation MUST state that After Effects host control runs on macOS and Windows (not macOS-only); mutation-scope wording stays unchanged.

## Impact

- **Code:** `src/host/` (new `windows.ts`, factory/`createAeHost` split), `src/config.ts` (Windows executable resolution), `src/index.ts` wiring; macOS bridge stays for `darwin`.
- **Contracts:** Public MCP tool names/shapes unchanged; `ae_host_status` platform/availability messaging expands.
- **Docs / agent guidance:** README requirements and product-scope wording (replace macOS-only with macOS + Windows), env table, ARCHITECTURE host diagram/constraints; AgentSync sources if they hard-code darwin-only.
- **Tests:** New unit coverage for Windows host CLI args and config; no CI dependency on a Windows AE install. Live verification is a manual/VM follow-up.
- **Non-goals for this change:** Linux AE host, COM/OLE automation, auto-discovery of every Adobe install path variant, guaranteeing Windows CI with licensed AE.
