## Why

LayerCake can inventory and eval, but agents still mutate through raw ExtendScript without stable targeting, concurrency guards, typed operations, or an explicit save boundary. Ad-template work (especially Arial normalization) needs a declarative, auditable edit path that refuses to touch the wrong or stale project and never persists unless asked.

## What Changes

- Add lean `ae_project_context` for cheap, frequent binding: path, dirty, fingerprint (AE `project.revision`-based), AE version — distinct from heavy `ae_project_summary`.
- Add `ae_patch_project` with a strongly typed operation vocabulary (initial op: `set_text_style`), **apply-only** (no preview / plan tokens), path+fingerprint guards, undo-grouped mutation, structured before/after results.
- Add `ae_save_project` with `save_copy` (default) and `create_backup`. No implicit save from patch/context/open. `create_backup` is the pre-apply safety net.
- Harden `ae_open_project` so it refuses to open a different project while any project is open (dirty or clean); add `ae_close_project` with explicit close policy (never agent-blocking save prompts).
- Document guarded-session model: open/close transition tools; mutation/save tools verify path+fingerprint and never open.
- Implement context/patch/save/close as ExtendScript composed over `AeHost.evalScript` — no new `AeHost` interface methods, no platform-bridge changes.
- Prefer compliance-first foundation (Arial acceptance case) over a generic property setter in this change.
- Update product skill, operator docs, and architecture map; add unit + host e2e coverage for the Arial path.
- **Deferred (not in this change):** preview / `planToken` mode, `rename` and other typed ops, `save_current` (in-place overwrite), configurable `AE_PATCH_MAX_TARGETS`, `ae_run_scenario`, full `ae_query_project` consolidation, generic `set_property` / create / move / delete, exposing `TextDocument.font` via `ae_get_layer`.

No **BREAKING** changes to existing inventory JSON shapes (`ae_project_summary` is unchanged). `ae_eval_script` remains the escape hatch.

## Capabilities

### New Capabilities

- `ae-project-context`: Cheap read-only bind token for the open project (`path`, `dirty`, `fingerprint`, `aeVersion`, minimal identity) for frequent agent polling.
- `ae-project-patch`: Declarative **apply-only** mutation tool with typed ops (`set_text_style`), fingerprint guards, undo grouping, and structured before/after evidence (Arial normalization acceptance case).
- `ae-project-save`: Explicit persistence tool (`save_copy`, `create_backup`) with fingerprint preconditions and overwrite protection.
- `ae-project-session`: Safe open/close session transitions — refuse opening over any already-open project; explicit close policy; never prompt-blocking dialogs in agent paths.

### Modified Capabilities

- `ae-host`: Open/close session semantics and open guards. Close/save are eval-composed, so the `AeHost` interface and platform bridges are unchanged.
- `ae-product-skill`: Workflow becomes host → open → context (bind) → optional summary → inventory → optional create_backup → patch apply → context/verify → save_copy; warn that eval bypasses safety.

## Impact

- New modules under `src/` (`src/patch/`, context script in `src/inventory/`, open guard in `src/host/`), Zod tool registration in `src/server.ts`. Context/patch/save/close compose over `AeHost.evalScript`; no `AeHost` interface or platform-bridge changes.
- Public MCP surface: `ae_project_context`, `ae_patch_project`, `ae_save_project`, `ae_close_project`; hardened `ae_open_project`. `ae_project_summary` shape unchanged.
- Env for artifact/backup dir (`AE_ARTIFACT_DIR`) documented in `.env.example` / troubleshooting. Broad-target ceiling is a built-in constant (no new env var).
- Operator docs (`docs/mcp-tools.md`, setup/troubleshooting as needed), `ARCHITECTURE.md` on sync/archive, possible ADR for fingerprint + guarded session.
- Tests: unit (fingerprint shaping, op validation, stale fingerprint, broad-gate) + host e2e (`test:ae`) for Arial normalize → verify → save_copy on a fixture.
- Assumes single open project; document a 1:1 agent↔AE warning only (no soft-lock/mutex implementation). Fingerprint/revision remains the stale-state guard.
