## Context

afx-inspector already ships a read-only docs corpus as both on-disk files and MCP resources (`ae://docs/...`). End-user workflow guidance for using the AE tools lives only in contributor AgentSync skills today (`.ai/src/skills/drive-after-effects/`), which MCP installers never see.

SEP-2640 (Skills Extension, draft) defines serving [Agent Skills](https://agentskills.io/) over MCP Resources with the `skill://` URI scheme and optional `skill://index.json`. Baseline consumption is `resources/read` of a known URI; richer hosts may later merge indexed skills into their native skill UI.

**Host readiness (clarifying earlier explore note):** “Is the client (Cursor, Claude Desktop, etc.) wired to auto-discover MCP-served skills the same way it loads local `.cursor/skills/` folders?” Until hosts implement SEP-2640 registry merging, end users still benefit from (1) copying `skills/` into their agent skill directory, and (2) agents reading `skill://…` via MCP resources when pointed by server `instructions`. We do not wait on host UI support to ship the resources.

## Goals / Non-Goals

**Goals:**

- One product skill, `drive-after-effects`, owned at `skills/drive-after-effects/` (Agent Skills format: `SKILL.md` + optional supporting files).
- Serve that tree as MCP resources under `skill://drive-after-effects/...` plus `skill://index.json`.
- Short MCP server `instructions` that name the skill URI so agents can load it without host-native skill merge.
- README documents filesystem install and MCP/SEP-2640 serving.
- Package artifact includes `skills/` so npm/npx users get the files.
- Tool descriptions remain the primary “what this tool does” surface; skill is orchestration/gotchas only.

**Non-Goals:**

- AgentSync / `.ai/src/` / contributor skills (OpenSpec, agentsync, add-ae-mcp-tool) — no wiring, no sync, no dual-source.
- Multiple product skills or a skill marketplace publisher pipeline.
- Archive (`.tar.gz`) skill packaging (SEP allows it; skip until multi-file skill needs it).
- Changing existing `ae_*` tool names, schemas, or inventory JSON contracts.
- Implementing host-side SEP-2640 client behavior (out of our control).

## Decisions

### 1. Canonical location: top-level `skills/`

- **Choice:** `skills/drive-after-effects/SKILL.md` is the only source of truth for the product skill.
- **Why:** Clear ship surface for end users and packages; not entangled with contributor AgentSync trees.
- **Alternatives:** Keep under `.ai/src/skills/` (rejected — AgentSync is contributor-only). Serve from embedded string constants (rejected — harder to edit/review as Agent Skills files).

Seed content from the existing contributor skill text once, then maintain only under `skills/`. Leave `.ai/src/skills/drive-after-effects` alone in this change (contributor concern; may diverge or be deleted later outside this work).

### 2. MCP surface: Resources + instructions, not a new tool

- **Choice:** Register listable/readable `skill://` resources (same pattern as docs). Add a brief `instructions` string on the MCP server pointing at `skill://drive-after-effects/SKILL.md`. Do not add `ae_get_skill`.
- **Why:** Matches SEP-2640; avoids bloating the tool table; agents already have resource-read paths in capable hosts.
- **Alternatives:** MCP Prompts-only (weaker discovery, not Agent Skills format). Dedicated fetch tool (redundant with resources).

### 3. Module placement: `src/skills/` loader, thin server registration

- **Choice:** Small package under `src/skills/` (load directory → map of path → text; build index JSON). `server.ts` registers resources; `index.ts` loads at boot like docs.
- **Path resolution:** Default to `<package-root>/skills` resolved from the installed package location (same class of problem as finding vendored docs). Optional env override only if needed for tests; prefer zero new env vars if package-relative resolution is reliable.
- **Missing skill dir:** Server still starts; omit skill resources and omit/soften instructions rather than fail boot (tools remain usable).

### 4. SEP-2640 conformance level

- **MUST:** Serve `skill://drive-after-effects/SKILL.md` (and any sibling files under that skill directory); frontmatter `name` equals final path segment `drive-after-effects`; `mimeType` `text/markdown` for `SKILL.md`.
- **SHOULD:** Serve `skill://index.json` listing the one skill (`type: "skill-md"`).
- **SHOULD:** Declare extension `io.modelcontextprotocol/skills` on initialize when the SDK allows; if the current `@modelcontextprotocol/sdk` cannot express extension capabilities cleanly, ship resources + instructions first and note the gap — do not block on SDK support.
- **Skip for v1:** Archive entries, resource templates, `_meta` frontmatter mirroring beyond name/description on the SKILL.md resource.

### 5. Packaging and README

- **Choice:** Add `skills/**` to the published package (`package.json` `"files"` or equivalent) alongside `dist/`. README gets an “Agent skill (end users)” section: copy/symlink into the host’s skills directory; same content available via MCP `skill://` per SEP-2640; link or brief pointer to the draft SEP.
- **ARCHITECTURE.md:** Add product skill to the capability map / resources note on sync/archive of this change.

### 6. Tool descriptions vs skill

- **Choice:** Review `ae_*` tool descriptions for clarity (when to use, absolute paths, id vs index) as a light pass in this change. Do not expand tools into full workflow docs — that stays in the skill.

## Risks / Trade-offs

| Risk                                                     | Mitigation                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hosts do not auto-list MCP skills yet (“host readiness”) | README filesystem install + server `instructions` URI pointer; resources still work via `resources/read` |
| SEP-2640 still draft; URI/index details may shift        | Keep serving logic small and centralized; track SEP; prefer additive fixes                               |
| Duplicate skill text vs contributor `.ai` copy           | This change does not sync them; product path is `skills/` only                                           |
| Package-relative path wrong under `tsx` vs `node dist/`  | Resolve from a known package root helper; unit-test path resolution with fixtures                        |
| Skill missing after incomplete install                   | Soft-fail: tools work; no skill resources                                                                |

## Migration Plan

1. Add `skills/drive-after-effects/` with product-facing `SKILL.md`.
2. Implement loader + MCP registration + instructions.
3. Update package files list, README, ARCHITECTURE (with OpenSpec sync/archive).
4. No runtime migration for existing users; additive resources only.
5. Rollback: remove resource registration and `skills/` from package; no tool contract rollback needed.

## Open Questions

- None blocking. Optional later: delete or redirect the contributor copy under `.ai/src/skills/drive-after-effects` so it does not drift (explicitly out of this change).
