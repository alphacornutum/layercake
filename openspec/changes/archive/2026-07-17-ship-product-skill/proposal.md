## Why

End users who connect afx-inspector as an MCP server get tools but not the workflow know-how that makes them safe and effective (host check → inventory → docs → id-based eval). That guidance already exists for contributors under AgentSync; it must ship with the product for MCP users, independently of clone-and-sync contributor tooling.

## What Changes

- Add a top-level `skills/` directory as the canonical, shippable home for the single end-user product skill (`drive-after-effects`).
- Serve that skill over MCP as Resources using the SEP-2640 Skills Extension convention (`skill://…`, including `skill://index.json`).
- Point agents at the skill from MCP server `instructions` so it is discoverable even when the host does not yet auto-merge MCP skills into its local skill UI.
- Document in `README.md` how to install/use the filesystem skill and that the same content is also served via MCP resources ([SEP-2640: Skills Extension](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640)).
- Ensure the skill directory is included in the published package artifact (e.g. npm `files`) so install/npx users receive it.
- Keep tool descriptions clear enough that routine use does not depend on the skill; the skill covers orchestration, id namespaces, and host gotchas.
- **Out of scope:** AgentSync, `.ai/src/`, and contributor-only skills/rules — no changes to that pipeline.

## Capabilities

### New Capabilities

- `ae-product-skill`: Ship one end-user Agent Skill (`drive-after-effects`) from a top-level `skills/` tree, expose it as MCP `skill://` resources per SEP-2640, declare the skills extension where supported, and document filesystem + MCP consumption for end users.

### Modified Capabilities

- (none — existing tool/docs/host requirements stay as-is; clearer tool copy is an implementation hygiene task under this change, not a contract change to inventory/docs specs)

## Impact

- **Code:** New small module to load/serve skill files (analogous to docs corpus); registration in `src/server.ts`; optional server `instructions`; package metadata so `skills/` ships with the binary package.
- **Repo layout:** New top-level `skills/drive-after-effects/` (Agent Skills format). Content seeded from the existing contributor skill text, then owned only under `skills/`.
- **Docs:** `README.md` end-user section; `ARCHITECTURE.md` notes the skills layer alongside docs resources.
- **Contracts:** New public MCP resources (`skill://drive-after-effects/...`, `skill://index.json`); no breaking changes to existing `ae_*` tools or `ae://docs/...`.
- **Non-impact:** AgentSync config, `.ai/src/skills/*`, OpenSpec contributor skills — untouched.
