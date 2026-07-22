# LayerCake

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/alphacornutum/layercake/actions)
[![After Effects 26+](https://img.shields.io/badge/After%20Effects-26%2B-997B66)](docs/setup.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Use professionally designed After Effects projects as agent-ready video templates.**

_Template-first, state-aware After Effects automation for AI agents._

LayerCake is a local [Model Context Protocol](https://modelcontextprotocol.io/) server that lets agents inspect, fill, adapt, and validate existing Adobe After Effects projects.

Instead of rebuilding motion design from scratch, an agent can work with a ready-made `.aep` template: find the right compositions and layers, understand timing and dependencies, insert content, make controlled changes, and save the result as a new project.

LayerCake runs scripts directly through After Effects on macOS and Windows. No plugin or bridge panel has to remain open.

## What LayerCake is for

### Fill After Effects templates

Use professionally designed projects as the basis for automated video production. Agents can identify placeholders, update content through typed tools or ExtendScript, preserve the existing animation, and create project variants.

### Generate variations

Adapt one template for different customers, products, languages, campaigns, or formats without recreating the motion design for every output.

### Understand existing projects

Inspect compositions, layers, sources, timing, expressions, fonts, effects, and footage interpretation before changing anything.

### Validate production templates

Check for missing footage, missing fonts, third-party effects, broken assumptions, or unexpected project structure before a project enters a rendering pipeline.

### Maintain projects safely

Target exact objects, detect when project state has changed, verify mutations, and save copies or backups explicitly.

## What you can ask

> Inspect this project and identify its editable text, image, logo, and video layers.

> Explain how the main composition and its precompositions are connected.

> Replace the customer name and logo while preserving the existing animation.

> Create three versions of this project using different product assets.

> Show the timing, expressions, and animated properties of this layer.

> Check the project for missing footage, fonts, and third-party effects.

> Move the lower-third animation two seconds earlier without changing its duration.

> Save the completed version as a new project without overwriting the template.

## Why state-aware?

After Effects projects are live, nested documents. Names can be duplicated, indexes move, expressions affect property values, and a person can edit the open project between two agent operations.

LayerCake gives agents enough context to act deliberately:

- compact project inventories with deep inspection on demand
- stable After Effects IDs for follow-up operations
- project fingerprints that detect stale state
- guarded typed patches with verified before-and-after results
- explicit save-copy and backup operations
- direct ExtendScript access for unsupported work

Inspection is not the end goal. It is what makes reliable template automation possible.

## Features

### Project inspection

- Open and close `.aep` and `.aet` projects
- Read project path, dirty state, revision, and fingerprint
- Summarize project health
- List compositions and their layers
- List footage, solids, placeholders, and folders
- Resolve inbound references for a project item
- Inspect layer property trees
- Inspect footage interpretation settings
- Detect missing footage and fonts
- Identify third-party effects

### Project editing

Typed mutations go through `ae_patch_project`. Current operations include:

- text style and layer rename
- layer timing (frame-exact), switches, transform, index, and delete
- composition settings and property expressions
- create solid, replace layer source, and reset layer surface
- Project panel create/move/rename/delete, plus `safe_delete_project_item`

Typed patches validate their targets, can reject stale project state, and return verified before-and-after evidence. They do not save the project implicitly.

Use `ae_eval_script` for template-filling steps and other edits that do not yet have a typed tool.

### After Effects scripting

LayerCake includes a searchable local copy of the After Effects Scripting Guide. Agents can consult the object model before writing and running ExtendScript.

Scripts execute inside After Effects and can return structured results to the agent.

### Explicit saving

LayerCake separates editing from persistence:

- `save_copy` saves the active project to a new path and continues working on that copy
- `create_backup` copies the clean project file without changing the active project

## How it works

A typical workflow looks like this:

1. Open or identify the After Effects project.
2. Bind to its current state.
3. Inventory compositions, layers, sources, and dependencies.
4. Inspect the relevant template controls or placeholders.
5. Apply a typed patch or reviewed ExtendScript.
6. Verify the result.
7. Save a copy or create a backup.

LayerCake drives After Effects through:

- AppleScript `DoScriptFile` on macOS
- `AfterFX.exe -r` on Windows

## Requirements

- Adobe After Effects **26+** (supported baseline; older versions may work but are unsupported)
- Node.js 20 or newer
- An MCP-compatible agent or client
- macOS or Windows

Windows host control has been smoke-tested with After Effects in a Windows 11 VM running in UTM.

## Quickstart

```bash
git clone https://github.com/alphacornutum/layercake.git
cd layercake
npm install
npm run docs:fetch
npm run build
```

Copy the environment template:

```bash
# macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

In After Effects, enable:

> Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network

Configure the local After Effects installation.

On macOS:

```bash
AE_APP_NAME="Adobe After Effects 2026"
```

On Windows:

```text
AE_EXECUTABLE=C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe
```

Add LayerCake as a stdio MCP server.

### macOS example

```json
{
  "mcpServers": {
    "layercake": {
      "command": "node",
      "args": ["/absolute/path/to/layercake/dist/index.js"],
      "env": {
        "AE_APP_NAME": "Adobe After Effects 2026"
      }
    }
  }
}
```

### Windows example

```json
{
  "mcpServers": {
    "layercake": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\layercake\\dist\\index.js"],
      "env": {
        "AE_EXECUTABLE": "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe"
      }
    }
  }
}
```

See [Setup and connection](docs/setup.md) for development configurations, installation variants, and troubleshooting.

Machine IDs such as the npm package, CLI, and MCP configuration key use lowercase `layercake`. The product name is LayerCake.

## Verify the connection

Open After Effects and ask your agent:

> Use LayerCake to check the After Effects host status.

Then ask:

> Inspect the currently open project and list its compositions.

## Tools and agent skill

LayerCake registers its inventory, inspection, patch, save, documentation, and ExtendScript tools automatically.

The bundled `drive-after-effects` skill teaches compatible agents to inspect before mutating, prefer stable IDs, verify changes, and save deliberately. It ships in `skills/`; you can copy or symlink it into an agent’s skills folder, or load it through the MCP resources `skill://drive-after-effects/SKILL.md` and `skill://index.json`.

See [MCP tools and agent skill](docs/mcp-tools.md) for the complete tool reference.

## Related projects

[Dakkshin/after-effects-mcp](https://github.com/Dakkshin/after-effects-mcp) takes a creation-first approach. It provides ready-made commands for constructing compositions, layers, shapes, cameras, masks, keyframes, expressions, and effects through a persistent ScriptUI bridge.

LayerCake is **template-first and state-aware**. It focuses on using existing After Effects projects as reliable production templates: understanding their structure, finding exact targets, working against known project state, and verifying changes.

Both approaches are useful:

- Choose a creation-first tool when the main job is building a scene through predefined creative commands.
- Choose LayerCake when the main job is filling, adapting, validating, or maintaining an existing After Effects project.

See [Choosing an After Effects MCP](docs/related-projects.md) for a detailed comparison.

## Current limitations

- The typed editing surface covers common inspect-and-edit jobs, but many template-filling steps still need ExtendScript.
- Raw `ae_eval_script` does not provide all the guards of typed patches.
- LayerCake does not visually judge rendered output.
- One agent should control one After Effects session.
- Features unavailable through Adobe’s scripting API cannot be automated.

## Documentation

- [Setup and connection](docs/setup.md)
- [MCP tools and agent skill](docs/mcp-tools.md)
- [Choosing an After Effects MCP](docs/related-projects.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Scripting Guide corpus](docs/scripting-guide.md)
- [Architecture](ARCHITECTURE.md)
- [Architecture decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)

## Safety

`ae_eval_script` can change the open project, write files, and perform operations that are difficult to undo.

Inspect first, review destructive scripts, and work on a copy when the source project matters. Typed patches provide stronger targeting and verification, but they still modify the live After Effects project.

See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

The Scripting Guide content under `vendor/` retains its original Adobe and docsforadobe licensing and attribution. See [Scripting Guide corpus](docs/scripting-guide.md).
