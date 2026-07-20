## 1. macOS soft attach

- [x] 1.1 Refactor `MacOsAeHost.ensureSession` to soft-attach: if `application "<appName>" is running`, return; else `launch` (not `activate`) and wait until running or fail with ConfigError including app name/path
- [x] 1.2 Remove `activate` from the macOS `openProject` AppleScript tell-block; keep soft `ensureSession` then `open POSIX file`
- [x] 1.3 Confirm `evalScript` only uses soft `ensureSession` + `DoScriptFile` (no activate in the eval tell-block)
- [x] 1.4 Add a small injectable seam for AppleScript execution if needed so unit tests can assert script text (running check / launch / DoScriptFile / open) without requiring AE

## 2. Tests

- [x] 2.1 Unit-test macOS ensureSession script selection: already-running path emits no `activate`; cold-start path uses `launch`
- [x] 2.2 Unit-test open/eval AppleScript fragments do not include `activate`
- [x] 2.3 Run `npm test`; when host env is available, run `npm run test:ae` and manually confirm frontmost app stays put across a quiet eval (document result in the change if CI cannot observe frontmost)
  - Manual: `MacOsAeHost.evalScript` with AE 2026 already running — frontmost stayed Cursor before/after; result `focus-probe`.
  - `npm run test:ae`: failed in this environment because host config resolved to app name `Adobe` / `/Applications/Adobe` (broken `.env` path with spaces), not because of soft-attach logic.

## 3. Docs and verify

- [x] 3.1 Add a short operator note (troubleshooting or setup) that macOS host calls soft-attach and do not steal focus when AE is already running; cold start may still surface AE once
- [x] 3.2 Update `ARCHITECTURE.md` host bullet only if the attach description would otherwise be inaccurate
- [x] 3.3 Run project QA relevant to the touch (`npm run typecheck`, `npm run lint`, `npm test`); note `test:ae` skip if host unavailable
