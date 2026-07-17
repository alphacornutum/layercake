---
description: >-
  Review current branch or working-tree changes for LayerCake contract safety
argument-hint: "[optional focus]"
---

Review the current changes in this repo$ARGUMENTS.

Embedded context:

- `git status`: !`git status -sb`
- `git diff`: !`git diff`
- `git diff --staged`: !`git diff --staged`
- recent commits: !`git log --oneline -8`

Focus on:

1. **MCP contract** — tool names, Zod schemas, JSON field renames/removals in inventory or `server.ts`.
2. **Host protocol** — `script-wrapper` OK/ERR format, AppleScript escaping, timeout behavior.
3. **Id namespaces** — Layer.id vs Item.id; join keys documented in tool descriptions.
4. **ExtendScript** — ES3 constraints; reliance on injected JSON polyfill; modal/dialog risk.
5. **Tests** — unit coverage for parse/filter/wrapper; AE tests still correctly `skipIf`-gated.
6. **Docs** — README / `.env.example` / OpenSpec specs updated when behavior changed.

Output: findings first (severity-ordered), then open questions. Prefer concrete file references. Do not rewrite unrelated code.
