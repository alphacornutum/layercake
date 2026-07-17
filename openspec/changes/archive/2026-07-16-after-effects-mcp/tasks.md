## 1. Package scaffold & repo boilerplate

- [x] 1.1 Initialize TypeScript Node package at repo root with MCP SDK, Vitest, `tsx`/build entrypoint for stdio MCP server, and `package.json` scripts (`dev`, `build`, `start`, `test`, `test:ae`, `typecheck`, `lint`, `lint:fix`, `fmt`, `fmt:check`)
- [x] 1.2 Add [Oxlint](https://oxc.rs/docs/guide/usage/linter) + Oxfmt (`oxlint`, `oxfmt`) as devDependencies with config files, ignore patterns, and editor-friendly defaults
- [x] 1.3 Add a production `Dockerfile` (+ `.dockerignore`) that builds and runs the MCP server over stdio; document host-AE vs container limits (docs tools work in-container; AE bridge needs macOS host process)
- [x] 1.4 Write a solid root `README.md` boilerplate: what/why, quickstart, env reference (`AE_EXECUTABLE`, `AE_APP_NAME`, `AE_FIXTURE_AEP`, `AE_SCRIPT_TIMEOUT_MS`, `AE_DOCS_PATH`), Cursor MCP config examples (local + Docker), scripts table, testing (unit vs `test:ae`), docs attribution, troubleshooting
- [x] 1.5 Define `AeHost` interface and config loader with unit tests for missing/invalid config

## 2. After Effects host bridge (macOS)

- [x] 2.1 Implement macOS AppleScript bridge: launch/attach, resolve app name from config, `ae_host_status` tool
- [x] 2.2 Implement `ae_open_project` for absolute `.aep` paths with validation errors for missing/non-project paths
- [x] 2.3 Add gated integration smoke test that launches/attaches using local AE config (skip when unset)

## 3. ExtendScript execution

- [x] 3.1 Implement script wrapper + `ae_eval_script` tool (result payload, structured errors, empty-script validation)
- [x] 3.2 Enforce configurable evaluation timeout and map timeout to a clear tool error
- [x] 3.3 Add unit tests for wrapper/validation; add AE integration test: open fixture `.aep`, eval read-only probe (`app.project.numItems`), assert success

## 4. Scripting docs (Context7-style)

- [x] 4.1 Vendor or fetch-at-build the `docsforadobe/after-effects-scripting-guide` markdown corpus with LICENSE/attribution notes
- [x] 4.2 Build a local search index and implement `ae_docs_search` + `ae_docs_get` (hits include resource URIs; empty hits vs not-found; attribution on retrieve)
- [x] 4.3 Expose the same corpus as MCP resources (`ae://docs/...`) so list/read matches tool get for a given URI
- [x] 4.4 Add unit tests for search/get/resource read against the local corpus; document optional Context7 complementarity in README

## 5. MCP wiring & fixtures

- [x] 5.1 Register all tools and docs resources on the MCP server with clear descriptions warning that eval can mutate projects
- [x] 5.2 Add `fixtures/` guidance or committed minimal `.aep`; keep `npm test` / `npm run test:ae` scripts aligned with README
- [x] 5.3 Run `fmt:check`, `lint`, `typecheck`, and unit suite green; run `test:ae` against local AE + fixture and fix gaps until specs scenarios pass
- [x] 5.4 Verify Docker image builds and starts the MCP stdio server (`docker build` / `docker run -i`) per README
