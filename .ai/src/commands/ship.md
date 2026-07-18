---
description: >-
  Full QA, branch, commit, push, open a PR with gh, watch CI, review, and merge when green and non-critical
argument-hint: "[optional branch-name or focus]"
---

Get the current work release-ready end-to-end$ARGUMENTS.

## Quality gates (hard stop)

Every command in the full QA block below is a **required quality gate**, including `npm run test:ae`.

- If **any** gate fails, times out, is skipped because the environment is broken, or cannot be verified: **stop**. Do **not** merge.
- Post a PR comment (or your final reply if no PR yet) that names the failed gate, the error/timeout evidence, and what must be fixed or re-run.
- Treat “CI is green” as **necessary but not sufficient** when local gates (especially `test:ae`) did not pass. GitHub CI does not run After Effects host tests — local `test:ae` is still mandatory before merge when the host platform is macOS/Windows.
- Only proceed past a gate when it exits successfully. Do not reinterpret hangs, recovery-dialog flakes, or “it passed earlier in the session” as a pass for this ship run.

**Exception:** On Linux (or when `test:ae` correctly no-ops via `describe.skipIf(!hasHost)` because no AE host is configured), document that skip explicitly in the PR and continue — that is a clean skip, not a failed/hung run.

## 1. Prepare and full QA

- Finish any incomplete OpenSpec/docs/agent work needed for a coherent release.
- If you edited `.ai/src/`, run `agentsync sync` first.
- Make sure docs are up to date:

```bash
npm run docs:fetch
npm run docs:allowlist
```

- Run full QA and fix failures you introduce. In Cursor, run this whole block with Shell `required_permissions: ["all"]` — `agentsync check` always fails in the sandbox (`Failed to prepare temporary workspace for check`); do not attempt a sandboxed first try.

```bash
agentsync check
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run fmt:check
npm test
npm run test:ae
npm run build
```

- After the block: if `test:ae` (or any other command) failed or timed out, **end the ship workflow here** — open/update the PR if useful, comment with the failure, and wait for the user. Do not enter merge.

## 2. Branch, commit, push, PR

- Create a focused branch off the default base (use `$ARGUMENTS` as the branch name/focus when provided).
- Commit all intended release changes (follow repo commit rules; no secrets).
- Push with `-u` and open a PR via `gh pr create` (Summary + Test plan). Include local QA results in the test plan (especially `test:ae` pass/skip/fail).
- Always post the PR URL in your reply.

## 3. Pipeline

- Watch checks with `gh pr checks <n> --watch` (or equivalent).
- If CI fails, diagnose with `gh`, fix on the branch, push, and re-watch until green.
- If CI is green but a **local** quality gate from §1 failed or was not re-verified after the last push: **do not merge** — comment and stop.

## 4. Review and decide

Review the PR yourself (diff + intent). Then choose exactly one outcome:

**A. Merge** — only if **all** of: every §1 quality gate passed for this ship run (including `test:ae`, or a documented clean host-unconfigured skip), pipeline green, change looks well done, and nothing critical.

```bash
gh pr merge <n> --merge --delete-branch
```

**B. Needs human review (not critical)** — do **not** merge. Report the PR link plus what to review and where to focus.

**C. Critical / gate failed** — do **not** merge. Report the PR link, the failed gate(s), evidence, and what the user must review or fix before merge. Prefer a PR comment so the failure is on the record.

Keep the final reply short: PR link, CI status, local QA status (including `test:ae`), and the merge/review decision with reasons.
