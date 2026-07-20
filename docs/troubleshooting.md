# Troubleshooting

## Agent cannot start LayerCake

Check that:

- Node.js 20 or newer is installed.
- `npm install` completed.
- For a built entrypoint, `npm run build` produced `dist/index.js`.
- The path in MCP config is absolute.
- The configured command, usually `node` or `npx`, exists in the environment used by the agent.

Agents do not always inherit your terminal’s shell environment. Absolute paths for both Node and LayerCake help.

## After Effects reported unavailable

### macOS

- Verify that `AE_APP_NAME` matches the name under `/Applications`. The year suffix matters.
- Or set `AE_EXECUTABLE` to the full `.app` path.

### Windows

- Set `AE_EXECUTABLE` to the full path of `AfterFX.exe` under `Support Files`.
- Confirm that the agent and After Effects run under the same Windows user.

Ask the agent:

> Use `ae_host_status` and show me the resolved configuration.

## After Effects steals focus on every tool call

On macOS, LayerCake soft-attaches to an already-running After Effects session: inventory, patch, and eval use AppleScript `DoScriptFile` without `activate`, so the previous frontmost app should stay focused.

If AE still jumps forward on every call, you are likely on an older LayerCake build, or a cold start just launched AE (the first launch may still surface the app once). Opening a project can also bring AE forward depending on the OS and AE version; steady-state evals should not.

## Scripts run but no result returns

In After Effects, enable:

**Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network**

LayerCake uses a result file to receive values from After Effects. Without this preference, a script may run but fail to return its result.

Also dismiss open modal dialogs. They can prevent scripts from finishing.

## Script times out

The default timeout is 60 seconds (`AE_SCRIPT_TIMEOUT_MS=60000`). Increase it when needed:

```bash
AE_SCRIPT_TIMEOUT_MS=120000
```

Long-running scripts, renders, and modal dialogs can still block completion.

## Documentation tools fail

Fetch the local Scripting Guide corpus:

```bash
npm run docs:fetch
```

Or point `AE_DOCS_PATH` at a directory containing the guide markdown. See [Scripting guide corpus](scripting-guide.md).

## Inspection response too large

Deep layer and source dumps are capped by `AE_INSPECT_MAX_BYTES`. The default is 524,288 bytes.

Raise the limit when needed:

```bash
AE_INSPECT_MAX_BYTES=1048576
```

Start with `overview` or `extended` before requesting `full`. Large property trees consume a great deal of model context and may still be less useful than a focused inspection.

## Patch rejected because the fingerprint changed

LayerCake uses the project fingerprint to check that a typed mutation still targets the project state the agent inspected.

A fingerprint can change when:

- a person edits the project in After Effects;
- another tool mutates the project;
- `ae_eval_script` changes project state;
- a previous patch changed the project and the caller reused an older fingerprint.

Call `ae_project_context` again, inspect the relevant target if necessary, and decide whether the requested change is still valid. Do not blindly retry a stale mutation.

A successful typed patch may return the new fingerprint. The caller can reuse it for the next patch or save operation only when no other mutator has run in between.

## Name-based target is ambiguous

After Effects allows duplicate composition and layer names. LayerCake refuses a name-based mutation when it resolves to more than one candidate.

Use the candidate information returned by the tool, inspect the intended object, and retry with `compId`, `layerId`, or another stable ID.

## Backup opens with missing footage

`create_backup` copies the `.aep` project file only. It is not the After Effects **Collect Files** command and does not copy linked media.

The backup can still open correctly while the original footage paths remain reachable. If the project is moved to another machine or folder structure, copy or collect its linked media separately.

## Linux or another unsupported operating system

The After Effects host bridge supports macOS and Windows. Documentation tools may still work on another operating system, but LayerCake cannot drive a local After Effects installation there.

## Environment variables

| Variable               | Description                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `AE_APP_NAME`          | macOS AppleScript application name, for example `Adobe After Effects 2025`. Optional display value on Windows. |
| `AE_EXECUTABLE`        | macOS path to the `.app`; required Windows path to `AfterFX.exe`.                                              |
| `AE_SCRIPT_TIMEOUT_MS` | ExtendScript timeout in milliseconds. Default: `60000`.                                                        |
| `AE_INSPECT_MAX_BYTES` | Maximum UTF-8 size for successful `ae_get_layer` and `ae_get_source` JSON. Default: `524288`.                  |
| `AE_DOCS_PATH`         | Override for the scripting-guide directory. Default: `vendor/after-effects-scripting-guide/docs`.              |
| `AE_ARTIFACT_DIR`      | Absolute directory for backups and artifacts. Default: an OS temp directory named `layercake-artifacts-<pid>`. |

See [.env.example](../.env.example).

## Limitations

LayerCake works through the After Effects scripting API. It cannot control features Adobe does not expose to scripting.

Results also depend on the agent and language model. Review generated ExtendScript before important or destructive changes.

LayerCake deliberately has a narrower typed mutation surface than creation-first After Effects automation tools. Typed ops cover text style, rename, solids and source replace, frame timing, expressions, layer reset/delete, Project panel ops, and safe delete. Use `ae_eval_script` for unsupported work such as creating compositions, adding keyframes, or applying effects. See [MCP tools and agent skill](mcp-tools.md) for the current op list.

Raw evaluation bypasses the path, fingerprint, targeting, and post-condition behavior provided by typed patches. Inspect first, work on a copy for important projects, and verify the result before saving.

LayerCake assumes one agent controls one After Effects session. There is currently no mutex for multiple clients.

LayerCake inspects the After Effects object model, not the visual quality of a rendered frame. Add preview rendering and visual review when appearance matters.

## See also

- [Setup and connection](setup.md)
- [MCP tools and agent skill](mcp-tools.md)
- [Related projects and choosing an After Effects MCP](related-projects.md)
