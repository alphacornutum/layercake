# Setup and connection

Install LayerCake, point it at Adobe After Effects, and connect it to an MCP-compatible agent.

## Install

```bash
git clone https://github.com/alphacornutum/layercake.git
cd layercake
npm install
npm run docs:fetch
```

`npm run docs:fetch` downloads a local copy of the After Effects Scripting Guide so agents can search it offline (also shipped under `vendor/` in the npm package). See [scripting-guide.md](scripting-guide.md).

### Environment file

**macOS / Linux:**

```bash
cp .env.example .env
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your After Effects paths (below). See also [`.env.example`](../.env.example).

## After Effects preference

In After Effects, enable:

**Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network**

LayerCake uses a result file to receive values from scripts running inside After Effects. Without this preference, scripts may run but return no result.

## Configure the After Effects executable

### macOS

Set the application name and/or full `.app` path:

```bash
export AE_APP_NAME="Adobe After Effects 2026"
# optional:
# export AE_EXECUTABLE="/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app"
```

Find the installed name:

```bash
ls /Applications | grep -i "After Effects"
```

The year in the name must match your install.

### Windows

Set the path to `AfterFX.exe` (required):

```powershell
$env:AE_EXECUTABLE = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
```

Or in `cmd.exe`:

```bat
set AE_EXECUTABLE=C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe
```

The version/year folder may differ. The path should point into the `Support Files` directory.

Windows host control has been smoke-tested with After Effects in a Windows 11 virtual machine (UTM).

## Start LayerCake

Development (stdio MCP on stdout):

```bash
npm run dev
```

Built install:

```bash
npm run build
node dist/index.js
```

The CLI binary name is also `layercake` when installed from the package.

## Connect to an agent

Add LayerCake as a **stdio** MCP server. Exact config file location depends on your client; the important values are:

- **Command:** `node` (or `npx` + `tsx` during development)
- **Entrypoint:** absolute path to `dist/index.js` (or `src/index.ts`)
- **Env:** `AE_APP_NAME` / `AE_EXECUTABLE` as above; optional `AE_ARTIFACT_DIR` for backups (default: OS temp `layercake-artifacts-<pid>`)
- **MCP key:** `layercake`

Use an **absolute path**. Relative paths often fail because agents may start MCP servers from a different working directory.

After changing MCP config, restart the agent or reload its MCP servers.

### Built server (recommended)

**macOS:**

```json
{
  "mcpServers": {
    "layercake": {
      "command": "node",
      "args": ["/absolute/path/to/layercake/dist/index.js"],
      "env": {
        "AE_APP_NAME": "Adobe After Effects 2026",
        "AE_EXECUTABLE": "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app"
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
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\layercake\\dist\\index.js"],
      "env": {
        "AE_EXECUTABLE": "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe"
      }
    }
  }
}
```

Run `npm run build` first so `dist/index.js` exists.

### Development (TypeScript via tsx)

**macOS:**

```json
{
  "mcpServers": {
    "layercake": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/layercake/src/index.ts"],
      "env": {
        "AE_APP_NAME": "Adobe After Effects 2026"
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
        "AE_EXECUTABLE": "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe"
      }
    }
  }
}
```

## Verify

1. Open After Effects.
2. Ask your agent: _Use LayerCake to check the After Effects host status._
3. Expect the host to be available.
4. Ask: _Inspect the currently open After Effects project and list its compositions._

That confirms the agent can start LayerCake, LayerCake can reach After Effects, scripts can run, and results return to the agent.

Host integration tests (local AE required):

```bash
npm run test:ae
```

On Windows, set `AE_EXECUTABLE` first. See [`fixtures/README.md`](../fixtures/README.md) for fixture notes.

### Manual host checklist

1. Start the MCP server (`npm run dev` or built `dist/`).
2. `ae_host_status` → available; platform matches your OS.
3. `ae_open_project` with an absolute path to a `.aep`.
4. `ae_eval_script` with `return app.project.numItems;` → success.
5. `ae_list_comps` → JSON inventory.

## Safety

`ae_eval_script` can change the open project: add/remove/rename items, change timing, replace footage, save, write files, or trigger hard-to-undo work.

Before substantial changes:

1. Save the project (or work on a copy).
2. Ask the agent to inspect first and to show destructive scripts before running them.
3. Verify results before overwriting an important original.

For first tests, use a disposable project.

## See also

- [MCP tools and agent skill](mcp-tools.md)
- [Related projects and choosing an After Effects MCP](related-projects.md)
- [Troubleshooting](troubleshooting.md)
- [Scripting guide corpus](scripting-guide.md)
