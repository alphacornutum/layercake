## 1. First-party allowlist

- [x] 1.1 Add a script (or extend `docs:fetch`) that extracts effect match names from `vendor/.../matchnames/effects/firstparty.md` into a committed JSON/TS allowlist under `src/inventory/`
- [x] 1.2 Wire npm script(s) so regenerating the corpus also refreshes the allowlist; document the step briefly near docs fetch
- [x] 1.3 Commit the generated allowlist so installs work without a fresh docs fetch for classification

## 2. Inventory module

- [x] 2.1 Add TypeScript types for the `ae_project_summary` payload in `src/inventory/types.ts`
- [x] 2.2 Implement ExtendScript collector (`list-project-summary-script.ts`) for identity, counts, settings, effect aggregation (`matchName`/`displayName`/`instanceCount` + `app.effects` availability), missing footage, and soft-fail fonts
- [x] 2.3 Implement `list-project-summary.ts` + parse/classify helpers: apply allowlist → `origin`, compute `hasThirdPartyEffects`, validate JSON shape
- [x] 2.4 Register `ae_project_summary` in `src/server.ts` with Zod schema (no args or empty object) and clear tool description

## 3. Tests

- [x] 3.1 Unit-test allowlist loading and first/third-party classification (include at least one non-`ADBE` first-party matchName fixture)
- [x] 3.2 Unit-test parse of a full summary fixture (effects, missing footage, fonts soft-fail flags)
- [x] 3.3 Add or extend a host test (`*.ae.test.ts`) for `ae_project_summary` against the fixture project when host env is configured (skip otherwise)

## 4. Docs and skill

- [x] 4.1 Document `ae_project_summary` in `docs/mcp-tools.md` and briefly in `README.md`
- [x] 4.2 Update `skills/drive-after-effects/SKILL.md` to recommend the tool for health/portability after open
- [x] 4.3 On sync/archive, update `ARCHITECTURE.md` capability map for `ae-project-summary`

## 5. Verification

- [x] 5.1 Run unit tests and typecheck/lint/fmt checks relevant to touched files
- [x] 5.2 Run `npm run test:ae` when AE host env is available; otherwise note skip in the apply summary
