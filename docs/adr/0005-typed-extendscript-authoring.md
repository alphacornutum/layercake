# Typed first-party ExtendScript (Types-for-Adobe, not bolt-cep)

Author inventory/patch ExtendScript as modern TypeScript under `src/ae-scripts/`, typechecked against `types-for-adobe` (`AfterEffects/24.6`), and emit self-contained ES5/`var` payloads (`dist/ae-scripts/*.jsx`) for `AeHost.evalScript`. Do **not** adopt bolt-cep (CEP panels, Vite HMR, `evalTS`) — LayerCake is an MCP host bridge, not a CEP extension. Types-for-Adobe is IDE help only; when typedefs disagree with the vendored Scripting Guide or host tests, the guide and `npm run test:ae` win.

## Status

accepted

## Considered options

- **bolt-cep** — Rejected; wrong product shape (CEP UI + panel bridge).
- **Keep untyped template strings** — Rejected; DOM mistakes only fail at host runtime.
- **Pin Types-for-Adobe to AE 26** — Rejected while the supported floor is 24.6+; npm ships 24.6.

## Consequences

- Separate `tsconfig.ae.json` (no Node globals); root/build tsconfigs exclude `src/ae-scripts/`.
- `npm run build:ae-scripts` is required before `build` / `test` / `typecheck` / `dev`.
- TypeScript 5.9 removed `target: ES3`; emit uses `ES5` (var-based). The mandatory build gate strips trailing commas (illegal in ES3), non-ASCII characters (DoScriptFile encoding is unreliable), and TypeScript directive/reference comments (`@ts-*`, triple-slash references), which ExtendScript misreads as compiler directives.
- Every emitted entry is parsed as ECMAScript 3 and scope-analyzed before it is written. The build fails on syntax hazards or undeclared non-host globals; dynamic preamble globals are allowlisted per entry. Unit tests independently inspect every emitted `.jsx`.
