## Purpose

Evaluate caller-supplied ExtendScript in the active After Effects session with structured results, validation, and timeouts.

## Requirements

### Requirement: Evaluate ExtendScript in the active session

The server MUST provide an operation that evaluates caller-supplied ExtendScript source in the active After Effects session and returns the script result or a structured error.

#### Scenario: Successful evaluation

- **WHEN** the caller submits valid ExtendScript that completes without throwing
- **THEN** the operation MUST return success and include the script's result payload as text

#### Scenario: Script runtime error

- **WHEN** the caller submits ExtendScript that throws or fails at runtime inside After Effects
- **THEN** the operation MUST return a failure that includes an error message from the host (and line information when available)

#### Scenario: Empty script rejected

- **WHEN** the caller submits an empty or whitespace-only script
- **THEN** the operation MUST fail validation without invoking After Effects

### Requirement: Session prerequisite for script evaluation

ExtendScript evaluation MUST require an available After Effects host session. If a project-scoped operation is implied by the caller's script, the server MUST still evaluate the script against the current host state (open project or lack thereof) rather than inventing project context.

#### Scenario: Evaluate without open project

- **WHEN** a host session is available but no project has been opened via the server
- **THEN** evaluation MUST still be attempted against the current After Effects state and MUST return whatever result or error After Effects produces

#### Scenario: Evaluate after opening fixture project

- **WHEN** a fixture `.aep` has been opened successfully and the caller evaluates a read-only probe such as reading `app.project.numItems`
- **THEN** the operation MUST return a successful result reflecting that open project

### Requirement: Evaluation timeout

The server MUST enforce a configurable timeout around ExtendScript evaluation and MUST surface a timeout error when After Effects does not complete within that limit.

#### Scenario: Script exceeds timeout

- **WHEN** evaluation does not complete before the configured timeout
- **THEN** the operation MUST fail with a timeout error and MUST NOT report success

### Requirement: Windows script-file evaluation transport

On Windows, ExtendScript evaluation MUST invoke the configured After Effects executable with the `-r` switch and the path to a temporary script file that uses the shared wrap/result-file protocol (OK/ERR payload file). Evaluation MUST NOT depend on AppleScript. Validation of empty scripts, structured OK/ERR results, line information when available, and configurable timeouts MUST behave the same as on macOS from the caller's perspective.

#### Scenario: Successful evaluation on Windows transport

- **WHEN** the server runs on Windows with a host session available and the caller submits valid ExtendScript that completes without throwing
- **THEN** the operation MUST return success and include the script's result payload as text using the shared result-file protocol

#### Scenario: Timeout on Windows transport

- **WHEN** evaluation on Windows does not complete before the configured timeout
- **THEN** the operation MUST fail with a timeout error and MUST NOT report success

#### Scenario: Empty script still rejected without invoking After Effects

- **WHEN** the caller submits an empty or whitespace-only script on Windows
- **THEN** the operation MUST fail validation without invoking the After Effects executable

### Requirement: Pre-validate agent ExtendScript dialect before host eval

Before invoking After Effects, `ae_eval_script` MUST validate caller-supplied source with an agent-safe ExtendScript dialect check. The server MUST hard-refuse (MCP `isError`, without invoking the host) when the source is empty/whitespace-only, contains compiler-directive comments (`// @` or `/// <reference`), contains non-ASCII bytes, or is not valid ECMAScript 3 when parsed with return-outside-function allowed (after stripping ES3-illegal trailing commas for the candidate body). Validation MUST NOT apply the first-party undeclared-globals / eslint-scope gate used for emitted `dist/ae-scripts/*.jsx`. On hard refuse, the error text MUST identify the ExtendScript/ES3 dialect constraint and MUST steer callers toward `var`, `function`, and `for`-loop idioms (and MAY cite the product skill ExtendScript reference URI). When the only issue is trailing commas, the server MUST strip those commas and proceed rather than refuse. Successful evaluation MUST use the comma-stripped candidate as the user source passed into the existing wrap/result-file protocol. `JSON.stringify` / `JSON.parse` polyfill injection and OK/ERR result handling MUST remain unchanged.

#### Scenario: Modern syntax refused without host

- **WHEN** the caller submits `ae_eval_script` source that uses non-ES3 syntax such as `const`, `let`, arrow functions, or optional chaining
- **THEN** the operation MUST fail validation with an ExtendScript/ES3 dialect error and MUST NOT invoke After Effects

#### Scenario: Trailing commas stripped then evaluated

- **WHEN** the caller submits otherwise valid ES3 source whose only dialect issue is ES3-illegal trailing commas in object or array literals
- **THEN** the server MUST strip those commas and MUST evaluate the stripped source through the normal host path

#### Scenario: Non-ASCII refused

- **WHEN** the caller submits script source containing non-ASCII bytes
- **THEN** the operation MUST fail validation without invoking After Effects and MUST NOT silently replace those bytes

#### Scenario: Valid ES3 still evaluates

- **WHEN** the caller submits non-empty ES3-compatible source (ASCII, no directive comments) that completes without throwing in After Effects
- **THEN** the operation MUST return success and include the script's result payload as text under the existing wrap protocol

### Requirement: Soft-warn common ES5+ APIs that are not hard-refused alone

The server MUST scan `ae_eval_script` source for a small fixed denylist of common ES5+ APIs that are valid as ES3 _syntax_ but typically missing in the After Effects host (including at least `.map`, `.filter`, `.find`, and `Object.assign` call patterns). Denylist matches MUST NOT by themselves cause validation failure or change the success result payload shape. When the server hard-refuses for a dialect/syntax reason and denylist matches are also present, the error text MUST mention those matches. Operator-facing tool description and/or the product skill ExtendScript reference MUST document that these APIs are unsafe in ExtendScript.

#### Scenario: Denylist alone does not block eval

- **WHEN** the caller submits ES3-valid source that uses a denylisted pattern such as `.map(` and the script would otherwise be evaluated
- **THEN** the server MUST still invoke After Effects (subject to normal host errors) and MUST NOT fail validation solely because of the denylist match

#### Scenario: Denylist mentioned on hard refuse

- **WHEN** the caller submits source that fails the hard dialect check and also matches the denylist
- **THEN** the validation error text MUST include both the dialect failure and the denylist matches

### Requirement: Document ae_eval_script return completion contract

Operator-facing documentation for `ae_eval_script` MUST state that LayerCake wraps caller source and returns that body’s **completion value** as the MCP text result (via the existing OK/ERR result-file protocol). The docs MUST state that a top-level `return` is required when the caller wants a non-empty payload; that `undefined`/`null` completion values are returned as successful empty text; and that empty success is intentional for void / side-effect-only scripts. The docs MUST warn that a bare top-level IIFE whose only `return` is _inside_ the IIFE discards that value under the wrap (side effects may still run and dirty the project), and MUST show the fix pattern `return (function () { …; return value; })();` (or an equivalent top-level `return`). The docs MUST state that LayerCake does **not** impose a result size limit on `ae_eval_script` success payloads (distinct from the inspect-tool `AE_INSPECT_MAX_BYTES` fail-closed gate). Troubleshooting guidance MUST map the symptom “MCP success with empty body while the project became dirty / side effects ran” to a missing top-level `return`, not to truncation.

#### Scenario: mcp-tools documents return vs void vs IIFE

- **WHEN** an operator or agent reads `docs/mcp-tools.md` for `ae_eval_script`
- **THEN** the page MUST document top-level `return` for payloads, empty success for void scripts, the bare-IIFE footgun with the `return (function…)` fix, and that eval has no LayerCake result size limit

#### Scenario: troubleshooting maps empty success to missing return

- **WHEN** an operator or agent reads `docs/troubleshooting.md` for empty or missing eval results
- **THEN** the page MUST distinguish missing result-file / scripting preferences from empty success caused by a missing top-level `return` after the script ran
