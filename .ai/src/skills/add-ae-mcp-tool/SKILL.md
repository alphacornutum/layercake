---
name: "add-ae-mcp-tool"
description: >-
  Use this skill when adding or extending a LayerCake MCP tool — especially
  read-only inventory tools like ae_list_comps / ae_list_sources / ae_list_folders,
  new ae_* registrations in server.ts, ExtendScript inventory snippets, or parsers.
  Trigger even when phrased as "expose more project data", "add a list tool",
  "return JSON from AE", or "agents need folder/footage info".
---

# Add an AE MCP tool

Follow the inventory pattern already used for comps, sources, and folders.

## Steps

1. **Decide tool vs eval**
   - Repeated read-only structure → dedicated `ae_list_*` (or similar) tool.
   - One-off / mutating → document an `ae_eval_script` recipe; skip a new tool.

2. **OpenSpec (when contract-facing)**
   - For new/changed agent-facing behavior, create or update an OpenSpec change and specs under `openspec/specs/` before or alongside implementation (see `openspec-propose` / `openspec-apply-change`).

3. **ExtendScript source**
   - Add a typed entry under `src/ae-scripts/entries/` that exports `main(): string` (JSON payload). Import shared helpers from `src/ae-scripts/shared/` (e.g. inventory) instead of copying `folderPlacement` / `serializeSourceRef`.
   - Emit via `npm run build:ae-scripts`; Node loaders use `loadAeScript("<entry>")` (self-contained). Do **not** prepend `loadAeHelperScript` blobs onto entries that already bundle those helpers.
   - Require an open project; throw a clear Error if `!app.project`.

4. **TypeScript orchestration**
   - Add `list-<name>-script.ts` that exports `loadAeScript("list-<name>")` (plus any intentional parameter preamble only).
   - Add `list-<name>.ts`: `host.evalScript(SCRIPT, timeoutMs)` → parse → optional filter in TS.
   - Extend `src/inventory/types.ts` and `parse.ts` with strict runtime checks (throw on malformed JSON/shape).

5. **Register MCP tool**
   - In `src/server.ts`, `registerTool` with Zod `inputSchema`, clear description (id namespaces, read-only vs mutating), and `textResult(JSON.stringify(...), isError)`.
   - Map `ConfigError` / eval failures to `isError: true` text, matching existing tools.

6. **Tests + docs**
   - Unit: script contains shared helpers / key probes; parse + filter fixtures in `tests/inventory.test.ts`.
   - Host: extend `tests/host.ae.test.ts` behind `skipIf` gates.
   - Update `docs/mcp-tools.md` tool table and any id-join guidance; keep `README.md` tool/skill pointers accurate if the surface changed.

7. **Verify**
   ```bash
   agentsync check
   npm run typecheck && npm run lint && npm test && npm run build
   # optional: npm run test:ae
   ```

## Gotchas

- `Layer.id` ≠ `Item.id`. Document join keys in the tool description (`layer.source.id` → sources/comps).
- Comp filters run in TypeScript after full eval (`applyCompFilters`) — do not reimplement filter union semantics inside ExtendScript unless there is a measured need.
- AE root folder name can be empty; folders tool normalizes to `"Root"` — keep that behavior if you touch folder trees.
- CI will not exercise host tools; keep unit tests sufficient for parse/contract regressions.
