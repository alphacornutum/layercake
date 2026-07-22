## 1. ADR and schema

- [x] 1.1 Add `docs/adr/0006-optional-create-names.md` (optional `name` on all typed create ops; omit = host default / conventional placeholder when API requires a string; evidence returns final name)
- [x] 1.2 Soften `name` to optional on `create_folder` and `create_solid` Zod schemas; document conventional placeholders used when AE APIs require a name argument
- [x] 1.3 Add `create_text` Zod schema (`target` comps-only, `layout`, `text`, conditional `boxTextSize`, optional `name`, optional `style` allowlist) and wire into the patch operations union + TypeScript evidence types

## 2. Apply path

- [x] 2.1 Implement `create_text` in the patch apply ExtendScript entry (resolve comp; `addText` / `addBoxText`; set text; apply optional style via shared text-document helpers; optional rename; post-condition; delete orphan on style/post-condition failure)
- [x] 2.2 Update `create_solid` / `create_folder` apply paths for optional `name` (host default or placeholder when omitted; always return final name in evidence)
- [x] 2.3 Rebuild AE scripts (`npm run build:ae-scripts`) and ensure Node loaders pick up the new apply code

## 3. Server, docs, skill

- [x] 3.1 Update `ae_patch_project` tool description in `src/server.ts` to mention `create_text` and optional create names
- [x] 3.2 Update `docs/mcp-tools.md` for `create_text` and optional `name` on create ops; link ADR 0006 where operators need the “why”
- [x] 3.3 Update `.ai/src/skills/drive-after-effects/SKILL.md` (and keep `skills/drive-after-effects/` in sync per product-skill rules) with `create_text`, optional create names, and the point↔box recreate recipe; run `agentsync sync` if `.ai/src/` was edited
- [x] 3.4 Update `ARCHITECTURE.md` if the capability map / patch vocabulary list needs `create_text` or the naming ADR

## 4. Tests and verify

- [x] 4.1 Unit tests: schema refine (box requires size; point rejects size); optional name on create ops; evidence shape fixtures as applicable
- [x] 4.2 Host tests (`npm run test:ae` when AE available): point and box create, optional style, omit name, style-failure rollback
- [x] 4.3 Run full QA: `agentsync check` (Shell `required_permissions: ["all"]`), `npm audit --audit-level=high`, `typecheck`, `lint`, `fmt:check`, `test`, `build`
