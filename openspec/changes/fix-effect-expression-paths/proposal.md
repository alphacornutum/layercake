# Proposal

## Why

Agents targeting Slider Control (and similar effect) parameters via `set_property_expression` often omit the **effect instance** segment between `ADBE Effect Parade` and the parameter matchName (e.g. `ADBE Slider Control-0001`). The resolver is correct — AE requires the middle level — but docs and tool descriptions imply a flat matchNames path copied from `ae_get_layer`, which shows a nested tree without a ready-to-use selector. Issue [#25](https://github.com/alphacornutum/layercake/issues/25) confirms three-segment paths already work; the gap is guidance and regression coverage.

## What Changes

- Document that effect **parameter** paths MUST include the parent effect group segment (effect matchName when unique on the layer, or effect display name when multiple instances share the same matchName).
- Update operator docs (`docs/mcp-tools.md`), MCP tool descriptions (`ae_get_layer`, `ae_patch_project`), and the product skill with Slider Control examples (matchName and display-name middle segments; `propertyPath` with `->` when names contain dots).
- Add a host test in `tests/editing.ae.test.ts` that **programmatically** adds a renamed Slider Control to the committed `hello-world.aep` fixture via `ae_eval_script` setup — no private/template AEP in the repo.
- Host test asserts: two-segment path (Effect Parade → param) fails; three-segment paths (via effect matchName and via display name) succeed with expected `resolvedMatchNames` evidence.

**Out of scope (defer):** smart resolver hints when a segment exists only nested under an effect group; new `#` propertyPath delimiter; `ae_get_layer` emitting copy-paste `pathSegments` on nodes.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `ae-project-patch`: Clarify effect parameter path requirements for `set_property_expression`; add operator-doc and host-test scenarios.
- `ae-layer-inspect`: Document that property tree nodes are not a flat matchNames path; effect instance segments are required for patch selectors.
- `ae-product-skill`: Document effect expression path construction so agents prefer typed patch over eval for Slider Control targets.

## Impact

- **Docs:** `docs/mcp-tools.md`, MCP tool descriptions in `src/server.ts`, `.ai/src/skills/drive-after-effects/SKILL.md` (sync via agentsync).
- **Tests:** New gated case in `tests/editing.ae.test.ts` (uses public fixture + eval setup only).
- **Code:** No resolver or schema changes expected; behavior is already correct.
- **Contracts:** Additive spec scenarios and documentation requirements only — no breaking MCP JSON shapes.
