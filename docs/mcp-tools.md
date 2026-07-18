# MCP tools and agent skill

Your agent discovers these tools automatically through MCP. Prefer inventory tools before `ae_eval_script` for inspection.

## Tools

| Tool                 | Purpose                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `ae_host_status`     | Resolved host config and availability                                                          |
| `ae_open_project`    | Open an absolute `.aep` / `.aet` path (refuses if another project is open at a different path) |
| `ae_close_project`   | Close with explicit `discard` or `save` policy (never prompts); optional fingerprint guard     |
| `ae_project_context` | Cheap bind token: path, dirty, revision, fingerprint (poll before/after mutate)                |
| `ae_project_summary` | Heavier passport: counts, third-party effects, missing footage/fonts                           |
| `ae_list_comps`      | Read-only JSON inventory of compositions and their layers                                      |
| `ae_list_sources`    | Read-only JSON inventory of footage, solids, and placeholders                                  |
| `ae_list_folders`    | Read-only nested JSON tree of the Project panel folder hierarchy                               |
| `ae_get_layer`       | Read-only deep dump of one layer property tree (`overview` / `extended` / `full`)              |
| `ae_get_source`      | Read-only deep dump of one footage item and interpret settings (`overview` / `full`)           |
| `ae_patch_project`   | Apply-only typed mutations (`set_text_style`); path+fingerprint guards; no implicit save       |
| `ae_save_project`    | Explicit persist: `save_copy` or `create_backup` (no in-place `save_current`)                  |
| `ae_eval_script`     | Execute ExtendScript inside After Effects (`script`, optional `timeoutMs`)                     |
| `ae_docs_search`     | Search the local After Effects Scripting Guide (hits include `ae://docs/...` URIs)             |
| `ae_docs_get`        | Fetch a documentation section by URI or relative path                                          |

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

## Agent skill: `drive-after-effects`

LayerCake ships the [Agent Skill](https://agentskills.io/) `drive-after-effects`: host check → open → `ae_project_context` bind → optional `ae_project_summary` → inventory → optional `create_backup` → `ae_patch_project` → re-bind → `save_copy`. Prefer typed patch over raw `ae_eval_script` for routine fixes.

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
