---
description: "TypeScript ESM, lint, and formatting conventions for this repo"
globs:
  - src/**/*.ts
  - tests/**/*.ts
  - scripts/**/*
alwaysApply: false
---

# Code Style Rules

## TypeScript / ESM

- Use NodeNext ESM: relative imports include the `.js` extension in TypeScript sources (`./config.js`).
- Prefer explicit types on exported public shapes (`AeConfig`, inventory types, `AeHost`).
- Use project error classes (`ConfigError`, `DocsError`) for typed failure paths callers already branch on.

## Formatting and lint

- Format with `npm run fmt` (oxfmt); check with `npm run fmt:check`.
- Lint with `npm run lint` (oxlint). `vendor/`, `dist/`, and `fixtures/` are ignored.
- Match surrounding naming: `ae_*` for MCP tools, `listX` / `parseX` for inventory, `createAeHost` factories.

## Comments

- Comment only non-obvious host/protocol constraints (polyfill injection, id namespaces, AppleScript escaping).
- Skip narrating obvious TypeScript.
