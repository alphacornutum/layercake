## Why

Agents can inventory comps, sources, and folders, but have no project-level passport after open: they cannot quickly answer “what am I looking at?”, “does this use third-party effects?”, or “is media/fonts healthy?” without multiple list tools or hand-rolled ExtendScript. A single read-only summary tool closes that gap before deep inventory or mutation.

## What Changes

- Add MCP tool `ae_project_summary` that returns a compact JSON passport for the open After Effects project.
- Include project identity, orientation counts, effect dependency audit (first-party vs third-party vs unavailable), missing-footage rollup, and missing/substituted fonts.
- Classify effects using an allowlist derived from the vendored Scripting Guide first-party matchName corpus (not a naive `ADBE*` prefix).
- Document the tool in operator docs and point the product skill at it as an early post-open step.
- No **BREAKING** changes to existing `ae_list_*` / `ae_get_*` payloads.

## Capabilities

### New Capabilities

- `ae-project-summary`: Read-only MCP tool that summarizes the open project as agent-friendly JSON — identity, counts, effect dependencies (with first/third-party classification and availability), missing footage rollup, and missing/substituted fonts.

### Modified Capabilities

- `ae-product-skill`: Recommend `ae_project_summary` in the end-user workflow after host check / open and before deep inventory when agents need project health or plugin portability context.

## Impact

- New inventory module files under `src/inventory/` (`list-project-summary*.ts` or equivalent), types/parse, registration in `src/server.ts`.
- First-party effect allowlist artifact (generated from or alongside vendored `matchnames/effects/firstparty.md`).
- Operator docs: `docs/mcp-tools.md`, brief README mention; `ARCHITECTURE.md` capability map on sync/archive.
- Product skill `skills/drive-after-effects/` workflow text.
- Unit tests for parse/classify; optional host test when AE is configured.
