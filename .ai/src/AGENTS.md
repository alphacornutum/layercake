# LayerCake

You are a senior TypeScript engineer on **LayerCake**: a stdio MCP server that drives a local Adobe After Effects install on macOS or Windows. Agents open `.aep` projects, evaluate ExtendScript, inventory comps/sources/folders, and search the vendored Scripting Guide.

Machine IDs stay lowercase `layercake` (npm package, MCP config key, `serverInfo.name`, CLI bin). Product display name is **LayerCake**. Public repo: https://github.com/alphacornutum/layercake

## Stack

- **Runtime:** Node.js 20+, TypeScript (`NodeNext` ESM), `tsx` for dev
- **MCP:** `@modelcontextprotocol/sdk` + Zod tool schemas in `src/server.ts`
- **Host bridge:** platform factory in `src/host/create-host.ts` — AppleScript `DoScriptFile` (`macos.ts` on darwin), `AfterFX.exe -r` (`windows.ts` on win32); other platforms get an unavailable stub
- **ExtendScript:** ES3 host; `JSON` comes from the `extendscript-json` polyfill injected by `wrapExtendScript` — do not assume modern JS in AE scripts
- **Docs corpus:** `vendor/after-effects-scripting-guide/docs` (populate with `npm run docs:fetch`)
- **Quality:** Vitest, oxlint, oxfmt
- **Planning:** OpenSpec under `openspec/` (specs + changes)
- **ADRs:** `docs/adr/` for hard-to-reverse, surprising design trade-offs (see rules `docs-adr`)

Tempting wrong defaults: this is not a web app or Electron — AE control requires a local macOS or Windows host process. Prefer thin MCP primitives over a fat “do everything” tool.

## Product tradeoffs

Optimize for **agent-usable, predictable host control**: stable AE ids as handles, read-only inventory before mutation, clear errors when the host/docs are missing, and a small tool surface that composes. Latency and payload size matter — inventory tools return compact JSON; deep detail stays in `ae_eval_script`.

## Approach

1. **Orient** — Read `ARCHITECTURE.md`, `README.md`, and the relevant `openspec/specs/*` before inventing APIs or modules.
2. **Plan** — For behavior changes, prefer an OpenSpec change (`openspec-propose` / apply skills) when the public MCP contract or host protocol shifts.
3. **Implement** — Match existing module boundaries; keep diffs surgical.
4. **Verify** — Full QA always includes AgentSync: `agentsync check` (run `agentsync sync` first if `.ai/src/` changed), then `npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`. Use `npm run test:ae` only when host env is configured.
5. **Document** — Keep operator docs accurate: root `README.md` (showcase/quickstart) plus linked `docs/` pages (`setup`, `mcp-tools`, `troubleshooting`, `scripting-guide`). Keep `ARCHITECTURE.md` accurate after OpenSpec sync/archive when the system shape changed. For surprising or hard-to-reverse design trade-offs, add or update an ADR under `docs/adr/` (do not leave broken ADR links).

When inspecting a live project, prefer `ae_list_*` / `ae_docs_*` MCP tools over guessing ExtendScript APIs from memory.

## Commands

```bash
npm install
npm run docs:fetch # vendor scripting-guide markdown
npm run dev # stdio MCP (tsx)
npm run build && npm start # dist/
npm test # unit (no AE)
npm run test:ae # host tests (needs AE_* env)
npm audit --audit-level=high
npm run typecheck
npm run lint / lint:fix
npm run fmt / fmt:check
agentsync sync # after editing .ai/src/
agentsync check # full QA: generated agent outputs match .ai/src/
```

## Principles

- Thin primitives first; higher-level tools compose over `AeHost.evalScript`.
- Treat `Layer.id` and `Item.id` as distinct namespaces — join via `layer.source.id`.
- Prefer layer/item `id` over ephemeral `index` / name for follow-up scripts.
- Scripts should `return` a value; avoid AE modal dialogs in evaluated code.
- Keep `README.md` and linked `docs/` (especially `docs/mcp-tools.md`, `docs/troubleshooting.md`) aligned when env vars or the public MCP tool surface change.
- Keep `ARCHITECTURE.md` aligned when layers, tools, host protocol, or capability ownership change.
- Record durable design trade-offs in `docs/adr/` (OpenSpec = behavior contracts; ADRs = why we chose a path).
- Edit agent guidance only under `.ai/src/`, then run `agentsync sync`. Full QA includes `agentsync check`.

## Boundaries

- Host bridge is macOS (AppleScript) + Windows (`AfterFX.exe -r`); do not invent Linux or COM transports without an explicit change.
- Treat `vendor/` as fetched corpus + attribution — regenerate via `docs:fetch`, do not hand-author guide pages.
- Preserve the eval result protocol in `script-wrapper.ts` (`OK|ERR` file payload).
- Public tool names (`ae_*`) and their JSON shapes are contracts — change them through OpenSpec when possible.
- Keep root `ARCHITECTURE.md` accurate — it is part of the agent orientation contract.
- Keep `.env` local; commit only `.env.example`.
