## 1. Shared TextDocument projection

- [x] 1.1 Add a shared ExtendScript helper that reads a TextDocument into the allowlisted style snapshot (+ `boxText` / `pointText`), used by both patch evidence and inspect
- [x] 1.2 Spike on host (or document findings): `leading` ↔ `autoLeading` write interaction; justification enum strings; box vs point refuse behavior

## 2. Patch schema and apply

- [x] 2.1 Widen Zod `style` bag in `src/patch/schema.ts` (allowlist, ≥1 key, reject unknown; `font` optional when other keys present)
- [x] 2.2 Extend `applySetTextStyle` to write supplied keys on authored TextDocument (`allStyleRuns` for character attrs; document-level for paragraph/content/box); leave expressions untouched
- [x] 2.3 Emit before/after `style` + `evaluatedStyle` evidence; keep `fonts` / `evaluatedFonts`; post-condition only on supplied authored keys
- [x] 2.4 Update `src/patch/types.ts` and any server tool description text for the expanded op

## 3. Inspect read path

- [x] 3.1 Project `TEXT_DOCUMENT` in `inspect-script.ts` instead of `unserializable` on `extended`/`full`
- [x] 3.2 Add dual `authoredValue` / `evaluatedValue` style projections when SourceText has keys or expression (Transform parity)
- [x] 3.3 Update inspect parse/types/docs echo fields if the envelope needs typed parsing

## 4. Tests

- [x] 4.1 Unit tests: schema validation (font-only, autoLeading-only, empty style, unknown key); evidence/parse fixtures as applicable
- [x] 4.2 Unit tests: inspect serialization fixture for projected TextDocument (and shape still unserializable)
- [x] 4.3 Host e2e (`test:ae` when available): set `autoLeading` / another non-font key; re-read via inspect; confirm fonts-only path still works

## 5. Docs and skill

- [x] 5.1 Update `docs/mcp-tools.md` for style bag, dual style evidence, and SourceText inspect projection
- [x] 5.2 Update `.ai/src/skills/drive-after-effects/` (then `agentsync sync`) for plan→inspect→patch→verify workflow
- [x] 5.3 Update `ARCHITECTURE.md` if the capability map / tool surface wording needs it
- [x] 5.4 Run full QA (`agentsync check` with unrestricted shell, typecheck, lint, fmt, unit tests, build)
