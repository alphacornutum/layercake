# Tasks

## 1. Classification behavior

- [x] 1.1 Update the allowlist generator to omit `ADBE`-prefixed entries from its generated fallback list; run `npm run docs:allowlist` and verify the output contains no `ADBE` entries while retaining known non-`ADBE` names such as `CC Radial Blur`.
- [x] 1.2 Classify every `ADBE`-prefixed effect match name as first-party before checking the generated fallback list; verify unit tests cover an unlisted `ADBE` name and a known non-`ADBE` stock effect.
- [x] 1.3 Preserve third-party classification for unknown non-`ADBE` names; verify with the existing unknown-effect unit case.
- [x] 1.4 Update the `ae_project_summary` tool description to document the `ADBE` prefix rule plus the non-`ADBE` first-party fallback list; verify the description no longer claims allowlist-only classification.

## 2. Verification

- [x] 2.1 Run the focused inventory test suite and confirm all effect-origin classification cases pass.
- [x] 2.2 Run `openspec validate classify-adbe-effects-as-first-party --strict` and resolve any spec or artifact validation errors.
