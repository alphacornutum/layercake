# Guarded session + AE revision fingerprint

Mutation tools verify the open project with a path guard and a composite fingerprint (`rev:{n}|dirty:{0|1}|path:{absolute|unsaved}`) built from `app.project.revision`, `dirty`, and file path — not a LayerCake-only counter or full project hash. Open/close are explicit session transitions; patch/save never open a project. Opening a different path while any project is open is refused (no auto-close).

## Status

accepted

## Considered options

- **Full project hash / mtime-only** — Too expensive or misses unsaved edits.
- **LayerCake session counter** — Lost on MCP restart and ignores UI edits.
- **Per-call open on patch/save** — Surprising and unsafe against the wrong project.
- **Soft locks / mutex files** — AE has no API to lock out the human UI or other agents; fingerprint stale errors remain the only runtime race detection (document 1:1 session assumption).

## Consequences

- Agents must call `ae_project_context` before patch/save and retry with a fresh fingerprint on stale errors.
- `ARCHITECTURE.md` capability map should list context/patch/save/close after this change is synced/archived.
- Preview/plan-token and `save_current` stay deferred; `create_backup` is the pre-apply safety net.
