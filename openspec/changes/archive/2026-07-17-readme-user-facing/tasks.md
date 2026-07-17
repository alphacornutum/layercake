## 1. Operator docs under docs/

- [x] 1.1 Add `docs/setup.md` — install variants, AE scripting preference, executable/env config, full MCP JSON (macOS/Windows, built + optional `tsx`), absolute-path notes, verify checklist, `test:ae`, fuller safety
- [x] 1.2 Add `docs/mcp-tools.md` — full `ae_*` table, Layer vs Item ids, skill filesystem + `skill://` detail
- [x] 1.3 Add `docs/troubleshooting.md` — symptom guide, env vars table, limitations
- [x] 1.4 Add `docs/scripting-guide.md` — `docs:fetch`, attribution, link to ADR

## 2. Root README (showcase + quickstart)

- [x] 2.1 Rewrite `README.md` as overview + appetizer + easy quickstart (Chatty tone, more concise); optional 1–2 emoji LayerCake mark near the title
- [x] 2.2 Include example prompts, short capabilities, requirements (macOS/Windows, Node, AE), one-line Win11 UTM note
- [x] 2.3 State mutations go through `ae_eval_script` and dedicated write tools are out of scope (brief OK)
- [x] 2.4 Minimal quickstart on the README; link to `docs/setup.md` for full MCP/env variants
- [x] 2.5 Brief tools + skill pointers that satisfy contracts; link to `docs/mcp-tools.md` for the full table/ids/skill detail
- [x] 2.6 Short safety + verify; link troubleshooting / scripting-guide docs; link CONTRIBUTING / ARCHITECTURE / ADRs; MIT license
- [x] 2.7 Remove former-name history, “hardware-unverified” Windows caveat, and standalone Windows VM smoke checklist from the README

## 3. Accuracy and compliance

- [x] 3.1 Cross-check tools, env defaults, and skill URIs against `src/`, `.env.example`, and existing specs
- [x] 3.2 Confirm README satisfies `product-identity` delta (showcase/quickstart, docs links, no rename history, Windows available, optional light emoji, platforms + mutation scope)
- [x] 3.3 Confirm README still documents skill filesystem + `skill://` channels per `ae-product-skill` (brief + link OK)
