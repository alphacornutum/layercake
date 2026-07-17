---
description: "Module layers, dependency direction, and mandatory ARCHITECTURE.md maintenance"
alwaysApply: true
---

# Architecture Rules

## Living architecture doc

- Root `ARCHITECTURE.md` is the system map (layers, flows, capability ↔ code). Treat it as a maintained contract, not optional docs.
- Orient on architecture changes by reading `ARCHITECTURE.md` before inventing modules or tools.
- After OpenSpec **sync** or **archive**, update `ARCHITECTURE.md` when layers, tools, host protocol, or `openspec/specs/` capabilities changed. If reviewed with no edits, say so in the sync/archive summary.
- Keep the capability map, dependency rules, and design constraints aligned with `src/` and main specs — prefer accurate short updates over stale narrative.

## Layers

- `src/index.ts` — wire config, host, docs corpus, stdio transport; keep orchestration thin.
- `src/server.ts` — register MCP tools/resources only; call host/inventory/docs; return `textResult` / `isError`.
- `src/config.ts` — env loading and `ConfigError`; no AE I/O.
- `src/host/` — `AeHost` interface, `createAeHost` factory, macOS AppleScript + Windows CLI bridges, script wrap/parse protocol.
- `src/inventory/` — read-only project inventories: ExtendScript source strings + TS parse/filter.
- `src/docs/` — local corpus load/search; URIs use `ae://docs/...`.

## Dependency direction

- `server` → `host` / `inventory` / `docs` / `config`.
- `inventory` → `host` (via `AeHost.evalScript`) and local parse/filter — not the reverse.
- Keep ExtendScript bodies in `*-script.ts` (or shared helpers); TypeScript owns filtering, validation, and MCP shaping.
- New host capabilities go on `AeHost` + platform implementations (`macos.ts` / `windows.ts`); tools stay thin wrappers.

## Tool design

- Prefer a dedicated read-only tool when agents need the same inventory repeatedly.
- Leave one-off or mutating work to `ae_eval_script` with a `return` value.
- Validate tool inputs with Zod `inputSchema` on `registerTool`.
- Surface host/config failures as MCP `isError` text results, not thrown transport crashes.
