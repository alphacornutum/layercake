## Why

The project is ready to go public on GitHub, but identity and docs are still private-dev shaped: the package/repo name `afx-inspector` conflicts with `ae_*` tools and the `drive-after-effects` skill, the README mixes end-user install with AgentSync contributor ritual, and there is no CI/license surface for smart users evaluating the project. A create-heavy competitor already owns the slug `after-effects-mcp`, so we need a distinct, growth-friendly name before publishing.

## What Changes

- **BREAKING:** Rename package / CLI / MCP server identity from `afx-inspector` to **`after-effects-driver-mcp`** (npm `name` + `bin`, MCP initialize `name` as `after-effects-driver`, log prefixes, temp-dir prefixes, Cursor config examples). Tool names (`ae_*`) and the product skill id (`drive-after-effects`) stay unchanged.
- Rewrite **README.md** for operators: sharp, short, professional — requirements (including **macOS only** today), install, env, tools table, scope, skill, troubleshooting, license/attribution. No AgentSync / OpenSpec / contributor process.
- Add **CONTRIBUTING.md** for developers: scripts, tests, AgentSync, OpenSpec, architecture pointers, PR quality bar.
- Add **LICENSE** (MIT, matching `package.json`), optional **SECURITY.md**, `package.json` `repository` / `bugs` fields when the public URL is known.
- Add **GitHub Actions CI** (unit tests, typecheck, lint, fmt:check, build on Node 20/22) and README badges for CI + license only. Host tests (`test:ae`) remain local-only.
- Document **product scope** in README: read-oriented inventory/inspect + docs + catchall `ae_eval_script`; dedicated mutation tools are out of scope for now (mutations only via eval until use cases demand them).
- Update agent-facing strings (`AGENTS.md` / `.ai/src/`, product skill prose, `ARCHITECTURE.md`) to the new product name after AgentSync sync where applicable.

## Capabilities

### New Capabilities

- `product-identity`: Public package, CLI bin, and MCP server naming for `after-effects-driver-mcp` / `after-effects-driver`, plus the documented operator-facing product scope (macOS host, no dedicated mutation tools beyond eval).

### Modified Capabilities

- `ae-host`: Formalize that the After Effects host bridge is **macOS (darwin) only**; non-macOS hosts MUST report unavailable / clear errors for host operations.

## Impact

- `package.json` (`name`, `bin`), `src/server.ts` (MCP server name), `src/index.ts` / host temp prefixes, README / new CONTRIBUTING / LICENSE / `.github/workflows/ci.yml`
- Cursor MCP example keys and `.cursor/mcp.json` (local) should use the new name
- Product skill and AgentSync sources that say “afx-inspector”
- No change to public `ae_*` tool schemas or inventory JSON contracts
- GitHub repo rename (or new remote) is an operator step outside the codebase; docs assume the public repo will be named `after-effects-driver-mcp`
