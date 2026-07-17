# MCP tools and agent skill

Your agent discovers these tools automatically through MCP. Prefer inventory tools before `ae_eval_script` for inspection.

## Tools

| Tool              | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `ae_host_status`  | Resolved host config and availability                                                |
| `ae_open_project` | Open an absolute `.aep` or `.aet` path in After Effects                              |
| `ae_list_comps`   | Read-only JSON inventory of compositions and their layers                            |
| `ae_list_sources` | Read-only JSON inventory of footage, solids, and placeholders                        |
| `ae_list_folders` | Read-only nested JSON tree of the Project panel folder hierarchy                     |
| `ae_get_layer`    | Read-only deep dump of one layer property tree (`overview` / `extended` / `full`)    |
| `ae_get_source`   | Read-only deep dump of one footage item and interpret settings (`overview` / `full`) |
| `ae_eval_script`  | Execute ExtendScript inside After Effects (`script`, optional `timeoutMs`)           |
| `ae_docs_search`  | Search the local After Effects Scripting Guide (hits include `ae://docs/...` URIs)   |
| `ae_docs_get`     | Fetch a documentation section by URI or relative path                                |

**Resources:** scripting guide under `ae://docs/{path}` (list + read); product skill under `skill://` (below).

Every evaluated script is prepended with [extendscript-json](https://github.com/theasci/extendscript-json) so `JSON.stringify` / `JSON.parse` work in After Effects’ ES3 host. Prefer scripts that `return` a value and avoid modal dialogs.

For payload shape and architecture detail, see [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Project item IDs

After Effects uses separate ID namespaces for timeline layers and Project panel items:

- **`Layer.id`** — a layer in a composition
- **`Item.id`** — compositions, footage, folders, and other project items
- **`layer.source.id`** — joins a layer to its source item (`Item.id`)

For follow-up work, prefer IDs over names or indexes. Names can be duplicated; indexes can change.

## Agent skill: `drive-after-effects`

LayerCake ships the [Agent Skill](https://agentskills.io/) `drive-after-effects`: host check → open project (absolute path) → inventory → docs → id-based `ae_eval_script`.

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
