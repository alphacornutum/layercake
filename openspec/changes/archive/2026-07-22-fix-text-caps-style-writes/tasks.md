## 1. Apply path

- [x] 1.1 Update shared text-document helpers to write caps via `fontCapsOption` (merge omitted sibling from authored booleans; encode four enum states; skip assigning read-only `allCaps`/`smallCaps`)
- [x] 1.2 Keep `allStyleRuns` character-range path consistent for caps (write enum on range when used, else document)

## 2. Tests

- [x] 2.1 Unit: apply-script contains `fontCapsOption` mapping; schema still rejects `fontCapsOption` as a style key; accepts boolean pair
- [x] 2.2 Host (`editing.ae.test.ts`): round-trip all-caps / small-caps / normal / all-small-caps via `set_text_style` + authored evidence (skipIf no host)

## 3. Docs / support floor

- [x] 3.1 README: AE 26+ badge + Requirements note (older may work, unsupported)
- [x] 3.2 Align setup / `.env.example` / README quickstart examples from 2025 → 2026 where they name the app
- [x] 3.3 `docs/mcp-tools.md`: note caps write path + send both booleans when enforcing a mode

## 4. Verify

- [x] 4.1 Run unit QA (`typecheck`, `lint`, `fmt:check`, `npm test`); note `test:ae` if host unavailable
