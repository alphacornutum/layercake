---
name: "drive-after-effects"
description: >-
  Use this skill when inspecting or mutating a live After Effects project through
  LayerCake MCP tools (ae_host_status, ae_open_project, ae_close_project,
  ae_project_context, ae_project_summary, ae_list_*, ae_get_item_refs, ae_patch_project,
  ae_save_project, ae_eval_script, ae_docs_*). Trigger even when phrased as "look at the comp",
  "rename this layer", "mute this layer", "disable video keep audio", "what's in the project",
  "normalize fonts to Arial", "create a solid", "replace layer source", "safe delete footage",
  "run extendscript", "AE is not responding", "any third-party plugins", or "find the scripting API for X".
---

# Drive After Effects via MCP

Safe, id-correct workflow against the live AE GUI session.

## Session assumption

LayerCake assumes a **1:1 agent ↔ After Effects** session. There is no app-level lock. Concurrent agents or a human editing the same AE instance can race; stale fingerprint errors on patch/save are the only runtime detection.

## Steps

1. **Check host** — Call `ae_host_status`. If unavailable, fix platform config: macOS `AE_APP_NAME` and/or `AE_EXECUTABLE` (year suffix must match `/Applications`); Windows `AE_EXECUTABLE` pointing at `AfterFX.exe`.
2. **Open project** — `ae_open_project` with an **absolute** `.aep` / `.aet` path when the needed project is not already open. If another project is open at a different path, open **refuses** (dirty or clean) — call `ae_save_project` / `ae_close_project` first. Never open over another project without an explicit close.
3. **Bind context** — Call `ae_project_context` for the cheap fingerprint token (`path`, `dirty`, `revision`, `fingerprint`). Re-poll before every patch or save (or reuse a successful patch response fingerprint when no other mutator intervened).
4. **Project summary (when needed)** — Call `ae_project_summary` for heavier health/portability orientation (third-party effects, missing footage/fonts). Prefer this before deep inventory when those concerns matter; skip for trivial single-layer edits. Do **not** use summary for fingerprint polling — that is `ae_project_context`.
5. **Inventory as needed** — Prefer `ae_list_comps` (composition settings for `set_comp_settings` planning: dims/PAR/rate, integer duration/display-start/work-area frames, renderer, composition switches; plus layer switches, parent/matte ids, integer frame timing, Solid `source.footageKind`), `ae_list_sources`, and/or `ae_list_folders` before writing custom scripts. For cleanup planning, call `ae_get_item_refs` — when `unknownRefsPossible` is true, do **not** treat the item as safe to delete. Panel ops need real `Item.id` handles from inventory (including `rootFolder.id` — never a magic `0`).
6. **Docs when unsure** — `ae_docs_search` → `ae_docs_get` (or `ae://docs/...`) before inventing DOM APIs.
7. **Optional backup / copy-first** — Before risky or broad patches, `ae_save_project` with `mode: "create_backup"` and the current fingerprint (requires a clean, saved project; dirty projects must use `save_copy` instead). Agents MAY `save_copy` (or otherwise work on a copy) before mutating when the original project file must remain pristine. `create_backup` copies the `.aep` only — it does **not** collect linked footage (not Collect Files).
8. **Typed patch** — Prefer `ae_patch_project` (apply-only) over raw eval for: `set_text_style` (partial TextDocument `style` bag — font, size, leading/`autoLeading`, fill/stroke, justification, text, box geometry, allCaps/smallCaps, …; omit key = preserve; plan via `ae_get_layer` SourceText projection on `extended`/`full`; evidence is authored `style`/`fonts` plus optional `evaluatedStyle`/`evaluatedFonts`; post-condition on authored supplied keys only; fingerprint guards only — no expected-current bag; does not clear Source Text expressions), `rename_layer`, `rename_project_item`, `set_layer_index`, `create_solid`, `replace_layer_source`, `set_layer_timing` (integer frames; not remapping; verified keyframe preservation — see Gotchas for source slip vs drag), `set_layer_switches` (timeline/layer switches — supply only keys to change in `switches`; omitted switches and non-switch state are preserved; evidence is a full switch snapshot before/after; use this for `timeRemapEnabled`, mute-video / keep-audio, solo/shy/locked, etc.), `set_comp_settings` (comps-only `target.compId` XOR `compName` + partial `settings` bag; omit key = preserve; optional nested `settings.switches`; integer-frame evidence; duration shrink clamps work area unless explicit work area would overrun — that fails; place **before** `set_layer_timing` in mixed batches, especially when changing `frameRate`), `set_property_expression` (prefer `matchNames` from `ae_get_layer`; nexrender `propertyPath` with `.` / `->` is an alternative — exactly one selector), `set_layer_transform` (authored 2D Transform — supply only keys to change in nested `transform` bag; omit=preserve; evidence is actual authored/pre-expression numeric before/after snapshots; prefer over eval for slot repair after `replace_layer_source`, e.g. set Position to the new Anchor Point; no op-level expected-current bag — use matching `project.fingerprint`), `reset_layer_surface` (`resetTransforms` applies/verifies AE defaults with value evidence, not a transforms boolean; typically Position at composition center — **not** “match new Anchor”; `clearExpressions` is separate), `delete_layer`, panel `create_folder` / `move_project_item`, and guarded cleanup via `safe_delete_project_item`. Pass `project.path` + `project.fingerprint` guards. **All** layer-targeting patch ops accept id or unique name with the same ambiguity rules as `ae_get_layer` (no ids-only exceptions). Prefer stable ids when names may collide. For `ae_get_layer` `extended`/`full`, Transform and SourceText may include `authoredValue` / `evaluatedValue` — wrapper purity MUST use authored/pre-expression samples, not post-expression alone. SourceText is projected as `{ kind: "textDocument", style, boxText?, pointText? }`. **`safe_delete_project_item`** refuses in-use / `unknownRefsPossible` and empty-folder-only (non-recursive); **`delete_project_item`** remains AE-permissive (recursive folders; in-use allowed) — prefer safe delete + `ae_get_item_refs` for cleanup. Cover/Contain expression bodies, protected control-layer name policy, render-backed visibility, and `main`/`config` reachability stay **agent/domain** concerns — LayerCake does not enforce them. On success, reuse the returned fingerprint when no other mutator intervened; otherwise re-bind context.
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
- Prefer typed control-plane `ae_patch_project` ops over `ae_eval_script`; leave persistence to `ae_save_project`. Prefer ids over names when targeting layers that may share a name.
- Prefer `set_layer_switches` over eval for routine switch toggles (e.g. disable video while leaving audio enabled). `timeRemapEnabled` belongs on `set_layer_switches`, not `set_layer_timing`.
- Prefer `set_comp_settings` over eval for wrapper duration/work area/dims/rate/renderer/comp switches. Put it before `set_layer_timing` in the same batch when both change.
- Prefer `set_layer_transform` over eval for authored Transform repair (Anchor/Position/Scale/Rotation/Opacity). After source replace, set Position explicitly to the new Anchor — do **not** assume `resetTransforms` alone centers the slot. Keyframed transform properties are refused until keys are cleared; authored success may still differ from post-expression on-screen values.
- Prefer `set_text_style` over eval for TextDocument style (font, leading/`autoLeading`, size, fill, justification, text, box geometry, `allCaps`/`smallCaps`). Caps are booleans only — apply maps to AE `fontCapsOption` internally; send both caps keys when enforcing a definite mode. Read SourceText via `ae_get_layer` `extended`/`full` first. Authored evidence may still differ from evaluated on-screen style when expressions drive SourceText — fix expressions separately.
- **`set_layer_timing` preserves keyframes** (composition-absolute times/values): the op snapshots keys and restores any AE nudge after the timing write; success reports `keyframesPreserved: true`. For **source slip** (same parent in/out, different nested source range — e.g. show nested 0–90 instead of 10–100 in the same window), send new `startFrame` **plus** unchanged `inFrame`/`outFrame` in one op — not `startFrame` alone (AE may nudge the trim). Assumes remapping is off.
- **`set_layer_timing` is frame-exact:** success requires **on-grid** edges (`frame / frameRate` seconds, not merely nearest-frame rounding), exact `durationFrames` (`outFrame - inFrame`) when in/out are in scope, and verified key preservation. Evidence includes raw seconds (`startTime` / `inPoint` / `outPoint`) as well as integer frames — use those to spot half-frame drift. The op does not save; for critical carriers, after `ae_save_project` re-read integer frames (and optionally probe boundary-frame contribution via eval/render). Those persistence/render checks are agent-composed outside the op.
- **Drag layer in time** (UI: move the layer bar and its keys together) is **not** a typed op — use `ae_eval_script` until a dedicated op exists. Do not expect `set_layer_timing` to shift keys.
- Prefer `safe_delete_project_item` / `ae_get_item_refs` for cleanup; `delete_project_item` can recursively remove folder contents and delete in-use items.
- `Layer.id` and `Item.id` are different spaces; join footage via `layer.source.id`.
- Layer `index` changes when layers reorder; prefer `id` (AE 22+).
- Modal dialogs and missing fonts/footage prompts block until timeout — dismiss UI or increase `AE_SCRIPT_TIMEOUT_MS`.
- `create_backup` is a project-file copy, not Collect Files — linked media stays at its stored paths; opening the backup from another folder can miss relative footage.
- Timeline fold/twirl state is not available via scripting.
- Host control requires macOS or Windows + a local After Effects install.
