---
description: "High-risk surfaces that need explicit contract care before editing"
alwaysApply: true
---

# Safe Changes Rules

## Treat as contracts

- Public MCP tools in `src/server.ts` (`ae_*` names, descriptions, Zod schemas, JSON result shapes).
- `AeHost` in `src/host/types.ts` and the eval result file protocol in `script-wrapper.ts`.
- Inventory JSON field names consumed by agents (`id`, `source.id`, `missing`, folder tree shape).
- Environment variables documented in `.env.example` / `README.md`.
- Root `ARCHITECTURE.md` (layers, dependency direction, capability map, design constraints).
- ADRs under `docs/adr/` once accepted — prefer a superseding ADR over silently rewriting history.

## Required behaviors when touching contracts

- Prefer additive fields and new tools over renaming or removing existing keys.
- Update `openspec/specs/` (via an OpenSpec change) when host, eval, docs, or inventory requirements change.
- Update `README.md` MCP tool tables and warnings when the agent-facing surface changes.
- Update `ARCHITECTURE.md` when module boundaries, MCP surface, host protocol, or capability ownership change (required on OpenSpec sync/archive).
- When landing a surprising or hard-to-reverse design choice, add `docs/adr/NNNN-*.md` and keep inbound links valid (see `docs-adr` rule).

## Sensitive / generated

- Leave `.env` untracked; change templates via `.env.example`.
- Regenerate guide markdown with `npm run docs:fetch`; preserve `vendor/.../ATTRIBUTION.md`.
- Edit `.ai/src/` then `agentsync sync` — leave generated `.cursor/` / `.claude/` outputs alone.
