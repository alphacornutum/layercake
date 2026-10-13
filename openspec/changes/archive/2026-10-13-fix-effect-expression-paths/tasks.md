# Tasks

## 1. Operator documentation

- [x] 1.1 Add `set_property_expression` effect-path subsection to `docs/mcp-tools.md` (Effect Parade → effect instance → parameter; failing two-segment vs working three-segment Slider Control JSON; optional `propertyPath` with `->`) and verify examples match issue #25 confirmed paths
- [x] 1.2 Update `ae_get_layer` and `ae_patch_project` tool descriptions in `src/server.ts` with effect-instance segment guidance and verify strings appear in generated MCP metadata

## 2. Product skill

- [x] 2.1 Extend `.ai/src/skills/drive-after-effects/SKILL.md` with effect expression path gotcha + Slider Control example, run `agentsync sync`, and verify `.cursor/skills/drive-after-effects/SKILL.md` matches

## 3. Host regression test (no private AEP)

- [x] 3.1 Add gated host test in `tests/editing.ae.test.ts` that eval-adds a renamed Slider Control on `hello-world.aep`, asserts two-segment `set_property_expression` fails, and asserts three-segment paths (effect matchName and display name) succeed with expected evidence — verify via `npm run test:ae` when host env is configured
- [x] 3.2 Ensure test uses only committed `fixtures/hello-world.aep` + temp copy pattern (no template/private AEP paths) and verify `git status` shows no new fixture files

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run typecheck`, and `npm run lint`; run `npm run test:ae` when AE host is available
- [x] 4.2 Run `openspec validate fix-effect-expression-paths --strict` and verify change passes
