## Context

Today LayerCake is read-heavy: `ae_open_project` loads a file into a live AE session, inventory/inspect tools assume “whatever is open,” and mutations go through `ae_eval_script`. That is enough to discover problems but not enough for trusted, reviewable fixes.

The external epic proposes query/patch/scenario/save. This change implements the **mutation foundation**: lean context binding, guarded session open/close, typed patch (apply-only) + save, Arial normalization as the first acceptance case. Preview/plan-token, scenario runner, and full query consolidation stay deferred; `create_backup` (via `ae_save_project`) is the safety net instead of preview.

AE already exposes useful primitives (Scripting Guide):

- `app.project.revision` — integer bumped on every user/script action (fingerprint core)
- `app.project.dirty` — unsaved changes; documented since AE 17.5 (CC2020), so always present on LayerCake's AE 22+ baseline
- `app.project.file` — path or `null` if never saved
- `app.project.close(CloseOptions)` — `DO_NOT_SAVE_CHANGES` / `SAVE_CHANGES` / `PROMPT_TO_SAVE_CHANGES`
- `app.project.save([file])` — save / save-as without UI when `file` is provided
- `app.beginUndoGroup` / `endUndoGroup` — batch undo
- `app.beginSuppressDialogs` — avoid UI hangs (use carefully)
- `TextDocument` / `CharacterRange` — typed text style mutation
- `app.project.replaceFont` (AE 24.5+) — precise font replace across mixed runs, but **not undoable** → prefer CharacterRange/TextDocument inside an undo group for LayerCake patch

## Goals / Non-Goals

**Goals:**

- Clear split: **context** (cheap bind) vs **summary** (heavy passport).
- Guarded session: open/close transition; patch/save verify path+fingerprint and never open.
- Fingerprint v0 from AE revision + path + dirty (survives MCP restart; warn when dirty).
- Typed ops only in v1: `set_text_style` — Zod-discriminated, no generic `set_property`, no `rename` yet.
- **Apply-only patch.** No preview mode, no plan tokens. Direct apply validates all ops first, guards fingerprint, runs one undo group.
- Explicit save (`save_copy` default; `create_backup` as the pre-apply safety net). No `save_current` in this change.
- Compose new behavior over `AeHost.evalScript` (ExtendScript strings + TS shaping), the same pattern as inventory — do **not** grow the `AeHost` interface for context/patch/save/close.
- Harden open against discarding user work; close with explicit policy, never `PROMPT_TO_SAVE_CHANGES` in agent tools.
- Unit + host e2e for Arial normalize → verify → save_copy.
- Compliance-first: ship Arial path well; grow the op registry later.

**Non-Goals (deferred to later changes):**

- Preview / dry-run mode and `planToken` state.
- `rename` and any other typed op beyond `set_text_style`.
- `save_current` (overwriting the active project file in place) and its authorize flag.
- Configurable `AE_PATCH_MAX_TARGETS` (use a built-in default constant).
- `ae_run_scenario` / guaranteed restore theater.
- Full `ae_query_project` replacing list tools; generic property setter, create/move/delete.
- Soft locks, lockfiles, or any concurrency mutex beyond a docs/skill warning (see D8).
- Claiming finite font tests prove universal compatibility; auto-clicking through AE save dialogs.

## Decisions

### D1 — Context vs summary (separate tools)

|                | `ae_project_context`                                                          | `ae_project_summary`                    |
| -------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| Purpose        | Bind / poll concurrency token                                                 | Orient / health / portability           |
| Cost           | Tiny ExtendScript read                                                        | Walk comps/effects/fonts                |
| Call frequency | Often (before/after every mutate)                                             | Once after open, or when health matters |
| Payload        | `projectPath`, `projectName`, `dirty`, `fingerprint`, `aeVersion`, `revision` | Existing passport (unchanged)           |

Do **not** merge, and do **not** modify `ae_project_summary` in this change. Agents must have a cheap poll that does not re-audit every effect; summary keeps its current shape. Docs and tool descriptions tell agents to re-poll **context** before apply/save and reserve summary for dependency/health orientation.

### D2 — Fingerprint = AE revision composite

```
fingerprint = "rev:{revision}|dirty:{0|1}|path:{absolute|unsaved}"
```

- Source of truth: `app.project.revision` (official) + `dirty` + normalized path.
- After MCP restart: agent calls context again; if `dirty: true`, response warns that live state may differ from disk.
- Apply/save require caller-supplied fingerprint match; mismatch → structured stale error with current context so the agent can recover (re-read → new fingerprint → retry).
- `project.path` is also passed as a separate human-readable guard on patch/save — deliberate defense-in-depth alongside the composite.
- Alternatives considered: full project hash (too expensive / incomplete); file mtime only (misses unsaved edits); LayerCake-only counter (lost on restart, ignores UI edits).

### D3 — Guarded session, not per-call open

```
ae_open_project / ae_close_project  →  session transitions
ae_project_context                  →  bind (read)
ae_patch_project / ae_save_project  →  mutate / persist (guard path+fp; never open)
```

- Patch/save `project.path` is a **guard**, not an open request.
- Wrong path open → refuse with actionable error (suggest close/open).
- Single-document AE assumption (one open project).
- Implementation: context/close/save/patch are ExtendScript composed over `host.evalScript`; `ae_open_project`'s dirty/open guard reads context via eval before delegating to the existing `host.openProject`. No new `AeHost` methods; `macos.ts` / `windows.ts` stay untouched.

### D4 — Open/close and dirty projects

- If no project open → open proceeds.
- If same path already open → no-op success (report current context).
- If a **different** path is open → **refuse**, dirty or clean. Return dirty+path+fingerprint. There is no auto-close of a clean project (one predictable rule; no clean/dirty branching). Caller must first:
  - `ae_save_project` / `save_copy`, then `ae_close_project`, or
  - `ae_close_project` with `policy: "discard"` (`DO_NOT_SAVE_CHANGES`) or `policy: "save"` (`SAVE_CHANGES`) — never `prompt`.
- Do not rely on dismissing UI dialogs. `PROMPT_TO_SAVE_CHANGES` is forbidden in LayerCake tools (hangs headless agents).
- `beginSuppressDialogs` only around known-safe script paths, not as a substitute for close policy.

### D5 — Patch is apply-only

```json
{ "project": { "path", "fingerprint" }, "operations": [...], "allowBroadTargetSet": false }
```

- No preview mode and no `planToken`. The pre-apply safety net is `ae_save_project` `create_backup`.
- Apply validates all ops, checks path+fingerprint, runs one undo group, returns per-target before/after evidence.
- Broad selectors: enum scopes only (`layerIds` | `compIds` | `all_text_layers` …) — **no regex in v1**. If resolved target count exceeds a **built-in default maximum** (constant, tuned during e2e), require `allowBroadTargetSet: true`.

### D6 — Typed operations (Zod discriminated union)

**`set_text_style`** (only op in v1)

- Targets: stable `layerId`+`compId` and/or scoped discovery (`all_text_layers` in comps).
- Style fields: only explicitly listed keys (v1: `font` string = exact ExtendScript `TextDocument.font` / CharacterRange `.font` value the agent supplies — no silent Arial synonym mapping).
- `allStyleRuns: true` walks CharacterRange (or whole-doc font when runs unavailable); report limitation if host cannot enumerate runs.
- `preserveUnspecified: true` (default): do not touch size/fill/stroke/etc.
- Values are **pre-expression** authored document state (same default as `ae_get_layer`).
- Prefer per-layer TextDocument/CharacterRange inside undo group; do **not** use `project.replaceFont` for default path (not undoable).

Per-op statuses: `changed` | `already_satisfied` | `skipped_precondition` | `unsupported` | `failed`. Rollback is reported once at the batch level (see D12), not as extra per-op states.

### D7 — Save tool

- Modes: `save_copy` (default agent path) and `create_backup` (timestamped under `AE_ARTIFACT_DIR` or caller path). `save_current` is deferred (Non-Goals).
- Fingerprint precondition required.
- `save_copy` must not overwrite unless `allowOverwrite: true`.
- Response: path written, whether active project path changed, fingerprint after, dirty after.
- Skill guidance: call `create_backup` before risky broad patches; there is no patch-embedded backup flag — the agent calls `ae_save_project` `create_backup` first.

### D8 — Concurrency / “mutex” (docs only)

AE has no API to lock the app against other automation or the human UI. **Do not implement** soft locks, lockfiles, or `sessionLock` fields.

Out of scope for code in this change. Operator docs + product skill MUST warn that LayerCake assumes a **1:1** agent ↔ After Effects session; concurrent agents or a human editing the same AE instance can race. Fingerprint/revision stale errors on patch/save guards remain the only runtime detection.

### D9 — Artifacts directory

- Config: `AE_ARTIFACT_DIR` (absolute path; default under OS temp `layercake-artifacts-<pid>` or similar).
- Used for backups and large patch side-files if needed, future renders.
- Document in `.env.example` and troubleshooting.

### D10 — Text discovery without full query tool

Arial Phase 1 needs run-level before values. Implement a **patch-internal** text-style enumerator used by apply resolution and reported as before/after evidence (and optionally exposed later). Do not block on `ae_query_project`. Existing `ae_list_comps` + patch resolution is enough for the acceptance case; summary still covers missing fonts.

### D11 — Compliance-first vs platform-first

Ship a deep, typed Arial path (`set_text_style` + guards + save) rather than a shallow generic setter. Grow the op registry (`rename`, etc.) in follow-on changes. This keeps validation real and avoids a false sense of safety from `set_property`.

### D12 — Rollback

- Validate all ops before mutating; one named undo group per apply batch.
- On failure after mutation began: stop, attempt best-effort undo of the group once, and report a single batch-level rollback outcome (completed / not completed). Never report overall success on partial apply.
- Do not claim atomicity beyond undo.

### D13 — Module placement

```
src/host/          — dirty/open guard on ae_open_project (reads context via eval, then delegates to existing openProject)
src/inventory/     — context script + parse (read-only, lean)
src/patch/         — op schemas, resolve/apply ExtendScript, backup helper; composed over host.evalScript
src/server.ts      — thin tool registration for context / patch / save / close
tests/             — unit + host.ae e2e Arial fixture flow
```

No new `AeHost` interface methods: close = eval `app.project.close(...)`, save = eval `app.project.save(File)`, context = eval read. Only `ae_open_project` gains a pre-open guard, still delegating to today's `host.openProject`.

### D14 — Dirty-bit after future scenarios (recommendation for deferred work)

When scenarios arrive: capture `{ dirty, revision, property snapshots, selection, activeItem, time }`. Restore properties via reverse-ops; then compare. If AE cannot clear dirty without save/reopen, report `dirtyRestored: false` and define fingerprint equivalence that still hard-fails on property mismatch. Out of scope for this change.

## Risks / Trade-offs

- [Weak fingerprint] → Mitigation: revision catches AE actions; pair with per-target expected-value checks where provided; document limits.
- [No independent font read] → `ae_get_layer` does not yet surface `TextDocument.font`, so post-apply verification relies on the patch apply's own before/after report plus the context revision bump. Mitigation: keep that evidence structured and honest; add font to `ae_get_layer` in a follow-on change (see Open Questions).
- [Undo incomplete after host errors] → Mitigation: batch-level rollback status; never report success on partial apply.
- [replaceFont temptation] → Mitigation: default path uses undoable TextDocument APIs; document replaceFont as future opt-in.
- [No mutex / shared AE] → Mitigation: docs + skill warn 1:1 session assumption; fingerprint stale errors on intervening edits.
- [Windows parity] → Since save/close/context/patch are eval-composed, platform code is unchanged; host e2e on macOS primary, Windows smoke when available.
- [Broad all_text_layers] → Mitigation: built-in max-targets gate + `allowBroadTargetSet`.

## Migration Plan

1. Land tools additively; keep inventory/eval unchanged.
2. Update skill + docs; agents adopt context → (optional create_backup) → patch → save_copy.
3. ADR for guarded session + revision fingerprint (recommended).
4. Rollback: remove new tools/modules; open hardening is behavior-tightening — keep refuse-on-open as the correct long-term default.

## Open Questions

1. Minimum AE version for CharacterRange style-run enumeration — document and feature-detect at runtime.
2. Follow-on: expose `TextDocument.font` via `ae_get_layer` so agents can verify fonts independently of patch self-report (own change, via `/opsx:continue`).
