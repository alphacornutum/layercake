## Context

This repo is greenfield (OpenSpec scaffolding only). The goal is a local MCP server an agent can start with a path to the developer's After Effects (AE) install, then use to open `.aep` projects, run ExtendScript (Adobe's ES3-based scripting language for AE), and retrieve AE scripting docs—similar to how [Context7](https://context7.com/docsforadobe/after-effects-scripting-guide) serves the [docsforadobe/after-effects-scripting-guide](https://github.com/docsforadobe/after-effects-scripting-guide).

Constraints:

- AE must already be installed locally; CI without AE will skip host-dependent tests.
- First platform target: macOS (AE AppleScript/`DoScript` bridge is the most mature path).
- Keep the MCP tool surface small so later domain operations can wrap the same bridge.

## Goals / Non-Goals

**Goals:**

- TypeScript MCP server with stdio transport (default Cursor/MCP pattern).
- Configurable AE executable / application identity.
- Open a local `.aep` into a running (or launched) AE session.
- Evaluate arbitrary ExtendScript and return result text or structured failure.
- Agent-facing docs search/retrieve over the After Effects Scripting Guide content.
- Integration tests using fixture `.aep` files + local AE, gated by env (e.g. `AE_EXECUTABLE` / `AE_APP_NAME`).
- Decent greenfield boilerplate: README, [Oxlint](https://oxc.rs/docs/guide/usage/linter) + Oxfmt, and a Dockerfile to run the MCP server.

**Non-Goals:**

- Full typed API wrapping every AE DOM object (inspect/change via raw ExtendScript first).
- Windows/Linux host support for the AE bridge in v1 (design should not block later ports).
- Running After Effects itself inside Linux Docker (impossible for the AppleScript bridge).
- Rendering pipelines, media encode, or headless AE CI farms.
- Shipping a GUI or CEP/UXP panel.
- Guaranteeing AE license/activation state.

## Decisions

### 1. Language & package layout: TypeScript single package at repo root

**Choice:** One Node/TypeScript package at repo root (`src/`) using the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`), Vitest for tests, `tsx`/`node` for runtime. Tooling:

- **Lint:** [Oxlint](https://oxc.rs/docs/guide/usage/linter) (`oxlint`) — fast, correctness-focused defaults.
- **Format:** Oxfmt (`oxfmt`) — keep lint/format in the Oxc toolchain.
- **Scripts:** `lint` / `lint:fix`, `fmt` / `fmt:check`, `typecheck`, `test`, `test:ae`, `build`, `start`, `dev`.
- **Docs:** A thorough root `README.md` (quickstart, env, Cursor MCP examples, Docker, testing, attribution)—not a stub.

**Why:** Matches user preference; Oxc toolchain is fast and low-ceremony for a greenfield TS package; README is the main onboarding surface for Cursor + AE path setup.

**Alternatives considered:**

- ESLint + Prettier — fine, but slower and more config for a new repo; user asked for Oxlint/Oxfmt.
- Python MCP — fine for scripting, weaker AE interop ecosystem on Mac unless wrapping the same osascript path.
- Pure ExtendScript panel — harder for agents to start/control externally.

### 1b. Dockerfile for MCP server process (not for After Effects)

**Choice:** Multi-stage `Dockerfile` that installs deps, builds TypeScript, and `CMD`s the MCP stdio server (`node dist/...`). Include `.dockerignore`. README documents:

- `docker build` / `docker run -i` (stdio) for running the **MCP process** in a reproducible Node environment (docs tools/resources work; useful for CI smoke of server boot).
- For **AE host control**, run the server on the macOS host (or via Cursor `command`/`args` pointing at local `node`), because the AppleScript bridge cannot drive AE from a Linux container.

**Why:** User wants a Dockerfile entrypoint for the MCP server; being honest about AE host limits avoids a false “containerized AE” expectation.

**Alternatives considered:**

- macOS container / VM images with AE — out of scope, licensing/GUI nightmare.
- No Docker — simpler, but user explicitly wants an image to execute the server.

### 2. AE host bridge: macOS AppleScript `DoScript` / `DoScriptFile` via configurable app name + optional binary path

**Choice:** Bridge module that:

1. Resolves host from config: `AE_APP_NAME` (AppleScript target, e.g. `Adobe After Effects 2025`) and/or `AE_EXECUTABLE` (path used for launch/validation).
2. Ensures AE is running (launch if needed).
3. Opens a project with AppleScript `open` / equivalent on a POSIX path.
4. Runs scripts with `DoScript` (inline) or `DoScriptFile` (temp `.jsx` for large scripts).

**Why:** This is the standard external automation path for AE on macOS and supports interactive GUI sessions agents need for inspection.

**Alternatives considered:**

- AE command-line `-r`/`-s` only — awkward for long-lived agent sessions and project state.
- Adobe CEP/UXP socket bridge — more setup, better for panels, overkill for v1.
- `aerender` — render-focused, not a general scripting host.

### 3. MCP tool surface: thin primitives first

**Choice:** Initial tools (names indicative):

- `ae_configure` / startup config via env + optional tool to report resolved host.
- `ae_open_project` — absolute path to `.aep`.
- `ae_eval_script` — ExtendScript source string (and optional timeout).
- `ae_docs_search` / `ae_docs_get` — **primary** documentation path for agents (see Decision 5).

Higher-level tools (`list_comps`, `rename_layer`) are deferred and should call the same `eval` bridge.

**Why:** User explicitly wants extensibility once real operations are known; primitives unlock exploration immediately.

### 4. Script result contract

**Choice:** Wrap user scripts so evaluation returns a JSON-serializable string payload when possible:

- Prefer `JSON.stringify` of an explicit `return`/last expression via a small host helper.
- Capture ExtendScript errors (message + line when available) into a structured MCP tool error/result field.
- No silent success: empty result is still a success with empty `result`.

**Why:** Agents need predictable machine-readable output; raw AE alert/dialogs should be avoided in scripts under test.

### 5. Documentation: tools primary + resources secondary (best for agents)

**Choice:** Expose the same docs corpus **both** ways, with tools as the agent-default path:

1. **Tools (required, primary):** `ae_docs_search` and `ae_docs_get`.
   - Search is inherently a tool (query in → ranked hits out).
   - Get is a tool so agents can reliably fetch full sections in one hop after search—Cursor agents call tools far more consistently than they browse/read MCP resources.
2. **Resources (also required, secondary):** list/read under stable URIs (e.g. `ae://docs/<path>`).
   - Every search hit MUST include that URI (plus title + excerpt).
   - `ae_docs_get` accepts the same identifier/URI the resource uses, so tool and resource stay one corpus with two doors.
   - Helps clients that surface resources in the UI, and gives agents a stable handle without inventing paths.

Corpus: ship or fetch-at-build markdown from `docsforadobe/after-effects-scripting-guide`, index with simple BM25/keyword search (section/path + full-text). Context7 remains an optional complementary MCP when already configured—not required for our `ae_docs_*` tools/resources.

**Why (agent-first, not purity):** Resources-only is canonical MCP for static docs but weak in practice—agents under-discover resource templates and often never `read_resource`. Tools-only works, but omitting resources throws away free URI stability and UI browse. Both, with tools as the happy path, maximizes agent success.

**Alternatives considered:**

- Resources only (+ resource templates) — elegant, but weaker agent uptake for search/fetch loops.
- Tools only — fine for agents; loses shared URIs and client-side doc browsing.
- Only proxy Context7 API — couples availability/network/API keys to core UX.
- Scrape ae-scripting.docsforadobe.dev HTML — worse than using the source markdown repo.

### 6. Testing strategy

**Choice:**

- Unit tests: config parsing, script wrapper, docs index/search (no AE).
- Integration tests: marked `ae` / gated on `AE_EXECUTABLE` or `AE_APP_NAME` + fixture `.aep` under `fixtures/`; open project, `ae_eval_script` read-only probe (e.g. `app.project.numItems`), assert structured result.
- Fixtures: commit small synthetic `.aep` if license allows; otherwise document required local fixtures path via env `AE_FIXTURE_AEP`.
- Never require AE for `npm test` default unit suite; provide `npm run test:ae` for host tests.

**Why:** Matches request for fixture + local executable tests without making the package unusable without AE.

### 7. Configuration

**Choice:** Environment variables + MCP server config args:

- `AE_EXECUTABLE` — path to After Effects binary or `.app`
- `AE_APP_NAME` — AppleScript application name
- `AE_DOCS_PATH` — optional override for docs corpus
- Timeouts: `AE_SCRIPT_TIMEOUT_MS`

Config is read at process start; tool can expose `ae_host_status` for debugging.

## Risks / Trade-offs

- [AE version / app name drift] → Mitigation: require explicit `AE_APP_NAME`/`AE_EXECUTABLE`; document discovery (`mdfind` / Applications scan helper, non-fatal).
- [ExtendScript is ES3; agents write modern JS] → Mitigation: docs tool + clear error messages; later optional transpile is out of scope.
- [Modal dialogs / AE UI blocks `DoScript`] → Mitigation: document constraints; tests use non-interactive fixtures; fail with timeout errors.
- [Destructive scripts] → Mitigation: v1 is powerful-by-design (arbitrary eval); warn in tool descriptions; no auto-save unless script saves.
- [Docs licensing: Adobe copyright on guide content] → Mitigation: attribute Adobe/docsforadobe; keep educational use; prefer submodule/fetch with LICENSE notice over re-hosting HTML site.
- [Single long-lived AE GUI session] → Mitigation: one host session per MCP process; document that concurrent MCP instances may contend for the same AE app.

## Migration Plan

N/A for greenfield. Rollout:

1. Scaffold package + unit tests.
2. Implement host bridge + MCP tools.
3. Add docs index.
4. Add gated AE integration tests and sample Cursor MCP config.

Rollback: remove MCP registration; no data migrations.

## Open Questions

1. Exact AE version(s) the developer runs (naming for `AE_APP_NAME`) — resolve at implement time via local detection + env override.
2. Whether fixture `.aep` files can be committed to the repo or must stay machine-local (`AE_FIXTURE_AEP`).
3. Whether Windows support is needed soon enough to abstract the bridge behind an interface from day one (recommended: thin `AeHost` interface even if only macOS is implemented).
