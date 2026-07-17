---
description: >-
  Full QA, branch, commit, push, open a PR with gh, watch CI, review, and merge when green and non-critical
argument-hint: "[optional branch-name or focus]"
---

Get the current work release-ready end-to-end$ARGUMENTS.

## 1. Prepare and full QA

- Finish any incomplete OpenSpec/docs/agent work needed for a coherent release.
- If you edited `.ai/src/`, run `agentsync sync` first.
- Run full QA and fix failures you introduce:

```bash
agentsync check
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run fmt:check
npm test
npm run build
```

## 2. Branch, commit, push, PR

- Create a focused branch off the default base (use `$ARGUMENTS` as the branch name/focus when provided).
- Commit all intended release changes (follow repo commit rules; no secrets).
- Push with `-u` and open a PR via `gh pr create` (Summary + Test plan).
- Always post the PR URL in your reply.

## 3. Pipeline

- Watch checks with `gh pr checks <n> --watch` (or equivalent).
- If CI fails, diagnose with `gh`, fix on the branch, push, and re-watch until green.

## 4. Review and decide

Review the PR yourself (diff + intent). Then choose exactly one outcome:

**A. Merge** — only if all of: pipeline green, change looks well done, and nothing critical.

```bash
gh pr merge <n> --merge --delete-branch
```

**B. Needs human review (not critical)** — do **not** merge. Report the PR link plus what to review and where to focus.

**C. Critical** — do **not** merge. Report the PR link, what is critical, and what the user must review before merge.

Keep the final reply short: PR link, CI status, and the merge/review decision with reasons.
