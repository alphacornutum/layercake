# MCP tools and agent skill

Your agent discovers these tools automatically through MCP. Prefer inventory tools before `ae_eval_script` for inspection.

## Tools

| Tool                 | Purpose                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ae_host_status`     | Resolved host config and availability                                                                                                              |
| `ae_open_project`    | Open an absolute `.aep` / `.aet` path (refuses if another project is open at a different path)                                                     |
| `ae_close_project`   | Close with explicit `discard` or `save` policy (never prompts); optional fingerprint guard                                                         |
| `ae_project_context` | Cheap bind token: path, dirty, revision, fingerprint (poll before/after mutate)                                                                    |
| `ae_project_summary` | Heavier passport: counts, third-party effects, missing footage/fonts                                                                               |
| `ae_list_comps`      | Read-only JSON inventory of compositions (settings + switches) and layers (switches, parent/matte, frame timing, Solid `footageKind`)              |
| `ae_list_sources`    | Read-only JSON inventory of footage, solids, and placeholders                                                                                      |
| `ae_list_folders`    | Read-only nested JSON tree of the Project panel folder hierarchy                                                                                   |
| `ae_get_layer`       | Read-only deep dump of one layer property tree; dual authored/evaluated Transform samples on `extended`/`full`                                     |
| `ae_get_source`      | Read-only deep dump of one footage item and interpret settings (`overview` / `full`)                                                               |
| `ae_get_item_refs`   | Read-only inbound references for one project item (`Item.id`) plus `unknownRefsPossible`                                                           |
| `ae_patch_project`   | Apply-only typed mutations (text, rename, panel + control-plane ops); verified before/after; path+fingerprint guards; no implicit save             |
| `ae_save_project`    | Explicit persist: `save_copy` or `create_backup` (no in-place `save_current`)                                                                      |
| `ae_eval_script`     | Execute ExtendScript inside After Effects (`script`, optional `timeoutMs`). ES3 dialect; modern JS refused before host — see skill reference below |
| `ae_docs_search`     | Search the local After Effects Scripting Guide (hits include `ae://docs/...` URIs)                                                                 |
| `ae_docs_get`        | Fetch a documentation section by URI or relative path                                                                                              |

**Resources:** scripting guide under `ae://docs/{path}` (list + read); product skill under `skill://` (below).

### `ae_save_project` modes

| Mode            | Behavior                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `save_copy`     | AE Save As to an absolute destination; the active project path switches to that file.                                                                                                                                                                                                                                                                              |
| `create_backup` | Filesystem copy of the open `.aep` only (under `AE_ARTIFACT_DIR` or a caller path). Session stays on the original path. Requires a clean, saved project. **Does not** collect linked footage/media (not Collect Files) — opening the backup from a new folder can show missing footage unless those files are still reachable via the paths stored in the project. |

Every evaluated script is prepended with [extendscript-json](https://github.com/theasci/extendscript-json) so `JSON.stringify` / `JSON.parse` work in After Effects’ ES3 host. Prefer scripts that `return` a value and avoid modal dialogs. `ae_eval_script` **pre-validates** source as ExtendScript/ES3 (refuses `const`/`let`, arrows, optional chaining, non-ASCII, etc.; strips trailing commas) before invoking After Effects. Common ES5+ helpers such as `Array.map` are not hard-refused alone but typically fail in AE — use `for` loops. Compact cheat sheet: `skill://drive-after-effects/references/extendscript.md`.

For payload shape and architecture detail, see [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Project item IDs

After Effects uses separate ID namespaces for timeline layers and Project panel items:

- **`Layer.id`** — a layer in a composition
- **`Item.id`** — compositions, footage, folders, and other project items
- **`layer.source.id`** — joins a layer to its source item (`Item.id`)

For follow-up work, prefer IDs over names or indexes. Names can be duplicated; indexes can change.

### `ae_get_layer` dual samples

On `detail` `extended` / `full`, Transform and SourceText (`TEXT_DOCUMENT`) properties that have keyframes or expressions include:

- `value` — sample under the caller's `preExpression` flag (default `true`)
- `authoredValue` — pre-expression (`valueAtTime(..., true)`)
- `evaluatedValue` — post-expression (`valueAtTime(..., false)`)

`TEXT_DOCUMENT` values are projected as `{ kind: "textDocument", style: {…}, boxText?, pointText? }` using the same allowlisted style keys as `set_text_style` (not a raw DOM dump). Shape and other unsupported types remain `{ unserializable: true, propertyValueType }`.

Wrapper purity / normalization checks MUST use `authoredValue` (or `value` with `preExpression: true`), not post-expression Scale alone.

### `ae_get_item_refs`

Read-only inbound references for one `itemId` (`Item.id`): `used_in_comp`, `layer_source`, proxy/parent/matte links, and heuristic `expression_mention` entries. When `unknownRefsPossible` is true, treat the item as **not** safe to delete (`safe_delete_project_item` refuses). No `deletionCandidate` policy bit — agents decide.

### `ae_patch_project` ops

| Op                         | Purpose                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set_text_style`           | Partial authored TextDocument style bag (font, size, leading/autoLeading, fill/stroke, justification, text, box size/pos, …); omit=preserve                                    |
| `rename_layer`             | Rename exactly one timeline layer per op (`target` id\|name + desired `layerName`)                                                                                             |
| `rename_project_item`      | Rename a Project panel item by `itemId`                                                                                                                                        |
| `set_layer_index`          | Reorder one layer to a 1-based `index`                                                                                                                                         |
| `create_solid`             | Always create a new Solid FootageItem (dims, pixelAspect, color; optional `name` / folder; omit name → host default, see [ADR 0006](adr/0006-optional-create-names.md))        |
| `create_text`              | Create horizontal point or box text in a comp (`target` + `layout` + `text`; box requires `boxTextSize`; optional `name` / `style`)                                            |
| `replace_layer_source`     | Replace AVLayer source; evidence reports `layerIdPreserved` / `newLayerId`                                                                                                     |
| `set_layer_timing`         | Set start/in/out via **integer frames** (+ optional stretch); on-grid + exact `durationFrames`; verified keyframe preservation; see notes below                                |
| `set_layer_switches`       | Set timeline/layer switch booleans (`enabled`, `audioEnabled`, `timeRemapEnabled`, …); omit=preserve; full switch snapshot evidence                                            |
| `set_comp_settings`        | Set composition settings via nested `target` + partial `settings` bag (dims/rate/frames/work area/renderer/switches); see below                                                |
| `set_property_expression`  | Set/clear expression on one PropertyBase — exactly one of `matchNames` \| nexrender `propertyPath`                                                                             |
| `set_layer_transform`      | Set authored 2D Transform values (`anchorPoint`/`position`/`scale`/`rotation`/`opacity`); omit=preserve; numeric snapshot evidence                                             |
| `reset_layer_surface`      | Clear keys/effects/masks/styles/markers/matte/parent (flags); `resetTransforms` verifies AE defaults with value evidence; `clearExpressions` separate                          |
| `delete_layer`             | Delete one timeline layer by `target`                                                                                                                                          |
| `create_folder`            | Create a `FolderItem` under `parentFolderId` (optional `name`; omit → host default — [ADR 0006](adr/0006-optional-create-names.md); real inventory root id, never a magic `0`) |
| `move_project_item`        | Move items by `selector.kind: "items"` + `itemIds` into `destinationFolderId`                                                                                                  |
| `delete_project_item`      | Permissive AE `Item.remove()`; refuses root; may delete in-use items / recurse folders                                                                                         |
| `safe_delete_project_item` | Delete only when inbound refs are empty and `unknownRefsPossible` is false; empty folders only                                                                                 |

Successful targets include **post-condition-verified** before/after evidence (apply re-reads live state after the write; `changed` only when it matches the request). See [ADR 0003](adr/0003-patch-targeting-and-post-conditions.md). Nested `target` + op-specific bags (`settings` / `switches` / `style` / `transform`) follow [ADR 0004](adr/0004-patch-op-target-and-settings-bags.md). Typed **create** ops treat `name` as optional ([ADR 0006](adr/0006-optional-create-names.md)): omit keeps the host/AE default (placeholders `Solid` / `Untitled Folder` when the AE API requires a name argument); evidence always returns the final `name`. Prefer `matchNames` from `ae_get_layer` for `set_property_expression` (locale-stable); `propertyPath` splits on `->` when present, otherwise `.`.

#### Layer targeting (id or unique name)

Layer-targeting control-plane ops (`rename_layer`, `set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_layer_switches`, `set_property_expression`, `set_layer_transform`, `reset_layer_surface`, `delete_layer`) and each `set_text_style` `selector.kind: "layers"` entry use the same shape as `ae_get_layer`: exactly one of `compId` \| `compName`, exactly one of `layerId` \| `layerName` (case-sensitive exact match). Ambiguous names refuse before mutation with candidate lists. Prefer ids when names may collide. There is no ids-only exception for new layer-targeting ops.

`set_comp_settings` and `create_text` use comps-only `target` (`compId` XOR `compName`) with the same ambiguity rules. `set_text_style` `selector.kind: "comps"` accepts `compIds` and/or `compNames` (union; at least one non-empty). Existing `{ compIds: [...] }` and `{ compId, layerId }` payloads remain valid. `all_text_layers` is unchanged. Panel item ops stay on `Item.id`.

#### `create_text` example

```json
{
  "op": "create_text",
  "target": { "compName": "main" },
  "layout": "box",
  "text": "Headline",
  "boxTextSize": [800, 200],
  "name": "Title",
  "style": { "font": "ArialMT", "fontSize": 72 }
}
```

`layout` is `"point"` or `"box"` (horizontal only). Box requires `boxTextSize` `[width, height]` (≥ 1). Optional `style` uses the same allowlist as `set_text_style`. AE marks `boxText` / `pointText` read-only — there is no typed in-place convert; recreate with the other `layout`, copy transform/timing/switches as needed, then `delete_layer` the old layer (new `Layer.id`).

#### `rename_layer` example

```json
{
  "op": "rename_layer",
  "target": { "compName": "main", "layerName": "{BrandURL}" },
  "layerName": "{brand_url}"
}
```

Desired `layerName` is opaque (braces / `{message_10}` preserved). AE allows duplicate layer names — LayerCake does not enforce uniqueness. Multi-rename = multiple ops in one `operations` array.

#### `set_layer_switches` example

```json
{
  "op": "set_layer_switches",
  "target": { "compName": "main", "layerName": "Voice" },
  "switches": { "enabled": false }
}
```

Supply only the switches to change (`enabled`, `audioEnabled`, `solo`, `shy`, `locked`, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlending`, `motionBlur`, `timeRemapEnabled`). Omitted switches and non-switch state are preserved. Evidence `before`/`after` is a full readable switch snapshot; post-condition success depends only on supplied keys. Use this op (not `set_layer_timing`) for `timeRemapEnabled`.

#### `set_layer_transform` — slot repair after replace

```json
{
  "op": "set_layer_transform",
  "target": { "compName": "main", "layerName": "Logo" },
  "transform": { "anchorPoint": [300, 550], "position": [300, 550] }
}
```

Supply only the authored Transform keys to change (`anchorPoint`, `position`, `scale` as length-2|3 arrays; `rotation` degrees; `opacity` 0–100). Omitted keys are preserved. Evidence `before`/`after` is a full readable authored/pre-expression snapshot (actual numbers, not booleans); post-condition success depends only on supplied keys. Keyframed supplied properties are refused until keys are cleared (`reset_layer_surface` with `clearKeyframes`). Authored success may still differ from post-expression on-screen values — clear/fix expressions separately. Stale-project refuse uses matching `project.fingerprint` on `ae_patch_project` (no op-level expected-current bag). Prefer this over `ae_eval_script` for slot repair after `replace_layer_source` (e.g. set Position to the new Anchor Point).

`reset_layer_surface` with `resetTransforms: true` applies and verifies AE defaults (Anchor = source center, Position = composition center, Scale 100%, Rotation 0, Opacity 100) and returns authored transform value evidence under `before.transforms` / `after.transforms` — not a `cleared.transforms` boolean. That default Position is often **not** “match new Anchor Point”; use `set_layer_transform` with explicit numbers for slot geometry. `clearExpressions` remains a separate flag (not implied by `resetTransforms`). If `clearKeyframes` is false and transform props still have keys, transform reset fails rather than half-applying.

#### `set_layer_timing` — source slip vs drag

`set_layer_timing` writes `startFrame` / `inFrame` / `outFrame` / optional `stretch` only. Successful writes **preserve** keyframe composition times and authored values: the op snapshots keys before the timing write and restores any AE-nudged keys afterward (verified post-condition — not merely “we don’t call key APIs”). That matches **source slip** (same parent in/out window, different nested source range). It does **not** match UI “drag the layer bar” (intentionally move keys with the layer); use `ae_eval_script` for drag-with-keys until a dedicated typed op exists.

For source slip, supply the new `startFrame` **and** the unchanged `inFrame` / `outFrame` in one op. Setting `startFrame` alone can let After Effects nudge the trim. Assumes time remapping is off (`timeRemapEnabled` stays on `set_layer_switches`).

**Frame-exact + key-preservation post-condition:** success (`changed` / `already_satisfied`) requires every supplied edge to be **on-grid** (`frame / frameRate` seconds within a tight epsilon — not merely nearest-frame rounding), exact `durationFrames` (`outFrame - inFrame`) when in/out are in scope, and `keyframesPreserved: true`. Evidence `before`/`after` includes integer frames plus raw seconds; on key failure, evidence includes a compact `keyframeDrift` summary. The op does **not** save; for critical carriers, agents SHOULD `ae_save_project` and re-read (and MAY probe boundary-frame contribution via eval/render). Persistence and render proof stay outside this op.

#### `set_layer_timing` source-slip example

```json
{
  "op": "set_layer_timing",
  "target": { "compName": "main", "layerName": "Nested" },
  "startFrame": 0,
  "inFrame": 30,
  "outFrame": 120
}
```

Here the parent window stays frames 30–120 while `startFrame` is adjusted so the nested source aligns as intended (plan integer frames from `ae_list_comps`).

#### `set_comp_settings` example

```json
{
  "op": "set_comp_settings",
  "target": { "compName": "main" },
  "settings": {
    "durationFrames": 450,
    "workAreaDurationFrames": 450,
    "switches": { "motionBlur": true }
  }
}
```

Partial `settings` bag (omit key = preserve): `width`, `height`, `pixelAspect`, `frameRate`, `durationFrames`, `displayStartFrame`, `workAreaStartFrame`, `workAreaDurationFrames`, `renderer`, and nested `switches` (`motionBlur`, `frameBlending`, `draft3d`, `hideShyLayers`, `dropFrame`, `preserveNestedResolution`). Evidence is a full settings snapshot; post-condition success depends only on supplied keys. Duration shrink clamps the current/preserved work area to the new end first, then applies other supplied fields; an explicit work area that would still end past duration fails. Plan from `ae_list_comps` composition settings fields. In a mixed batch with `set_layer_timing`, put `set_comp_settings` **first** (especially when changing `frameRate`) — apply does not reorder ops. No implicit save.

#### `set_text_style` name-based example

```json
{
  "op": "set_text_style",
  "selector": {
    "kind": "layers",
    "layers": [{ "compName": "main", "layerName": "Hello World" }]
  },
  "style": { "font": "ArialMT" }
}
```

Partial `style` bag (omit key = preserve; at least one key required; `font` is optional when another key is supplied): `font`, `fontSize`, `fillColor` / `applyFill`, `strokeColor` / `applyStroke` / `strokeWidth`, `tracking`, `baselineShift`, `fauxBold` / `fauxItalic`, `allCaps` / `smallCaps`, `horizontalScale` / `verticalScale`, `autoLeading`, `leading`, `justification` (`LEFT_JUSTIFY` | `RIGHT_JUSTIFY` | `CENTER_JUSTIFY` | `FULL_JUSTIFY_LASTLINE_*`), `text`, `boxTextSize` / `boxTextPos` (box text only). Plan by reading Source Text via `ae_get_layer` (`extended` / `full`). Apply writes the authored / pre-expression `TextDocument` and does not clear Source Text expressions. Fixed `leading` forces `autoLeading` off (refuses `leading` + `autoLeading: true`). Caps (`allCaps` / `smallCaps`) are the public boolean surface; apply writes AE's `fontCapsOption` under the hood (omit sibling = preserve; send both booleans when enforcing a definite mode). `(true, true)` encodes All Small Caps — Adobe's raw booleans stay false for that mode, so LayerCake projects from `fontCapsOption`. `fontCapsOption` is not a style key. Evidence: authored `style` (+ `fonts` for font-list workflows when readable) and optional `evaluatedStyle` / `evaluatedFonts`. Post-condition success depends only on authored values for **supplied** keys (`style.font` is enough when the `fonts` array is unreadable). If authored matches but evaluated still differs, patch expression sources or use `set_property_expression`. Stale-project refuse uses `project.fingerprint` only (no op-level expected-current bag).

#### Auto-leading example

```json
{
  "op": "set_text_style",
  "selector": {
    "kind": "layers",
    "layers": [{ "compId": 12, "layerId": 34 }]
  },
  "style": { "autoLeading": true }
}
```

Patch mutates **authored / pre-expression** project state: text style, layer names, and panel structure. Panel ops select by stable `Item.id` only and do **not** read or write `Property.expression` (they do not use `valueAtTime`). Deleting an item that owns layers removes those properties with the item; deleting in-use footage may leave expression strings intact while later evaluation fails / sources go missing.

Delete follows After Effects defaults: folders recursively remove contents; in-use footage/comps may be removed. Evidence includes `nestedItemCount` (folders) and the full `usedInCompIds` list (+ count) for AVItems. Disk media files are never deleted. On success, agents MAY reuse the returned `fingerprint` / `dirty` / `revision` for the next `ae_save_project` or patch without an immediate `ae_project_context` re-poll when no other mutator (human UI, `ae_eval_script`, another tool) intervened.

## Agent skill: `drive-after-effects`

LayerCake ships the [Agent Skill](https://agentskills.io/) `drive-after-effects`: host check → open → `ae_project_context` bind → optional `ae_project_summary` → inventory → optional `create_backup` / copy-first `save_copy` → `ae_patch_project` → use returned fingerprint (or re-bind if another mutator may have run) → `save_copy`. Prefer typed patch over raw `ae_eval_script` for routine text-style, layer rename (`rename_layer`), layer switches (`set_layer_switches`), composition settings (`set_comp_settings`), and Project panel create/move/delete.

Assumes a **1:1 agent ↔ After Effects** session (no mutex). See [ADR 0002](adr/0002-guarded-session-revision-fingerprint.md).

### Filesystem install

```bash
cp -R skills/drive-after-effects /path/to/your/agent/skills/drive-after-effects
```

Or symlink:

```bash
ln -s "$(pwd)/skills/drive-after-effects" /path/to/your/agent/skills/drive-after-effects
```

The npm package (`layercake`) includes `skills/` alongside `dist/`. No AgentSync required for end-user install.

### MCP resources (SEP-2640)

| URI                                    | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| `skill://drive-after-effects/SKILL.md` | Skill entrypoint (markdown)        |
| `skill://index.json`                   | Discovery index (`type: skill-md`) |

Agents that support MCP skill discovery can load these instructions directly. When the skill loads, the server advertises `io.modelcontextprotocol/skills` and initialize `instructions` point at `skill://drive-after-effects/SKILL.md`.

## See also

- [Setup and connection](setup.md)
- [Related projects and choosing an After Effects MCP](related-projects.md)
- [Troubleshooting](troubleshooting.md)
