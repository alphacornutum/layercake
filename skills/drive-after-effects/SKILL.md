---
name: "drive-after-effects"
description: >-
  Use this skill when inspecting or mutating a live After Effects project through
  LayerCake MCP tools (ae_host_status, ae_open_project, ae_project_summary, ae_list_*,
  ae_eval_script, ae_docs_*). Trigger even when phrased as "look at the comp", "rename this
  layer", "what's in the project", "run extendscript", "AE is not responding", "any third-party
  plugins", or "find the scripting API for X".
---

# Drive After Effects via MCP

Safe, id-correct workflow against the live AE GUI session.

## Steps

1. **Check host** — Call `ae_host_status`. If unavailable, fix platform config: macOS `AE_APP_NAME` and/or `AE_EXECUTABLE` (year suffix must match `/Applications`); Windows `AE_EXECUTABLE` pointing at `AfterFX.exe`.
2. **Open project** — `ae_open_project` with an **absolute** `.aep` / `.aet` path when the needed project is not already open.
3. **Project summary (when needed)** — Call `ae_project_summary` for orientation and health/portability: counts, third-party vs first-party effects, missing footage, missing/substituted fonts. Prefer this before deep inventory when those concerns matter; skip for trivial single-layer edits.
4. **Inventory first** — Prefer `ae_list_comps`, `ae_list_sources`, and/or `ae_list_folders` before writing custom scripts.
5. **Docs when unsure** — `ae_docs_search` → `ae_docs_get` (or `ae://docs/...`) before inventing DOM APIs.
6. **Mutate with eval** — `ae_eval_script` with a script that `return`s a value. Look up targets by id:

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

7. **Re-inventory** after structural edits if later steps depend on indexes or names.

## Gotchas

- `ae_eval_script` can mutate the open project — say so when running destructive scripts.
- `Layer.id` and `Item.id` are different spaces; join footage via `layer.source.id`.
- Layer `index` changes when layers reorder; prefer `id` (AE 22+).
- Modal dialogs and missing fonts/footage prompts block until timeout — dismiss UI or increase `AE_SCRIPT_TIMEOUT_MS`.
- Timeline fold/twirl state is not available via scripting.
- Host control requires macOS or Windows + a local After Effects install.
