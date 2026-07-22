## MODIFIED Requirements

### Requirement: Modern TypeScript emits ES3-compatible eval payloads

First-party AE script entrypoints MUST be compiled/bundled into self-contained **ES3-compatible** source text suitable for evaluation inside After Effects via the existing host eval path (`AeHost.evalScript` and `wrapExtendScript`). Authors MAY use modern TypeScript syntax in source. Emitted payloads MUST NOT depend on CEP, bolt-cep, or a panel `evalTS` bridge. Caller-supplied `ae_eval_script` strings MUST NOT be required to pass the AE script TypeScript project or the first-party undeclared-globals emit gate. The server MAY apply a separate agent-safe pre-eval dialect check (ES3 parse and related hard refuses documented under `extendscript-execution`) before wrapping and evaluating those strings.

#### Scenario: Inventory or patch path evaluates emitted ES3

- **WHEN** the server runs a first-party inventory or patch operation that evaluates host script
- **THEN** the evaluated payload MUST be the ES3-emitted text for that entrypoint (after the shared wrap/result-file protocol), not an uncompiled TypeScript module

#### Scenario: Emit is part of package build

- **WHEN** a contributor runs the project's production build used to populate `dist/` / the published package
- **THEN** first-party AE script entrypoints MUST be emitted so runtime loaders can obtain ES3 source without a separate manual step

#### Scenario: Agent eval escape hatch is not the AE TypeScript project

- **WHEN** a caller invokes `ae_eval_script` with arbitrary ExtendScript source
- **THEN** the server MUST NOT require that source to typecheck or build as a first-party `src/ae-scripts/` module, and MUST evaluate it only after any agent-safe dialect pre-flight required by `extendscript-execution`, under the existing wrap/result-file protocol
