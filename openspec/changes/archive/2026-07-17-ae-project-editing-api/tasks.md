## 1. Config and fingerprint foundation

- [x] 1.1 Add `AE_ARTIFACT_DIR` to config + `.env.example` (default: process-scoped temp dir)
- [x] 1.2 Implement fingerprint helper (`rev|dirty|path` composite) shared by context/patch/save
- [x] 1.3 Add ExtendScript snippet to read `revision`, `dirty`, `file`, `app.version` (no dirty-unknown branch; AE 22+ baseline)

## 2. Project context

- [x] 2.1 Add `list-project-context-script.ts` + parse/types for lean context payload
- [x] 2.2 Register `ae_project_context` in `server.ts` with clear vs-summary description
- [x] 2.3 Unit tests for context parse and dirty-warning shaping

## 3. Session hardening (open/close)

- [x] 3.1 Implement `ae_close_project` via `host.evalScript` + `CloseOptions.DO_NOT_SAVE_CHANGES` / `SAVE_CHANGES` only (no new `AeHost` method)
- [x] 3.2 Harden `ae_open_project`: same-path no-op; refuse any different open project (dirty or clean); never auto-close
- [x] 3.3 Register `ae_close_project` with fingerprint guard + explicit `discard` | `save` policy
- [x] 3.4 Unit tests for path/policy validation and refuse-on-different-path

## 4. Patch module — schemas and resolve

- [x] 4.1 Create `src/patch/` with Zod schema for `set_text_style` (apply-only; no preview/planToken; no `rename`)
- [x] 4.2 Implement target resolution + text style-run enumeration (pre-expression) used by apply
- [x] 4.3 Implement broad-selector gate against a built-in max-targets constant + `allowBroadTargetSet`
- [x] 4.4 Unit tests for op validation, broad-gate, and target resolution shaping

## 5. Patch module — apply

- [x] 5.1 Implement apply path over `host.evalScript`: path+fingerprint guards, validate-all-first, one undo group, per-op statuses + before/after evidence
- [x] 5.2 `set_text_style`: set exact `font` string via TextDocument/CharacterRange; preserve unspecified attrs; idempotent `already_satisfied`
- [x] 5.3 Batch-level rollback reporting on mid-batch failure (no per-op `rolled_back` taxonomy)
- [x] 5.4 Register `ae_patch_project` (apply-only)
- [x] 5.5 Unit tests for stale fingerprint, idempotency shaping, and rollback status shaping

## 6. Save tool

- [x] 6.1 Implement `save_copy` and `create_backup` via `host.evalScript` under artifact dir / caller path (no `save_current`)
- [x] 6.2 Register `ae_save_project` with fingerprint precondition and overwrite protection
- [x] 6.3 Unit tests for mode handling and overwrite refusal

## 7. Docs, skill, architecture

- [x] 7.1 Update `docs/mcp-tools.md`, setup/troubleshooting, brief README for new tools/env
- [x] 7.2 Update `skills/drive-after-effects` for context → optional create_backup → patch apply → save_copy; warn against opening over another project
- [x] 7.3 Document 1:1 agent↔AE session assumption (no lock/mutex code)
- [x] 7.4 Add ADR for guarded session + revision fingerprint; note ARCHITECTURE update on sync/archive
- [x] 7.5 Sync AgentSync product guidance only if `.ai/src/` skill needs updating

## 8. Host e2e

- [x] 8.1 Extend or add fixture coverage for text layers suitable for font normalize (or document using existing fixture + eval setup)
- [x] 8.2 Host e2e: open → context → optional create_backup → patch `set_text_style` → context fingerprint change → save_copy → reopen/verify; assert no implicit save on patch
- [x] 8.3 Host e2e: different-path open refuses (dirty and clean); close discard/save policies; stale fingerprint on patch/save
- [x] 8.4 Host e2e: repeat patch reports `already_satisfied`

## 9. Verification

- [x] 9.1 Run unit suite, typecheck, lint, fmt:check
- [x] 9.2 Run `npm run test:ae` when AE host configured; note skip otherwise
- [x] 9.3 Full QA including `agentsync check` if `.ai/src/` changed
