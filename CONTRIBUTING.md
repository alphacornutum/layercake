# Contributing

Thanks for helping improve **LayerCake**. This file is for developers working in the repo. Operators who only want to run the MCP server should start with [README.md](README.md).

## Setup

```bash
npm install
npm run docs:fetch   # vendors scripting-guide markdown into vendor/
cp .env.example .env # optional; set AE_* for host tests
```

Requirements: Node.js 20+, macOS or Windows if you will exercise the After Effects host bridge.

## Quality scripts

| Script                      | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `npm run typecheck`         | TypeScript `--noEmit`                                |
| `npm run lint` / `lint:fix` | [Oxlint](https://oxc.rs/docs/guide/usage/linter)     |
| `npm run fmt` / `fmt:check` | Oxfmt                                                |
| `npm audit`                 | Dependency vulnerability scan (`--audit-level=high`) |
| `npm test`                  | Unit tests (no After Effects required)               |
| `npm run test:ae`           | Host integration tests (skipped unless AE env set)   |
| `npm run build` / `start`   | Compile to `dist/` and run                           |
| `npm run docs:fetch`        | Refresh vendored guide markdown                      |

Before opening a PR, run:

```bash
npm audit --audit-level=high && npm run typecheck && npm run lint && npm run fmt:check && npm test && npm run build
```

### Unit vs host tests

- **`npm test`** — config, script wrapper, inventory parse/filter, docs, skills. Safe for CI and machines without AE.
- **`npm run test:ae`** — live host bridge (macOS AppleScript or Windows `AfterFX.exe -r`). macOS: `AE_APP_NAME` and/or `AE_EXECUTABLE`. Windows: `AE_EXECUTABLE` to `AfterFX.exe`. Open/eval cases use committed `fixtures/hello-world.aep`. See [`fixtures/README.md`](fixtures/README.md). Host tests are **not** run in GitHub Actions.

## AgentSync

Claude, Cursor, and other agents use different config layouts. Shared source lives in [`.ai/src/`](.ai/src/) and is distributed with [AgentSync](https://github.com/yelmuratoff/agent_sync).

Install once per machine:

```sh
curl -fsSL https://raw.githubusercontent.com/yelmuratoff/agent/main/install.sh | bash
```

After clone or when `.ai/` changes:

```sh
agentsync sync
```

Edit rules, skills, and `AGENTS.md` under `.ai/src/`, not generated `.cursor/` or `.claude/` outputs. Commit `.ai/.sync-manifest` with your `.ai/src/` updates.

The end-user product skill shipped with the package lives under top-level [`skills/`](skills/) and is separate from contributor AgentSync.

## OpenSpec

Behavior contracts and planned changes live under [`openspec/`](openspec/). Prefer an OpenSpec change when the public MCP tool surface, host protocol, or inventory JSON shapes shift. See project OpenSpec skills / `/opsx:*` commands if you use them in this workspace.

## Architecture pointers

| Doc                                  | Use for                                      |
| ------------------------------------ | -------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Layers, dependency direction, capability map |
| [`AGENTS.md`](AGENTS.md)             | Agent orientation for this codebase          |
| [`openspec/specs/`](openspec/specs/) | Formal requirements per capability           |

## PR checklist

- [ ] `npm audit --audit-level=high`, `typecheck`, `lint`, `fmt:check`, `test`, and `build` pass
- [ ] Public `ae_*` contracts / inventory JSON stay additive unless the change intentionally breaks them (prefer OpenSpec)
- [ ] `README.md` updated if env vars or the operator-facing tool surface changed
- [ ] `ARCHITECTURE.md` updated if layers, tools, host protocol, or capability ownership changed
- [ ] Agent guidance edited under `.ai/src/` then `agentsync sync` (when applicable)
- [ ] Host-facing changes exercised with `npm run test:ae` when a local AE install is available
