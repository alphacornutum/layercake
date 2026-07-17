## Purpose

Expose After Effects scripting documentation (search, retrieve, and MCP resources) so agents can look up API behavior without leaving the MCP session.

## Requirements

### Requirement: Provide After Effects scripting documentation corpus

The server MUST expose After Effects scripting documentation sourced from the community After Effects Scripting Guide (`docsforadobe/after-effects-scripting-guide` or an equivalent local corpus derived from it) so agents can look up API behavior without leaving the MCP session.

#### Scenario: Docs corpus available at runtime

- **WHEN** the server starts with a configured or bundled docs corpus
- **THEN** documentation tools and documentation resources MUST both be available without requiring a separate Context7 MCP server

#### Scenario: Missing docs corpus

- **WHEN** the docs corpus path is configured but cannot be loaded
- **THEN** documentation tools MUST return a clear error identifying the missing corpus

### Requirement: Search scripting documentation via tool

The server MUST provide an `ae_docs_search` tool that accepts a natural-language or keyword query and returns ranked documentation hits. Each hit MUST include a title, short excerpt, and a stable resource URI that identifies the section in the docs corpus.

#### Scenario: Search returns relevant hits

- **WHEN** the caller searches for a known API term such as `CompItem` or `app.project`
- **THEN** the tool MUST return one or more hits that reference matching guide sections and each hit MUST include a resolvable docs URI

#### Scenario: Search with no matches

- **WHEN** the caller searches for a string with no matches in the corpus
- **THEN** the tool MUST return an empty hit list without failing the tool call

### Requirement: Retrieve documentation via tool

The server MUST provide an `ae_docs_get` tool that retrieves the full (or chunked) content of a documentation section given the identifier or URI returned from search. This tool is the primary fetch path for agents.

#### Scenario: Retrieve known section via tool

- **WHEN** the caller invokes `ae_docs_get` with a documentation URI or identifier from a prior search hit
- **THEN** the tool MUST return the corresponding documentation content

#### Scenario: Unknown identifier via tool

- **WHEN** the caller invokes `ae_docs_get` with a documentation identifier that does not exist
- **THEN** the tool MUST fail with a not-found error

### Requirement: Expose documentation as MCP resources

The server MUST also expose the same documentation corpus as MCP resources under stable URIs (for example `ae://docs/...`), listable and readable by URI. Resource URIs MUST match the URIs returned by `ae_docs_search` / accepted by `ae_docs_get`.

#### Scenario: Read docs resource by URI

- **WHEN** the caller reads a docs resource URI returned from search
- **THEN** the server MUST return the same section content that `ae_docs_get` would return for that URI

#### Scenario: List docs resources

- **WHEN** the caller lists MCP resources
- **THEN** the server MUST include documentation resources from the loaded corpus (or a documented pagination/template strategy that covers the corpus)

### Requirement: Attribution for Adobe guide content

Documentation responses MUST include attribution noting that guide content is copyright Adobe and maintained via the docsforadobe community guide (and Context7 packaging when that upstream is used).

#### Scenario: Attribution present on retrieve

- **WHEN** documentation content is returned to the caller
- **THEN** the response MUST include attribution metadata or text naming Adobe / docsforadobe as the source
