---
description: >-
  Full QA, branch, commit, push, open a PR with gh, watch CI, review, and merge when green and non-critical
argument-hint: "[optional branch-name or focus]"
---

Get the current work release-ready end-to-end$ARGUMENTS.

## Quality gates (hard stop on merge)

Every command in the full QA block below is a **required quality gate**, including `npm run test:ae`.

- **Run the full suite to completion.** If one gate fails or times out, continue the remaining gates/tasks so the final report lists **everything** that failed — not only the first problem.
- Record pass/fail/skip/timeout for each gate as you go. Do not abort the QA block early just because one step failed (unless a later step is impossible without an earlier artifact, e.g. `build` after a broken install — note that dependency and still run every independent gate you can).
- If **any** gate fails, times out, is skipped because the environment is broken, or cannot be verified: **do not merge**.
- At the end (and on the PR if one exists), post a **comprehensive** status: every gate with outcome + evidence for failures/timeouts, plus what must be fixed or re-run.
- Treat “CI is green” as **necessary but not sufficient** when local gates (especially `test:ae`) did not pass. GitHub CI does not run After Effects host tests — local `test:ae` is still mandatory before merge when the host platform is macOS/Windows.
- Do not reinterpret hangs, recovery-dialog flakes, or “it passed earlier in the session” as a pass for this ship run.

**Exception:** On Linux (or when `test:ae` correctly no-ops via `describe.skipIf(!hasHost)` because no AE host is configured), document that skip explicitly in the PR and treat it as a clean skip — not a failed/hung run.

## 1. Prepare and full QA

- Finish any incomplete OpenSpec/docs/agent work needed for a coherent release.
- If you edited `.ai/src/`, run `agentsync sync` first.
- Make sure docs are up to date:

```bash
npm run docs:fetch
npm run docs:allowlist
```

- Run full QA. Prefer running gates so a single failure does not hide later ones (e.g. chain with `;` / record exit codes, or run steps sequentially and continue after failures). In Cursor, use Shell `required_permissions: ["all"]` — `agentsync check` always fails in the sandbox (`Failed to prepare temporary workspace for check`); do not attempt a sandboxed first try.

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

- After the block: if any gate failed or timed out, **finish the remaining ship steps that still help diagnosis** (branch/PR/comment with the full gate table) but **do not merge**. Wait for the user.

## 2. Branch, commit, push, PR

- Create a focused branch off the default base (use `$ARGUMENTS` as the branch name/focus when provided).
- Commit all intended release changes (follow repo commit rules; no secrets).
- Push with `-u` and open a PR via `gh pr create` (Summary + Test plan). Include the full local QA gate table (especially `test:ae` pass/skip/fail).
- Always post the PR URL in your reply.

## 3. Pipeline

- Watch checks with `gh pr checks <n> --watch` (or equivalent).
- If CI fails, diagnose with `gh`, fix on the branch, push, and re-watch until green — while still keeping the comprehensive local-gate picture up to date after re-runs.
- If CI is green but a **local** quality gate from §1 failed or was not re-verified after the last push: **do not merge** — comment with the full gate status and stop.

## 4. Review and decide

Review the PR yourself (diff + intent). Then choose exactly one outcome:

**A. Merge** — only if **all** of: every §1 quality gate passed for this ship run (including `test:ae`, or a documented clean host-unconfigured skip), pipeline green, change looks well done, and nothing critical.

```bash
gh pr merge <n> --merge --delete-branch
```

**B. Needs human review (not critical)** — do **not** merge. Report the PR link plus what to review and where to focus.

**C. Critical / gate failed** — do **not** merge. Report the PR link, the **full** failed/timeout gate list with evidence, and what the user must review or fix. Prefer a PR comment so the overview is on the record.

Keep the final reply short: PR link, CI status, local QA overview (all gates), and the merge/review decision with reasons.
