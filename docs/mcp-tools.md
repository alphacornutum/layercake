# MCP tools and agent skill

Your agent discovers these tools automatically through MCP. Prefer inventory tools before `ae_eval_script` for inspection.

## Tools

| Tool                 | Purpose                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ae_host_status`     | Resolved host config and availability                                                                                                  |
| `ae_open_project`    | Open an absolute `.aep` / `.aet` path (refuses if another project is open at a different path)                                         |
| `ae_close_project`   | Close with explicit `discard` or `save` policy (never prompts); optional fingerprint guard                                             |
| `ae_project_context` | Cheap bind token: path, dirty, revision, fingerprint (poll before/after mutate)                                                        |
| `ae_project_summary` | Heavier passport: counts, third-party effects, missing footage/fonts                                                                   |
| `ae_list_comps`      | Read-only JSON inventory of compositions and layers (switches, parent/matte, frame timing, Solid `footageKind`)                        |
| `ae_list_sources`    | Read-only JSON inventory of footage, solids, and placeholders                                                                          |
| `ae_list_folders`    | Read-only nested JSON tree of the Project panel folder hierarchy                                                                       |
| `ae_get_layer`       | Read-only deep dump of one layer property tree; dual authored/evaluated Transform samples on `extended`/`full`                         |
| `ae_get_source`      | Read-only deep dump of one footage item and interpret settings (`overview` / `full`)                                                   |
| `ae_get_item_refs`   | Read-only inbound references for one project item (`Item.id`) plus `unknownRefsPossible`                                               |
| `ae_patch_project`   | Apply-only typed mutations (text, rename, panel + control-plane ops); verified before/after; path+fingerprint guards; no implicit save |
| `ae_save_project`    | Explicit persist: `save_copy` or `create_backup` (no in-place `save_current`)                                                          |
| `ae_eval_script`     | Execute ExtendScript inside After Effects (`script`, optional `timeoutMs`)                                                             |
| `ae_docs_search`     | Search the local After Effects Scripting Guide (hits include `ae://docs/...` URIs)                                                     |
| `ae_docs_get`        | Fetch a documentation section by URI or relative path                                                                                  |

**Resources:** scripting guide under `ae://docs/{path}` (list + read); product skill under `skill://` (below).

### `ae_save_project` modes

| Mode            | Behavior                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `save_copy`     | AE Save As to an absolute destination; the active project path switches to that file.                                                                                                                                                                                                                                                                              |
| `create_backup` | Filesystem copy of the open `.aep` only (under `AE_ARTIFACT_DIR` or a caller path). Session stays on the original path. Requires a clean, saved project. **Does not** collect linked footage/media (not Collect Files) — opening the backup from a new folder can show missing footage unless those files are still reachable via the paths stored in the project. |

Every evaluated script is prepended with [extendscript-json](https://github.com/theasci/extendscript-json) so `JSON.stringify` / `JSON.parse` work in After Effects’ ES3 host. Prefer scripts that `return` a value and avoid modal dialogs.

For payload shape and architecture detail, see [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Project item IDs

After Effects uses separate ID namespaces for timeline layers and Project panel items:

- **`Layer.id`** — a layer in a composition
- **`Item.id`** — compositions, footage, folders, and other project items
- **`layer.source.id`** — joins a layer to its source item (`Item.id`)

For follow-up work, prefer IDs over names or indexes. Names can be duplicated; indexes can change.

### `ae_get_layer` dual samples

On `detail` `extended` / `full`, Transform properties that have keyframes or expressions include:

- `value` — sample under the caller's `preExpression` flag (default `true`)
- `authoredValue` — pre-expression (`valueAtTime(..., true)`)
- `evaluatedValue` — post-expression (`valueAtTime(..., false)`)

Wrapper purity / normalization checks MUST use `authoredValue` (or `value` with `preExpression: true`), not post-expression Scale alone.

### `ae_get_item_refs`

Read-only inbound references for one `itemId` (`Item.id`): `used_in_comp`, `layer_source`, proxy/parent/matte links, and heuristic `expression_mention` entries. When `unknownRefsPossible` is true, treat the item as **not** safe to delete (`safe_delete_project_item` refuses). No `deletionCandidate` policy bit — agents decide.

### `ae_patch_project` ops

| Op                         | Purpose                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `set_text_style`           | Set authored TextDocument/CharacterRange font strings (exact string; no synonym mapping)           |
| `rename_layer`             | Rename exactly one timeline layer per op (`target` id\|name + desired `layerName`)                 |
| `rename_project_item`      | Rename a Project panel item by `itemId`                                                            |
| `set_layer_index`          | Reorder one layer to a 1-based `index`                                                             |
| `create_solid`             | Always create a new Solid FootageItem (name, dims, pixelAspect, color; optional folder)            |
| `replace_layer_source`     | Replace AVLayer source; evidence reports `layerIdPreserved` / `newLayerId`                         |
| `set_layer_timing`         | Set start/in/out via **integer frames** (+ optional stretch / timeRemap); seconds-only refused     |
| `set_property_expression`  | Set/clear expression on one PropertyBase — exactly one of `matchNames` \| nexrender `propertyPath` |
| `reset_layer_surface`      | Clear keys/effects/masks/styles/markers/matte/parent (flags); optional transform/expression clears |
| `delete_layer`             | Delete one timeline layer by `target`                                                              |
| `create_folder`            | Create a `FolderItem` under `parentFolderId` (real inventory root id, never a magic `0`)           |
| `move_project_item`        | Move items by `selector.kind: "items"` + `itemIds` into `destinationFolderId`                      |
| `delete_project_item`      | Permissive AE `Item.remove()`; refuses root; may delete in-use items / recurse folders             |
| `safe_delete_project_item` | Delete only when inbound refs are empty and `unknownRefsPossible` is false; empty folders only     |

Successful targets include **post-condition-verified** before/after evidence (apply re-reads live state after the write; `changed` only when it matches the request). See [ADR 0003](adr/0003-patch-targeting-and-post-conditions.md). Prefer `matchNames` from `ae_get_layer` for `set_property_expression` (locale-stable); `propertyPath` splits on `->` when present, otherwise `.`.

#### Layer targeting (id or unique name)

Layer-targeting control-plane ops (`rename_layer`, `set_layer_index`, `replace_layer_source`, `set_layer_timing`, `set_property_expression`, `reset_layer_surface`, `delete_layer`) and each `set_text_style` `selector.kind: "layers"` entry use the same shape as `ae_get_layer`: exactly one of `compId` \| `compName`, exactly one of `layerId` \| `layerName` (case-sensitive exact match). Ambiguous names refuse before mutation with candidate lists. Prefer ids when names may collide.

`set_text_style` `selector.kind: "comps"` accepts `compIds` and/or `compNames` (union; at least one non-empty). Existing `{ compIds: [...] }` and `{ compId, layerId }` payloads remain valid. `all_text_layers` is unchanged. Panel item ops stay on `Item.id`.

#### `rename_layer` example

```json
{
  "op": "rename_layer",
  "target": { "compName": "main", "layerName": "{BrandURL}" },
  "layerName": "{brand_url}"
}
```

Desired `layerName` is opaque (braces / `{message_10}` preserved). AE allows duplicate layer names — LayerCake does not enforce uniqueness. Multi-rename = multiple ops in one `operations` array.

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

Patch mutates **authored / pre-expression** project state: fonts, layer names, and panel structure. Panel ops select by stable `Item.id` only and do **not** read or write `Property.expression` (they do not use `valueAtTime`). For `set_text_style`, apply reads/writes/verifies fonts from the pre-expression `TextDocument` (`valueAtTime(comp.time, true)` when the property has keys or an expression). Target evidence: `fonts` = authored (post-condition source); optional `evaluatedFonts` = post-expression / on-screen sample at composition time. If `after.fonts` matches the request but `after.evaluatedFonts` still differs, an expression (or other live override) is still driving appearance — patch expression source layers (for example a `{font}` controller) next. Deleting an item that owns layers removes those properties with the item; deleting in-use footage may leave expression strings intact while later evaluation fails / sources go missing.

Delete follows After Effects defaults: folders recursively remove contents; in-use footage/comps may be removed. Evidence includes `nestedItemCount` (folders) and the full `usedInCompIds` list (+ count) for AVItems. Disk media files are never deleted. On success, agents MAY reuse the returned `fingerprint` / `dirty` / `revision` for the next `ae_save_project` or patch without an immediate `ae_project_context` re-poll when no other mutator (human UI, `ae_eval_script`, another tool) intervened.

## Agent skill: `drive-after-effects`

LayerCake ships the [Agent Skill](https://agentskills.io/) `drive-after-effects`: host check → open → `ae_project_context` bind → optional `ae_project_summary` → inventory → optional `create_backup` / copy-first `save_copy` → `ae_patch_project` → use returned fingerprint (or re-bind if another mutator may have run) → `save_copy`. Prefer typed patch over raw `ae_eval_script` for routine text-style, layer rename (`rename_layer`), and Project panel create/move/delete.

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
- [Troubleshooting](troubleshooting.md)
