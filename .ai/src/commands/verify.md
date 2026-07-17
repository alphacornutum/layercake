---
description: >-
  Full QA: agentsync check, audit, typecheck, lint, fmt:check, unit tests, and build; optionally AE host tests
argument-hint: "[ae]"
---

Run the LayerCake full verification suite and fix failures you introduce.

Full QA **always** includes AgentSync. If you edited `.ai/src/`, run `agentsync sync` before `agentsync check`.

In Cursor, run the QA Shell with `required_permissions: ["all"]`. `agentsync check` fails in the sandbox every time (`Failed to prepare temporary workspace for check` / `.cursor/: Operation not permitted`) — that is not drift; skip the sandboxed attempt.

1. Run:

```bash
agentsync check
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run fmt:check
npm test
npm run build
```

2. If `$ARGUMENTS` contains `ae` (or the user asked for host tests), also run:

```bash
npm run test:ae
```

Host tests skip when AE env is unset — report skips clearly rather than treating them as failures.

3. Summarize: commands run, pass/fail/skip, and any fixes applied. Keep changes scoped to making verification green.
