# LayerCake — MCP for Adobe After Effects

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**LayerCake** is a stdio [MCP](https://modelcontextprotocol.io/) server that drives a **local Adobe After Effects** install from an agent: open projects, inventory comps/sources/folders, inspect layers and footage, evaluate ExtendScript, and search the Scripting Guide offline.

> Machine IDs stay lowercase `layercake` (repo, npm package, MCP config key, `serverInfo.name`, CLI bin). Product display name is **LayerCake**. Tool names (`ae_*`) and the product skill id (`drive-after-effects`) are unchanged. Formerly `after-effects-driver-mcp` / privately `afx-inspector`.

## Requirements

- **macOS or Windows** — After Effects host control uses AppleScript on macOS (`DoScriptFile`) and `AfterFX.exe -r` on Windows. Other platforms report the bridge unavailable; docs tools may still work.
- **Node.js 20+**
- **Adobe After Effects** installed locally

> **Windows note:** The Windows host bridge is implemented and covered by mocked unit tests. Live smoke against a licensed AE install on a Windows VM is still pending — treat Windows as functional but hardware-unverified until that checklist passes (see [Windows VM smoke](#windows-vm-smoke)).

## Scope

**In:** open a project, read-only inventory and deep inspect, scripting-guide search/get, and catchall ExtendScript via `ae_eval_script`.

**Out:** dedicated mutation tools (rename layer, create comp, etc.). Mutations go through `ae_eval_script` until use cases justify first-class write tools.

## Quickstart

### macOS

```bash
npm install
npm run docs:fetch    # vendors scripting-guide markdown into vendor/
cp .env.example .env  # then edit AE_APP_NAME / AE_EXECUTABLE

# resolve your AE app name, e.g.:
# ls /Applications | grep -i "After Effects"

export AE_APP_NAME="Adobe After Effects 2025"
# export AE_EXECUTABLE="/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app"

npm run dev           # stdio MCP server
```

### Windows

```bash
npm install
npm run docs:fetch
cp .env.example .env

# Path to AfterFX.exe (version/year folder varies):
set AE_EXECUTABLE=C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\AfterFX.exe

npm run dev
# Live host e2e (same gates as macOS):
# npm run test:ae
```

In After Effects, enable **Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network** so the result-file eval protocol can write.

### Cursor MCP

Add to Cursor MCP settings (adjust paths):

**macOS:**

```json
{
  "mcpServers": {
    "layercake": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/layercake/src/index.ts"],
      "env": {
        "AE_APP_NAME": "Adobe After Effects 2025",
        "AE_EXECUTABLE": "/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app"
      }
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "layercake": {
      "command": "npx",
      "args": ["tsx", "C:\\absolute\\path\\to\\layercake\\src\\index.ts"],
      "env": {
        "AE_EXECUTABLE": "C:\\Program Files\\Adobe\\Adobe After Effects 2025\\Support Files\\AfterFX.exe"
      }
    }
  }
}
```

Or after `npm run build` (macOS example):

```json
{
  "mcpServers": {
    "layercake": {
      "command": "node",
      "args": ["/absolute/path/to/layercake/dist/index.js"],
      "env": {
        "AE_APP_NAME": "Adobe After Effects 2025"
      }
    }
  }
}
```

## Environment

| Variable               | Description                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `AE_APP_NAME`          | macOS: AppleScript application name (e.g. `Adobe After Effects 2025`). Optional display-only on Windows. |
| `AE_EXECUTABLE`        | macOS: path to `.app` (validation / derive app name). **Windows: required** path to `AfterFX.exe`.       |
| `AE_SCRIPT_TIMEOUT_MS` | ExtendScript timeout (default `60000`)                                                                   |
| `AE_INSPECT_MAX_BYTES` | Max UTF-8 bytes for `ae_get_layer` / `ae_get_source` success JSON (default `524288`)                     |
| `AE_DOCS_PATH`         | Override docs corpus directory (default `vendor/after-effects-scripting-guide/docs`)                     |

See [`.env.example`](.env.example).

## MCP tools

| Tool              | Purpose                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `ae_host_status`  | Resolved host config / availability                                                 |
| `ae_open_project` | Open absolute `.aep` / `.aet` path in AE                                            |
| `ae_eval_script`  | Evaluate ExtendScript (`script`, optional `timeoutMs`)                              |
| `ae_list_comps`   | Read-only JSON inventory of comps + layers (optional `compIds` / `compNames`)       |
| `ae_list_sources` | Read-only JSON inventory of project `FootageItem`s (file / solid / placeholder)     |
| `ae_list_folders` | Read-only nested JSON tree of the Project panel folder hierarchy                    |
| `ae_get_layer`    | Read-only deep dump of one layer property tree (`overview` / `extended` / `full`)   |
| `ae_get_source`   | Read-only deep dump of one `FootageItem` + interpret settings (`overview` / `full`) |
| `ae_docs_search`  | Search local scripting guide (hits include `ae://docs/...` URIs)                    |
| `ae_docs_get`     | Fetch a doc section by URI or relative path                                         |

**Resources:** scripting guide under `ae://docs/{path}` (list + read); product skill under `skill://` (see below).

**Warning:** `ae_eval_script` can mutate the open project. Prefer scripts that `return` a value and avoid modal dialogs.

**Id namespaces:** `Layer.id` (timeline) and `Item.id` (comps, footage, folders) are different spaces. Join via `layer.source.id`. Prefer stable `id` over `index` or name for follow-up work. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for payload and layer details.

Every evaluated script is prepended with [extendscript-json](https://github.com/theasci/extendscript-json) so `JSON.stringify` / `JSON.parse` work in AE’s ES3 host.

## Agent skill

The package ships one end-user [Agent Skill](https://agentskills.io/), `drive-after-effects`: host check → open project (absolute path) → inventory → docs → id-based `ae_eval_script`.

### Filesystem install

```bash
cp -R skills/drive-after-effects /path/to/your/agent/skills/drive-after-effects
# or: ln -s "$(pwd)/skills/drive-after-effects" /path/to/your/agent/skills/drive-after-effects
```

The published npm package (`layercake`) includes `skills/` alongside `dist/`. The CLI binary is also `layercake`.

### MCP resources (SEP-2640)

| URI                                    | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| `skill://drive-after-effects/SKILL.md` | Skill entrypoint (markdown)        |
| `skill://index.json`                   | Discovery index (`type: skill-md`) |

When the skill loads, the server advertises `io.modelcontextprotocol/skills` and sets initialize `instructions` that point agents at `skill://drive-after-effects/SKILL.md`.

## Troubleshooting

| Symptom                  | What to try                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Host not configured      | macOS: set `AE_APP_NAME` and/or `AE_EXECUTABLE`. Windows: set `AE_EXECUTABLE` to `AfterFX.exe`. |
| Wrong app name (macOS)   | Match the name in `/Applications` (year suffix matters)                                         |
| Script timeout           | Increase `AE_SCRIPT_TIMEOUT_MS`; dismiss AE dialogs                                             |
| No result file (Windows) | Enable “Allow Scripts To Write Files And Access Network” in AE preferences                      |
| Docs tools fail          | `npm run docs:fetch` or set `AE_DOCS_PATH`                                                      |
| Linux / other OS         | Expected — host bridge is macOS + Windows only; docs tools may still run                        |

## Windows VM smoke

On a Windows machine with AE installed (not run in CI):

**Automated:** set `AE_EXECUTABLE` (see [`fixtures/README.md`](fixtures/README.md)), then:

```bash
npm run test:ae
```

**Manual MCP checklist** (if you prefer tool-by-tool):

1. Start the MCP server (`npm run dev` or built `dist/`).
2. `ae_host_status` → `available: true`, `platform` reflecting Windows.
3. `ae_open_project` with an absolute path to a fixture `.aep`.
4. `ae_eval_script` with `return app.project.numItems;` → success payload.
5. `ae_list_comps` → JSON inventory for the open project.

When `test:ae` (or the checklist) passes, the “hardware-unverified” caveat above can be dropped.

## Docs attribution

Guide content comes from [docsforadobe/after-effects-scripting-guide](https://github.com/docsforadobe/after-effects-scripting-guide) (originally Adobe’s CS6 Scripting Guide). **© Adobe Systems Incorporated.** Educational / offline agent use.

We vendor the guide markdown under `vendor/` (via `npm run docs:fetch`) rather than an npm dependency — upstream is a MkDocs docs repo, not a Node package. See [docs/adr/0001-vendor-scripting-guide-corpus.md](docs/adr/0001-vendor-scripting-guide-corpus.md).

You can also use [Context7’s packaging](https://context7.com/docsforadobe/after-effects-scripting-guide) of the same guide as a complementary MCP; this server’s `ae_docs_*` tools work offline without Context7.

## License

MIT — see [LICENSE](LICENSE). Guide markdown under `vendor/` remains Adobe / docsforadobe content — see `vendor/after-effects-scripting-guide/ATTRIBUTION.md` after fetch.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, AgentSync, OpenSpec, and the PR checklist.
