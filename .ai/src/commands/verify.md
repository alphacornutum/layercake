---
description: >-
  Run audit, typecheck, lint, fmt:check, and unit tests; optionally AE host tests
argument-hint: "[ae]"
---

Run the LayerCake verification suite and fix failures you introduce.

1. Run:

```bash
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run fmt:check
npm test
```

2. If `$ARGUMENTS` contains `ae` (or the user asked for host tests), also run:

```bash
npm run test:ae
```

Host tests skip when AE env is unset — report skips clearly rather than treating them as failures.

3. Summarize: commands run, pass/fail/skip, and any fixes applied. Keep changes scoped to making verification green.
