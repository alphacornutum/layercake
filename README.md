# LayerCake 🍰🎬

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Let AI agents inspect and control Adobe After Effects.**

LayerCake is a local [MCP](https://modelcontextprotocol.io/) server that connects an agent to a **local** Adobe After Effects install. Agents can open projects, inspect comps and layers, explore footage and folders, search the Scripting Guide offline, and run ExtendScript inside AE.

Use it to explore an unfamiliar project, investigate timing and expressions, or make controlled changes without digging through every composition by hand.

Machine IDs (package, MCP config key, CLI) are lowercase `layercake`. The product name is **LayerCake**.

## What you can ask

Once connected, try prompts like:

> Inspect the currently open After Effects project and give me an overview.

> List every composition and explain how they are connected.

> Show me all layers in the `Main` composition, including source, in/out, and duration.

> Which compositions use `logo-final.png`?

> Move the lower-third animation two seconds earlier without changing its duration.

> Check the scripting docs and determine how to duplicate this composition safely.

## What LayerCake can do

- Check whether After Effects is available
- Open `.aep` / `.aet` projects
- List compositions, layers, footage, solids, placeholders, and folders
- Inspect a layer’s property tree or a footage item’s interpretation
- Search the After Effects Scripting Guide locally
- Run ExtendScript inside After Effects and return structured results

Dedicated tools for mutations (rename layer, create comp, …) are **not** included yet. Changes go through `ae_eval_script`.

## Requirements

- Adobe After Effects (local install)
- Node.js 20+
- An MCP-compatible agent or client
- **macOS** or **Windows** (AppleScript `DoScriptFile` / `AfterFX.exe -r`). Windows has been smoke-tested with AE in a Windows 11 VM (UTM).

## Quickstart

```bash
git clone https://github.com/alphacornutum/layercake.git
cd layercake
npm install
npm run docs:fetch
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
```

1. In After Effects: **Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network**
2. Point env at AE — macOS: `AE_APP_NAME="Adobe After Effects 2025"`; Windows: `AE_EXECUTABLE` → `AfterFX.exe` under `Support Files`
3. `npm run build` then add a stdio MCP server named `layercake` (absolute path to `dist/index.js`)

**macOS MCP sketch:**

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

**Windows MCP sketch:**

```json
{
  "mcpServers": {
    "layercake": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\layercake\\dist\\index.js"],
      "env": {
        "AE_EXECUTABLE": "C:\\Program Files\\Adobe\\Adobe After Effects 2025\\Support Files\\AfterFX.exe"
      }
    }
  }
}
```

Full install variants, `tsx`/dev config, and verify steps: **[docs/setup.md](docs/setup.md)**.

## Verify

Open After Effects and ask: _Use LayerCake to check the After Effects host status._ Then: _List the compositions in the open project._

## Tools and skill

Inventory tools (`ae_project_summary`, `ae_list_*`, `ae_get_*`), docs tools (`ae_docs_*`), and `ae_eval_script` are registered automatically. Prefer IDs over names for follow-up work. Use `ae_project_summary` after open when you need a quick passport (third-party effects, missing footage/fonts, counts).

The **`drive-after-effects`** skill ships in `skills/` (copy or symlink into your agent’s skills folder) and as MCP resources `skill://drive-after-effects/SKILL.md` and `skill://index.json`.

Full tool table, ID namespaces, and skill detail: **[docs/mcp-tools.md](docs/mcp-tools.md)**.

## Safety

`ae_eval_script` can change the open project. Save or work on a copy first; ask the agent to inspect and show destructive scripts before running them. Details: [docs/setup.md](docs/setup.md#safety).

## More docs

| Doc                                                | Contents                                      |
| -------------------------------------------------- | --------------------------------------------- |
| [docs/setup.md](docs/setup.md)                     | Install, AE prefs, MCP config, verify, safety |
| [docs/mcp-tools.md](docs/mcp-tools.md)             | Tools, IDs, agent skill                       |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Symptoms, env vars, limitations               |
| [docs/scripting-guide.md](docs/scripting-guide.md) | Offline guide corpus and attribution          |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | Development and PR checklist                  |
| [ARCHITECTURE.md](ARCHITECTURE.md)                 | System map                                    |
| [docs/adr/](docs/adr/)                             | Architecture decision records                 |

## License

MIT — see [LICENSE](LICENSE). Guide markdown under `vendor/` remains Adobe / docsforadobe content — see [docs/scripting-guide.md](docs/scripting-guide.md).
