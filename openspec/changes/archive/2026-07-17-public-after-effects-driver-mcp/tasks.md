## 1. Identity rename

- [x] 1.1 Update `package.json` `name` and `bin` to `after-effects-driver-mcp`; add `repository` / `bugs` when public URL is known
- [x] 1.2 Set MCP server name to `after-effects-driver` in `src/server.ts`; update log prefixes in `src/index.ts` and related strings
- [x] 1.3 Rename host temp-dir prefix from `afx-inspector-` to `ae-driver-` (or equivalent) in `src/host/macos.ts`
- [x] 1.4 Update product skill prose and any user-facing strings that say `afx-inspector` under `skills/` and `.ai/src/`; run `agentsync sync`
- [x] 1.5 Update `ARCHITECTURE.md` product name references; adjust local `.cursor/mcp.json` key/paths for the developer machine if present

## 2. Public docs

- [x] 2.1 Add root `LICENSE` (MIT)
- [x] 2.2 Rewrite `README.md` for operators: badges, one-liner, requirements (macOS-only + Node 20+ + AE), Scope (no dedicated mutation tools; eval only), quickstart, Cursor config, env, tools table + warning, skill, troubleshooting, attribution, license, link to CONTRIBUTING; drop AgentSync and deep payload essays
- [x] 2.3 Add `CONTRIBUTING.md` with setup, quality scripts, `test` vs `test:ae`, AgentSync, OpenSpec, architecture/AGENTS pointers, PR checklist
- [x] 2.4 Add brief `SECURITY.md` (how to report vulnerabilities)

## 3. CI

- [x] 3.1 Add `.github/workflows/ci.yml`: Node 20/22, `npm ci`, typecheck, lint, fmt:check, test, build; no `test:ae`
- [x] 3.2 Wire CI + license badges at top of README

## 4. Spec alignment / verification

- [x] 4.1 Confirm non-darwin host status/ops behavior matches `ae-host` macOS-only requirement (adjust message text only if needed)
- [x] 4.2 Run `npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build`
- [x] 4.3 Grep for leftover public `afx-inspector` identity strings (package/server/docs examples); leave historical change names or paths only where intentional
