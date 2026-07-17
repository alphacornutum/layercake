## 1. Config and host factory

- [x] 1.1 Make `assertHostConfigured` / config resolution platform-aware: macOS keeps app-name resolution; Windows requires existing `AE_EXECUTABLE` without requiring `AE_APP_NAME`
- [x] 1.2 Extract `createAeHost(config)` to select `MacOsAeHost` on `darwin`, `WinAeHost` on `win32`, and an unavailable/stub host elsewhere; update `src/index.ts` imports
- [x] 1.3 Move or trim `createAeHost` out of `macos.ts` so the macOS module only implements `MacOsAeHost`

## 2. Windows host implementation

- [x] 2.1 Add `src/host/windows.ts` implementing `AeHost.status` / `ensureSession` (launch or attach via `AE_EXECUTABLE`)
- [x] 2.2 Implement `evalScript` with temp wrapped `.jsx`, `AfterFX.exe -r`, shared wrap/parse protocol, timeout handling, and result-file missing errors
- [x] 2.3 Implement `openProject` with shared path validation then a minimal `app.open(File(...))` script via the `-r` runner
- [x] 2.4 Add a process-local mutex around Windows script runs to reduce concurrent `-r` interleaving

## 3. Tests

- [x] 3.1 Unit-test platform-aware config (Windows executable-only success; missing executable error; macOS path unchanged)
- [x] 3.2 Unit-test `WinAeHost` with mocked `execFile`: `-r` argv, open script invocation, timeout → error, empty script never spawns AE
- [x] 3.3 Unit-test factory platform selection (mock/stub `process.platform` as needed)
- [x] 3.4 Run `npm run typecheck && npm run lint && npm run fmt:check && npm test`

## 4. Public docs and agent guidance

- [x] 4.1 Update `README.md` requirements, product scope, env table, and Cursor examples for Windows `AE_EXECUTABLE`; replace macOS-only host claims with macOS + Windows; note VM smoke / verification pending
- [x] 4.2 Update `ARCHITECTURE.md` host diagram and remove the hard “macOS host only” constraint (dual-platform + unsupported elsewhere)
- [x] 4.3 Update `.env.example` with a Windows executable example
- [x] 4.4 Update `.ai/src/` host-bridge wording (AGENTS/rules/skills) so agents are not told the bridge is darwin-only; run `agentsync sync`
- [x] 4.5 Document a short Windows VM smoke checklist (status → open fixture → eval → list comps) in README or change notes
