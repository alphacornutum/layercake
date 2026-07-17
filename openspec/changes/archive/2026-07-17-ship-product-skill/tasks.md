## 1. Product skill on disk

- [x] 1.1 Create `skills/drive-after-effects/SKILL.md` (Agent Skills frontmatter `name` / `description` + end-user workflow body seeded from the existing drive-after-effects content)
- [x] 1.2 Ensure `package.json` publishes `skills/**` (add or extend `"files"` so the skill ships with the package)

## 2. Skill loader

- [x] 2.1 Add `src/skills/` module to resolve the package `skills/` root and load `drive-after-effects` files (parse frontmatter name/description; soft-fail if missing)
- [x] 2.2 Build `skill://index.json` payload for the loaded skill
- [x] 2.3 Add unit tests for load, URI mapping, index shape, and missing-directory soft-fail

## 3. MCP registration

- [x] 3.1 Wire skill load in `src/index.ts` (analogous to docs corpus)
- [x] 3.2 Register `skill://drive-after-effects/{+path}` resources (list + read) in `src/server.ts`
- [x] 3.3 Register `skill://index.json` when the skill is loaded
- [x] 3.4 Set MCP server `instructions` pointing at `skill://drive-after-effects/SKILL.md` when loaded; omit skill claim when not loaded
- [x] 3.5 Declare `io.modelcontextprotocol/skills` extension on initialize if the SDK supports it; otherwise document the gap in a short code comment / README note

## 4. Tool clarity (light pass)

- [x] 4.1 Review `ae_*` tool descriptions in `src/server.ts` and tighten wording where needed (absolute paths, inventory-before-eval, id vs index) without expanding into full workflow docs

## 5. Documentation

- [x] 5.1 Add README section for end users: filesystem install of `skills/drive-after-effects` + MCP `skill://` / SEP-2640 serving (no AgentSync)
- [x] 5.2 Update `ARCHITECTURE.md` capability map / resources note for the product skill layer
- [x] 5.3 Run `npm run typecheck && npm run lint && npm test` and fix regressions
