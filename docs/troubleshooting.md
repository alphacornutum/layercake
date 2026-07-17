# Troubleshooting

## Agent cannot start LayerCake

Check that:

- Node.js 20 or newer is installed
- `npm install` completed
- For a built entrypoint: `npm run build` produced `dist/index.js`
- The path in MCP config is **absolute**
- The `command` (`node` or `npx`) exists in the environment used by the agent

Agents do not always inherit your terminal’s shell environment. Absolute paths for both Node and LayerCake help.

## After Effects reported unavailable

**macOS:**

- Verify `AE_APP_NAME` matches `/Applications` (year suffix matters)
- Or set `AE_EXECUTABLE` to the full `.app` path

**Windows:**

- Set `AE_EXECUTABLE` to the full path of `AfterFX.exe` under `Support Files`
- Confirm the agent and After Effects run under the same Windows user

Ask the agent: _Use `ae_host_status` and show me the resolved configuration._

## Scripts run but no result returns

In After Effects, enable:

**Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network**

Also dismiss open modal dialogs; they can block scripts from finishing.

## Script times out

Default timeout is 60 seconds (`AE_SCRIPT_TIMEOUT_MS=60000`). Increase if needed:

```bash
AE_SCRIPT_TIMEOUT_MS=120000
```

Long renders or dialogs can still block completion.

## Documentation tools fail

```bash
npm run docs:fetch
```

Or point `AE_DOCS_PATH` at a directory of guide markdown. See [scripting-guide.md](scripting-guide.md).

## Inspection response too large

Deep layer/source dumps are capped (default `AE_INSPECT_MAX_BYTES=524288`). Raise if needed:

```bash
AE_INSPECT_MAX_BYTES=1048576
```

Start with `overview` or `extended` before `full` — large property trees consume a lot of model context.

## Linux / other OS

Expected: the After Effects host bridge is **macOS and Windows only**. Documentation tools may still work.

## Environment variables

| Variable               | Description                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `AE_APP_NAME`          | macOS: AppleScript application name (e.g. `Adobe After Effects 2025`). Optional display on Windows |
| `AE_EXECUTABLE`        | macOS: path to `.app`. **Windows: required** path to `AfterFX.exe`                                 |
| `AE_SCRIPT_TIMEOUT_MS` | ExtendScript timeout in ms (default `60000`)                                                       |
| `AE_INSPECT_MAX_BYTES` | Max UTF-8 bytes for `ae_get_layer` / `ae_get_source` success JSON (default `524288`)               |
| `AE_DOCS_PATH`         | Override scripting-guide directory (default `vendor/after-effects-scripting-guide/docs`)           |

See [`.env.example`](../.env.example).

## Limitations

LayerCake works through the After Effects scripting API. Features Adobe does not expose to scripting cannot be controlled here.

Results also depend on the agent and language model. Review generated ExtendScript before important or destructive changes.

Dedicated mutation tools (rename layer, create comp, etc.) are out of scope for now — use `ae_eval_script`.

## See also

- [Setup and connection](setup.md)
- [MCP tools and skill](mcp-tools.md)
