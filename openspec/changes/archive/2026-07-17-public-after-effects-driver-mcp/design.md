## Context

The codebase is a stdio MCP server driving local After Effects via AppleScript `DoScriptFile` on macOS. Public tool names (`ae_*`) and the product skill (`drive-after-effects`) are already AE-aligned; the package/repo/server still use `afx-inspector`. The README (~250 lines) mixes operator install, deep tool reference, and AgentSync contributing. There is no root `LICENSE`, `CONTRIBUTING.md`, or `.github` CI. A popular create-oriented server already occupies the GitHub name `after-effects-mcp`, so this project must publish under a distinct slug while staying searchable.

## Goals / Non-Goals

**Goals:**

- Ship a coherent public identity: **`after-effects-driver-mcp`** (package/bin/repo), MCP server name **`after-effects-driver`**
- Operator README that states macOS-only, scope (no dedicated mutation tools), install, env, tools table, skill, troubleshooting
- Contributor docs and AgentSync process live only in `CONTRIBUTING.md` (+ existing `ARCHITECTURE.md` / `AGENTS.md`)
- Minimal honest CI + badges (CI status, license)
- Formalize macOS-only host bridge in `ae-host` requirements

**Non-Goals:**

- Renaming MCP tools (`ae_*`) or the skill id (`drive-after-effects`)
- Implementing dedicated mutation tools or a Windows host bridge
- Publishing to npm in this change (shape `package.json` for it; actual publish is optional/later)
- Matching competitor create-comp / ScriptUI panel architectures
- Badge gardens, coverage upload, or running `test:ae` in CI

## Decisions

### 1. Product name: `after-effects-driver-mcp`

- **Choice:** Full searchable slug with `after-effects` + `driver` + `mcp`.
- **Rationale:** Differentiates from [Dakkshin/after-effects-mcp](https://github.com/Dakkshin/after-effects-mcp); `driver` aligns with `drive-after-effects` and does not imply read-only; `mcp` aids GitHub/npm discovery without needing “mcp” in the MCP initialize name.
- **Alternatives considered:** `ae-driver-mcp` (shorter, weaker SEO); `after-effects-inspector-mcp` (blocks future write tools narratively); bare `after-effects-mcp` (taken / crowded).

### 2. Naming layers

| Surface                          | Value                      |
| -------------------------------- | -------------------------- |
| GitHub repo / npm `name` / `bin` | `after-effects-driver-mcp` |
| MCP `McpServer` name             | `after-effects-driver`     |
| Cursor `mcpServers` key (docs)   | `after-effects-driver`     |
| Tools / skill                    | unchanged                  |

Log lines and temp-dir prefixes (`afx-inspector-`) update to `after-effects-driver` (or short `ae-driver-`) for consistency — prefer `ae-driver-` for temp paths (filesystem-friendly length).

### 3. README vs CONTRIBUTING split

**README (operators):** title, one-liner, badges, requirements (**macOS + Node 20+ + local AE**), Scope, Quickstart, Cursor MCP config, Environment, MCP tools table + eval warning, Agent skill (filesystem + `skill://`, no AgentSync), Troubleshooting, Docs attribution, License, link to CONTRIBUTING.

**Omit from README:** deep per-tool payload essays (keep a short id-namespace note or link to ARCHITECTURE), Scripts/Testing tables, AgentSync.

**CONTRIBUTING:** clone setup, `npm` quality scripts, `test` vs `test:ae`, AgentSync (`.ai/src/` → `agentsync sync`), OpenSpec pointer, `ARCHITECTURE.md` / `AGENTS.md`, PR checklist.

### 4. Scope copy (README)

State explicitly:

- **In:** open project, read-only inventory/inspect, scripting-guide search, catchall ExtendScript via `ae_eval_script`
- **Out:** dedicated mutation tools; mutations only through eval for now
- **Platform:** macOS only for host control (non-macOS: docs tools may still work; host tools unavailable)

### 5. CI

Single workflow `.github/workflows/ci.yml`:

- Triggers: push + pull_request
- Matrix: Node 20, 22 on `ubuntu-latest` (unit suite is AE-free)
- Steps: `npm ci` → `typecheck` → `lint` → `fmt:check` → `test` → `build`
- Permissions: `contents: read`
- Do not run `test:ae` or `docs:fetch` in the default job

Badges: CI workflow badge + MIT license badge only.

### 6. License and metadata

- Add root `LICENSE` (MIT text)
- Keep guide attribution as today (Adobe / docsforadobe under `vendor/`)
- Add `repository` / `bugs` / `homepage` in `package.json` once the public GitHub URL is known (placeholder ok if org/user undecided — prefer filling during apply when remote exists)

### 7. AgentSync / generated trees

Edit product name under `.ai/src/` (and `skills/drive-after-effects` prose), then `agentsync sync`. Do not hand-edit generated `.cursor/` / `.claude/` outputs except local `mcp.json` if needed for the developer’s machine.

## Risks / Trade-offs

- **[Risk] Name collision / SEO** → Mitigation: distinctive `driver` slug; GitHub topics (`mcp`, `after-effects`, `extendscript`); clear one-liner contrasting create-first servers without flame wars.
- **[Risk] BREAKING rename for anyone already pointing at `afx-inspector`** → Mitigation: pre-public timing; one-line “formerly afx-inspector” optional in README for a release or two.
- **[Risk] README too thin for power users** → Mitigation: tools table + ARCHITECTURE / OpenSpec for depth; CONTRIBUTING for contributors.
- **[Risk] CI green while host bridge untested** → Mitigation: document in CONTRIBUTING; keep `test:ae` local.
- **[Risk] Directory still named `afx-inspector` locally** → Mitigation: code/package rename first; GitHub repo rename is a separate git remote step (open question if org URL unknown).

## Migration Plan

1. Land identity + docs + CI on the current branch/folder.
2. Rename GitHub repository to `after-effects-driver-mcp` (or create public repo with that name) and update `package.json` `repository` fields.
3. Update any private Cursor MCP configs to the new path/key.
4. No runtime data migration.

Rollback: revert the change commit(s); restore old package/server name if needed.

## Open Questions

- Public GitHub owner/org URL for `repository` field (fill when known).
- Whether to keep a temporary “formerly afx-inspector” note in README (default: yes, one short line).
- Whether deep tool payload sections move to `docs/tools.md` or are simply dropped from README in favor of ARCHITECTURE (default: drop from README; keep ARCHITECTURE as the deep map).
