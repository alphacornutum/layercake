## Why

Agents need a reliable way to drive a local Adobe After Effects instance—open `.aep` projects, run ExtendScript for inspection and edits, and look up the official scripting API—without hand-rolling Adobe interop each time. Building this as an MCP server (TypeScript) gives a stable, extensible tool surface we can grow once real workflows are known.

## What Changes

- Add a TypeScript MCP server that accepts a configurable path to the local After Effects executable (and related host settings).
- Support loading a local `.aep` project into that After Effects instance.
- Support executing arbitrary valid ExtendScript against the open project/session and returning script results or errors to the agent.
- Expose After Effects scripting documentation in a Context7-style flow (search/get tools as the agent primary path, plus the same corpus as MCP resources with stable URIs), sourced from the community [docsforadobe/after-effects-scripting-guide](https://github.com/docsforadobe/after-effects-scripting-guide) / [Context7 package](https://context7.com/docsforadobe/after-effects-scripting-guide).
- Keep the first tool surface minimal and extensible so higher-level operations can be added later without redesigning the host bridge.
- Add basic integration tests that use local `.aep` fixtures and the developer's local After Effects executable (skipped or gated when AE is unavailable).
- Scaffold solid repo boilerplate: root `README.md`, [Oxlint](https://oxc.rs/docs/guide/usage/linter) + Oxfmt, and a `Dockerfile` to build/run the MCP server over stdio.

## Capabilities

### New Capabilities

- `ae-host`: Configure the After Effects executable, start/attach a host session, and open local `.aep` project files.
- `extendscript-execution`: Evaluate ExtendScript in the active After Effects session and return stdout/result or structured errors.
- `ae-scripting-docs`: Provide searchable/retrievable After Effects scripting documentation via tools (`ae_docs_search` / `ae_docs_get`) and matching MCP resources for agent use.

### Modified Capabilities

- _(none — greenfield project)_

## Impact

- New TypeScript package at repo root for the MCP server, AE host bridge, and docs integration.
- Dev toolchain: Oxlint + Oxfmt; Docker image for the Node MCP process (AE bridge still requires macOS host).
- Depends on a locally installed After Effects (macOS assumed initially) and developer-supplied fixture `.aep` files for integration tests.
- Documentation dependency on `docsforadobe/after-effects-scripting-guide` and/or Context7 packaging of that guide.
- No existing application code is modified (repo currently holds OpenSpec scaffolding only).
