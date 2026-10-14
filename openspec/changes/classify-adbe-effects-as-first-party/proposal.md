# Proposal

## Why

`ae_project_summary` currently labels any effect outside the vendored first-party allowlist as third-party, which can misclassify native Adobe effects whose match names are omitted from that corpus. Treating the `ADBE` prefix as a reliable native Adobe identifier will make the dependency report more useful, including for effects such as `ADBE CM CropEdges`.

## What Changes

- Classify effect match names beginning with `ADBE` as first-party, regardless of whether the name appears in the generated allowlist.
- Generate the runtime fallback allowlist from vendored first-party names excluding `ADBE`-prefixed entries; continue using it for recognized native effects with other names (such as bundled `CC` effects). Keep the vendored guide corpus unchanged.
- Update the project-summary classification requirements and test the `ADBE` rule, non-`ADBE` allowlist behavior, and generated fallback list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ae-project-summary`: Change first-party effect classification from allowlist-only to `ADBE` prefix plus allowlist for other known first-party match names.

## Impact

- `src/inventory/effect-origin.ts`, `src/inventory/first-party-effect-match-names.ts`, and `scripts/generate-first-party-effect-allowlist.mjs` classification behavior and generated data.
- `tests/inventory.test.ts` coverage for effect-origin classification and the generated fallback list.
- `openspec/specs/ae-project-summary/spec.md` requirement and scenarios for classification.
- No MCP tool names or JSON fields change; `origin` and `hasThirdPartyEffects` values may change for effects with an `ADBE` match name missing from the allowlist.
