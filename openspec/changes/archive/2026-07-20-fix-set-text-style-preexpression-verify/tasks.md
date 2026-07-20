## 1. Apply script and types

- [x] 1.1 Add `readAuthoredTextDocument` and `readEvaluatedTextDocument` in `src/patch/apply-script.ts` (authored: `valueAtTime(comp.time, true)` when canVaryOverTime or non-empty expression; evaluated: `valueAtTime(comp.time, false)` or `.value`; try/catch fallbacks)
- [x] 1.2 Wire `applySetTextStyle` before/mutate/`setValue`/after and catch-path through authored helper; post-condition only on authored `fonts`; attach `evaluatedFonts` on before/after when readable
- [x] 1.3 Extend `TextStyleTargetResult` in `src/patch/types.ts` with optional `evaluatedFonts` on before/after; update parse/shaping if it validates evidence shapes

## 2. Tests

- [x] 2.1 Extend `tests/patch.test.ts` to assert the apply script contains `valueAtTime`, a `true` pre-expression path, and `evaluatedFonts` evidence keys
- [x] 2.2 Run `npm test` (patch unit); run `npm run test:ae` only if host is available (no new expression-font fixture)

## 3. Docs and skill

- [x] 3.1 Update `docs/mcp-tools.md`: `fonts` vs `evaluatedFonts`; post-condition on authored; mismatch → patch sources; correct the line that implies `valueAtTime` is unused for this path
- [x] 3.2 Update `docs/adr/0003-patch-targeting-and-post-conditions.md`: font post-reads are pre-expression; dual evidence for evaluated fonts
- [x] 3.3 Update `.ai/src/skills/drive-after-effects/SKILL.md` (and keep `skills/drive-after-effects/SKILL.md` aligned) with dual evidence + source-first when evaluated differs; run `agentsync sync`

## 4. Verify

- [x] 4.1 Full QA: `agentsync check` (Cursor Shell `required_permissions: ["all"]`), `npm audit --audit-level=high`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm test`, `npm run build`
