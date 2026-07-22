## ADDED Requirements

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
