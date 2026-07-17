---
description: "Vitest unit vs AE host integration test conventions"
alwaysApply: true
---

# Testing Rules

## Suites

- Unit tests: `tests/**/*.test.ts` via `npm test` (Vitest, `vitest.config.ts`) — no After Effects required.
- Host tests: `tests/**/*.ae.test.ts` via `npm run test:ae` — skipped unless the platform is macOS/Windows and host config resolves (`AE_APP_NAME`/`AE_EXECUTABLE` on macOS; `AE_EXECUTABLE` on Windows). Open/eval cases use the committed `fixtures/hello-world.aep`.
- Keep host tests gated with `describe.skipIf(!hasHost)` / fixture checks, matching `tests/host.ae.test.ts` (use `assertHostConfigured`, not app-name-only checks).

## What to cover in unit tests

- Config parsing and error messages (`ConfigError`).
- Script wrapper: wrap/parse/validate, including `\r` newline normalization.
- Inventory: parse fixtures, filter union semantics, shared helper presence in script strings.
- Docs search/get against the vendored corpus when present.

## Patterns

- Import from `../src/...` with `.js` extensions (NodeNext).
- Prefer pure fixtures/objects over mocking the whole MCP server.
- When adding inventory fields, extend sample objects in `tests/inventory.test.ts` and assert parse + filter behavior.
- After host-facing changes, run `npm run test:ae` when a local AE install is available; otherwise note the skip and keep unit coverage green.
