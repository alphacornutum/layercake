---
name: "drive-after-effects"
description: >-
  Use this skill when inspecting or mutating a live After Effects project through
  LayerCake MCP tools (ae_host_status, ae_open_project, ae_close_project,
  ae_project_context, ae_project_summary, ae_list_*, ae_patch_project, ae_save_project,
  ae_eval_script, ae_docs_*). Trigger even when phrased as "look at the comp", "rename this
  layer", "what's in the project", "normalize fonts to Arial", "run extendscript",
  "AE is not responding", "any third-party plugins", or "find the scripting API for X".
---

# Drive After Effects via MCP

Safe, id-correct workflow against the live AE GUI session.

## Session assumption

LayerCake assumes a **1:1 agent ↔ After Effects** session. There is no app-level lock. Concurrent agents or a human editing the same AE instance can race; stale fingerprint errors on patch/save are the only runtime detection.

## Steps

1. **Check host** — Call `ae_host_status`. If unavailable, fix platform config: macOS `AE_APP_NAME` and/or `AE_EXECUTABLE` (year suffix must match `/Applications`); Windows `AE_EXECUTABLE` pointing at `AfterFX.exe`.
2. **Open project** — `ae_open_project` with an **absolute** `.aep` / `.aet` path when the needed project is not already open. If another project is open at a different path, open **refuses** (dirty or clean) — call `ae_save_project` / `ae_close_project` first. Never open over another project without an explicit close.
3. **Bind context** — Call `ae_project_context` for the cheap fingerprint token (`path`, `dirty`, `revision`, `fingerprint`). Re-poll before every patch or save.
4. **Project summary (when needed)** — Call `ae_project_summary` for heavier health/portability orientation (third-party effects, missing footage/fonts). Prefer this before deep inventory when those concerns matter; skip for trivial single-layer edits. Do **not** use summary for fingerprint polling — that is `ae_project_context`.
5. **Inventory as needed** — Prefer `ae_list_comps`, `ae_list_sources`, and/or `ae_list_folders` before writing custom scripts.
6. **Docs when unsure** — `ae_docs_search` → `ae_docs_get` (or `ae://docs/...`) before inventing DOM APIs.
7. **Optional backup** — Before risky or broad patches, `ae_save_project` with `mode: "create_backup"` and the current fingerprint.
8. **Typed patch** — Prefer `ae_patch_project` (apply-only) over raw eval for routine fixes such as `set_text_style` font normalization. Pass `project.path` + `project.fingerprint` guards. Re-bind context after apply.
9. **Persist** — `ae_save_project` with `mode: "save_copy"` (and an absolute destination) when you want changes on disk. Patch never saves implicitly.
10. **Eval escape hatch** — `ae_eval_script` bypasses typed safety and fingerprint guards. Use only for one-offs the patch vocabulary cannot express. Look up targets by id:

```javascript
function itemById(itemId) {
  var items = app.project.items;
  for (var i = 1; i <= items.length; i++) {
    if (items[i].id === itemId) return items[i];
  }
  return null;
}
function compById(compId) {
  var item = itemById(compId);
  return item instanceof CompItem ? item : null;
}
function layerById(comp, layerId) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).id === layerId) return comp.layer(i);
  }
  return null;
}
```

11. **Re-inventory / re-bind** after structural edits if later steps depend on indexes, names, or fingerprint.

## Gotchas

- Do not open a different project while one is already open — close with `ae_close_project` (`discard` | `save`) first.
- `ae_eval_script` can mutate the open project and bypasses patch guards — say so when running destructive scripts.
- Prefer `ae_patch_project` for typed text-style edits; leave persistence to `ae_save_project`.
- `Layer.id` and `Item.id` are different spaces; join footage via `layer.source.id`.
- Layer `index` changes when layers reorder; prefer `id` (AE 22+).
- Modal dialogs and missing fonts/footage prompts block until timeout — dismiss UI or increase `AE_SCRIPT_TIMEOUT_MS`.
- Timeline fold/twirl state is not available via scripting.
- Host control requires macOS or Windows + a local After Effects install.
