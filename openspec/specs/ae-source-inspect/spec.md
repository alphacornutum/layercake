## Purpose

Expose a read-only MCP tool to inspect one FootageItem’s identity and interpret/proxy settings in an open After Effects project, without changing the `ae_list_sources` list payload shape.

## Requirements

### Requirement: Source inspect tool

The MCP server MUST expose a read-only tool `ae_get_source` that returns structured JSON describing one `FootageItem` in the open After Effects project, including footage/proxy source interpret settings according to the requested detail level. This tool MUST NOT require changes to `ae_list_sources` payload shape.

#### Scenario: Successful inspect by id

- **WHEN** the caller invokes `ae_get_source` with a resolvable `sourceId` and a project is open
- **THEN** the tool MUST succeed with JSON identifying that footage item by stable `Item.id` and including source detail shaped by `detail`

#### Scenario: Host or project unavailable

- **WHEN** After Effects is unavailable or no project is open
- **THEN** the tool MUST fail with a clear structured error (not an empty success payload)

#### Scenario: Non-footage item id

- **WHEN** `sourceId` refers to a project item that is not a `FootageItem`
- **THEN** the tool MUST fail with a clear error

### Requirement: Source lookup by id or name

The tool MUST accept exactly one of `sourceId` or `sourceName`. Name matches MUST be case-sensitive exact matches against `FootageItem` names in the live project.

#### Scenario: Reject missing or duplicate selectors

- **WHEN** the caller omits both selectors or supplies both
- **THEN** the tool MUST fail with a clear validation error

#### Scenario: Ambiguous source name

- **WHEN** `sourceName` matches more than one `FootageItem`
- **THEN** the tool MUST fail and MUST include a candidate list of matching sources with at least `id` and `name` for each

#### Scenario: Not found

- **WHEN** the selector matches no `FootageItem`
- **THEN** the tool MUST fail with a clear not-found error (not a soft success payload)

### Requirement: Source detail tiers

The tool MUST accept `detail` with allowed values `overview` and `full`, defaulting to `overview`.

#### Scenario: Default overview

- **WHEN** the caller omits `detail`
- **THEN** the tool MUST behave as `detail: "overview"`: include the high-value identity/media fields consistent with an `ae_list_sources` row for that item, plus a compact interpret summary when available, without requiring the full interpret field set

#### Scenario: Full interpret dump

- **WHEN** `detail` is `full`
- **THEN** the payload MUST include `mainSource` interpret/media fields available from the After Effects DOM (including alpha, field separation, pulldown, frame-rate, loop, and kind-specific file/solid/placeholder data as applicable) and MUST include `proxySource` when a proxy is present

### Requirement: Agent-facing tool documentation

The MCP tool description for `ae_get_source` MUST document detail tiers, id-or-name lookup with ambiguity errors, that deep Interpret Footage settings require `detail: "full"`, and that over-limit results are hard errors (narrow with leaner `detail`).

#### Scenario: Description mentions full interpret settings

- **WHEN** an agent reads the `ae_get_source` tool description
- **THEN** it MUST be able to determine that `overview` is compact and `full` returns interpret/proxy detail

### Requirement: Inspect result size limit

The tool MUST refuse to return a success payload whose UTF-8 JSON text exceeds the configured inspect size limit. The default limit MUST be 512 KiB (524288 bytes). The limit MUST be overridable via the `AE_INSPECT_MAX_BYTES` environment variable (positive integer). Over-limit responses MUST be hard errors that include the actual size, the limit, and guidance to narrow with a leaner `detail` (and selectors where applicable). The tool MUST NOT silently truncate the payload to fit.

#### Scenario: Over-limit hard error

- **WHEN** a successful inspect would stringify to more bytes than the configured limit
- **THEN** the tool MUST fail with a clear error that reports size and limit and MUST NOT return a truncated success JSON body

#### Scenario: Default limit

- **WHEN** `AE_INSPECT_MAX_BYTES` is unset
- **THEN** the effective limit MUST be 524288 bytes

### Requirement: Agent-readable JSON result

The tool MUST return a single JSON object suitable for agent consumption (stringified in MCP text content consistent with other host tools).

#### Scenario: Top-level shape

- **WHEN** `ae_get_source` runs successfully
- **THEN** the result MUST include project context (`projectName` or equivalent), the resolved source identity, the effective `detail`, and the source payload
