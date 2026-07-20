# LayerCake

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/alphacornutum/layercake/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Give AI agents a reliable way to read, reason about, and change real Adobe After Effects projects.

LayerCake is a local [Model Context Protocol](https://modelcontextprotocol.io/) server that connects an agent to a local After Effects installation on macOS or Windows. It can open projects, inventory compositions and sources, inspect layer property trees, detect common project health problems, apply guarded typed patches, save copies and backups, search the After Effects Scripting Guide offline, and run ExtendScript inside After Effects.

No After Effects plugin or bridge panel has to remain open. LayerCake invokes scripts through AppleScript `DoScriptFile` on macOS or `AfterFX.exe -r` on Windows.

Use it when the first question is not “What should I create?” but “What is actually in this project, how does it work, and how can I change it without losing control?”

Machine IDs such as the npm package, CLI, and MCP config key are lowercase `layercake`. The product name is LayerCake.

## Why LayerCake exists

Most After Effects automation starts with a command: create a composition, add a layer, set a property, apply an effect.

Production work often starts earlier:

- Which composition is the real entry point?
- Which layers are visible at a given time?
- Where does a layer get its source, timing, font, or expression-driven value?
- Which footage, fonts, or third-party effects are missing?
- Will a change hit one exact target or the wrong object with the same name?
- Has a person or another process changed the project since the agent inspected it?
- What changed after the operation, and has anything been saved yet?

An `.aep` is not a stateless drawing surface. It is a live, nested production document with mutable indexes, duplicate names, hidden dependencies, expressions, source interpretation, plugins, fonts, and unsaved human edits.

LayerCake exists for this stateful part of After Effects automation. It gives agents:

- structured inventory before raw scripting;
- stable `Item.id` and `Layer.id` handles for follow-up work;
- a cheap project fingerprint to bind inspection and mutation to the same state;
- guarded typed patches with verified before/after evidence;
- explicit copy, backup, and save semantics;
- deep inspection only when needed, so routine inventory stays compact;
- direct access to ExtendScript when a typed operation does not exist yet;
- a local, searchable copy of the After Effects Scripting Guide.

The goal is simple: make an agent useful inside a real After Effects workflow without pretending the project is simpler than it is.

## Where LayerCake is strongest

### Investigating unfamiliar projects

LayerCake can build a structured map of compositions, layers, sources, folders, timing, expressions, properties, and dependencies. This is useful when inheriting a project, debugging a template, reviewing an external delivery, or finding out why a render behaves differently from the timeline.

### Template engineering and quality assurance

Use LayerCake to turn an `.aep` into inspectable data. Validate expected compositions and placeholders, check layer timing, find missing fonts or footage, identify third-party effects, inspect expression-controlled properties, and compare a project against the conventions of a rendering pipeline.

### Controlled maintenance and migration

LayerCake is designed for workflows where the agent must inspect first, target precisely, apply a known change, verify the result, and save deliberately. Typical jobs include font normalization, layer renaming, Project panel cleanup, template migrations, and repeatable project repairs.

### Agent-assisted production tooling

LayerCake is a useful foundation for systems that need to reason about existing After Effects projects rather than generate a one-off scene. It can sit behind an IDE agent, an internal automation service, a template management workflow, or a larger media-production pipeline.

### After Effects scripting work

The bundled documentation tools let an agent search the Scripting Guide before writing ExtendScript. `ae_eval_script` remains available for unsupported operations, while common high-risk or repetitive operations can graduate into typed tools with validation and post-condition checks.

## What you can ask

Once connected, try prompts like:

> Inspect the currently open After Effects project and give me an overview.

> List every composition and explain how they are connected.

> Show me all layers in the `Main` composition, including source, in/out, and duration.

> Which compositions use `logo-final.png`?

> Find text layers whose authored font differs from the expression-evaluated font.

> Check the project for missing footage, fonts, and third-party effects.

> Rename this exact layer, verify the result, and save the edited project as a copy.

> Search the scripting docs and determine how to duplicate this composition safely.

## What LayerCake can do

- Check whether After Effects is installed and reachable.
- Open and close `.aep` or `.aet` projects with session guards.
- Bind `ae_project_context`, including path, dirty state, revision, and fingerprint.
- Summarize project health, including missing footage, missing fonts, third-party effects, and item counts.
- List compositions and their layers.
- List footage, solids, placeholders, and Project panel folders.
- Resolve inbound references for a project item (`ae_get_item_refs`).
- Inspect a layer property tree at `overview`, `extended`, or `full` depth.
- Inspect a footage item and its interpretation settings.
- Apply typed patches through `ae_patch_project`, including text style, rename, solids and source replace, frame timing, layer switches, composition settings, expressions, layer reset/delete, Project panel ops, and `safe_delete_project_item`.
- Return verified before/after evidence for successful typed mutations.
- Save through explicit `save_copy` or `create_backup` modes.
- Search and read a local copy of the After Effects Scripting Guide.
- Run arbitrary ExtendScript inside After Effects and return structured results.

Typed mutation goes through `ae_patch_project`. `ae_eval_script` is the escape hatch for one-off work and operations that do not yet have a typed tool. See [MCP tools and agent skill](docs/mcp-tools.md).

## How LayerCake works

A typical agent workflow is:

1. **Connect to the host** with `ae_host_status` and open or identify the project.
2. **Bind to project state** with `ae_project_context`.
3. **Inspect before changing** with summary, inventory, and deep inspection tools.
4. **Make the smallest suitable change** with a typed patch, or use reviewed ExtendScript when needed.
5. **Verify and persist deliberately** using returned evidence and `ae_save_project`.

This sequence is built into the bundled `drive-after-effects` agent skill.

## Design principles

### Inspect first

Inventory tools are the default way to understand a project. Raw ExtendScript is available, but agents should not have to rediscover the entire After Effects object model for routine inspection.

### Stable handles over convenient guesses

Names can be duplicated and indexes can change. LayerCake prefers After Effects IDs for follow-up work and refuses ambiguous name-based mutation targets.

### Compact lists, deep inspection on demand

Large property trees consume model context quickly. LayerCake keeps project inventory lean and exposes deeper layer or source inspection separately.

### Guarded state changes

A project fingerprint connects inspection to mutation. Typed patches can reject stale or mismatched project state instead of silently applying a change to whatever happens to be open.

### Typed tools before raw scripts

A typed operation can validate its inputs, use precise targeting, run in an undo group, and verify its post-condition. Raw ExtendScript remains necessary, but it should not be the only abstraction.

### Explicit persistence

Inspection and mutation do not silently overwrite the current project. Saving is a separate action with clear copy and backup behavior.

## What LayerCake is not

LayerCake is not a visual understanding system. It can inspect the After Effects object model, but it does not know whether the rendered frame looks good. For visual quality assurance, pair structural inspection with rendered frames or previews and a vision-capable review step.

LayerCake is also not currently the broadest creation-first command library for After Effects. Its typed mutation surface is intentionally smaller than its inspection surface, and smaller than creation-first MCP tools that optimize for scene authoring. Unsupported work can still be done through `ae_eval_script`, and useful recurring operations can be added as typed tools over time.

LayerCake assumes one agent controls one After Effects session. It does not provide a mutex for multiple clients, and it cannot control features that Adobe does not expose through the After Effects scripting API.

## Related projects

The After Effects MCP ecosystem contains projects with different priorities.

[Dakkshin/after-effects-mcp](https://github.com/Dakkshin/after-effects-mcp) provides a broad creation and editing command set through a persistent ScriptUI bridge panel. It is a good fit when the main job is to create compositions, layers, shapes, cameras, masks, keyframes, expressions, and effects through task-specific MCP commands.

LayerCake is a better fit when the main job is to inspect an existing project, reason about its structure and dependencies, bind operations to known project state, target stable objects, and make controlled changes with explicit verification and saving.

Neither approach makes the other unnecessary. They start from different workflow problems. See [Related projects and choosing an After Effects MCP](docs/related-projects.md) for a detailed, neutral comparison.

## Requirements

- Adobe After Effects installed locally
- Node.js 20 or newer
- An MCP-compatible agent or client
- macOS or Windows
  - macOS uses AppleScript `DoScriptFile`.
  - Windows uses `AfterFX.exe -r`.

Windows host control has been smoke-tested with After Effects in a Windows 11 VM running in UTM.

## Quickstart

```bash
git clone https://github.com/alphacornutum/layercake.git
cd layercake
npm install
npm run docs:fetch
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
```

1. In After Effects, open **Preferences → Scripting & Expressions** and enable **Allow Scripts To Write Files And Access Network**.
2. Configure the After Effects host:
   - macOS: set `AE_APP_NAME`, for example `Adobe After Effects 2025`.
   - Windows: set `AE_EXECUTABLE` to `AfterFX.exe` inside the After Effects `Support Files` directory.
3. Run `npm run build`.
4. Add a stdio MCP server named `layercake` that points to the absolute path of `dist/index.js`.

### macOS MCP configuration

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

### Windows MCP configuration

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

For development configuration, install variants, and verification steps, see [Setup and connection](docs/setup.md).

## Verify

Open After Effects and ask your agent:

> Use LayerCake to check the After Effects host status.

Then ask:

> List the compositions in the currently open project.

This confirms that the agent can start LayerCake, LayerCake can reach After Effects, scripts can run, and structured results can return to the agent.

## Tools and agent skill

Inventory tools (`ae_project_summary`, `ae_list_*`, `ae_get_*`), documentation tools (`ae_docs_*`), typed patch and save tools, and `ae_eval_script` are registered automatically.

Prefer IDs over names for follow-up work. Use `ae_project_summary` after opening a project when you need a quick project passport with counts, third-party effects, missing footage, and missing fonts.

The `drive-after-effects` skill ships in `skills/`. You can copy or symlink it into an agent’s skills folder, or load it through the MCP resources `skill://drive-after-effects/SKILL.md` and `skill://index.json`.

See [MCP tools and agent skill](docs/mcp-tools.md) for the full tool table, target IDs, patch operations, and skill details.

## Safety

`ae_eval_script` can change the open project, write files, and trigger work that is difficult to undo. Inspect first, work on a copy for important projects, and review destructive scripts before running them.

Typed patches are safer than arbitrary scripting, but they still change the live After Effects project. Use the project fingerprint guard, verify returned evidence, and persist through an explicit save operation.

See [Setup and connection](docs/setup.md) and [Security policy](SECURITY.md).

## Documentation

| Document                                          | Contents                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Setup and connection](docs/setup.md)             | Installation, After Effects preferences, MCP configuration, verification, and safety            |
| [MCP tools and agent skill](docs/mcp-tools.md)    | Tool reference, IDs, patch operations, save behavior, and the bundled skill                     |
| [Related projects](docs/related-projects.md)      | How LayerCake differs from creation-first After Effects MCP tools and when to use each approach |
| [Troubleshooting](docs/troubleshooting.md)        | Symptoms, environment variables, limitations, and common fixes                                  |
| [Scripting guide corpus](docs/scripting-guide.md) | Offline guide setup and attribution                                                             |
| [Architecture](ARCHITECTURE.md)                   | System map, module boundaries, runtime flow, and design constraints                             |
| [Architecture decision records](docs/adr/)        | Reasons behind hard-to-reverse technical decisions                                              |
| [Contributing](CONTRIBUTING.md)                   | Development workflow and pull request checklist                                                 |

## License

MIT. See [LICENSE](LICENSE).

The guide markdown under `vendor/` remains Adobe and docsforadobe content. See [Scripting guide corpus](docs/scripting-guide.md).
