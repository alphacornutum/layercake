## MODIFIED Requirements

### Requirement: Provide After Effects scripting documentation corpus

The server MUST expose After Effects scripting documentation sourced from the community After Effects Scripting Guide (`docsforadobe/after-effects-scripting-guide` or an equivalent local corpus derived from it) so agents can look up API behavior without leaving the MCP session. The corpus MUST be loaded from a path under the LayerCake package root (the same package that contains the server entrypoint and packaged `skills/`), not from the process working directory. The server MUST NOT require or honor an environment variable to locate the corpus.

#### Scenario: Docs corpus available at runtime

- **WHEN** the server starts and the packaged docs corpus is present under the package root
- **THEN** documentation tools and documentation resources MUST both be available without requiring a separate Context7 MCP server and without requiring the process cwd to be the package root

#### Scenario: Missing docs corpus

- **WHEN** the package-local docs corpus cannot be loaded
- **THEN** documentation tools MUST return a clear error identifying the missing corpus path and MUST NOT instruct the operator to set a docs path environment variable

## ADDED Requirements

### Requirement: Ship docs corpus with the package

The LayerCake distributable (npm package contents) MUST include the vendored scripting-guide corpus (markdown under `vendor/after-effects-scripting-guide` plus attribution) so a normal install can load docs without a separate fetch step at runtime.

#### Scenario: Packaged install has corpus

- **WHEN** LayerCake is installed from its published package layout (`dist/`, `skills/`, and vendored docs)
- **THEN** the server MUST be able to resolve and load the docs corpus from that install’s package root
