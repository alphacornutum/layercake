---
description: "When and how to record Architecture Decision Records under docs/adr/"
alwaysApply: true
---

# Docs / ADR Rules

## Living docs

- `docs/adr/` holds Architecture Decision Records for LayerCake. This is a maintained practice, not a one-off folder for ADR 0001.
- Root `ARCHITECTURE.md` is the system map; ADRs record _why_ we chose a surprising or hard-to-reverse option. OpenSpec holds behavior contracts. Do not collapse these three into one place.

## When to add an ADR

Write a new ADR when **all** of the following are true:

1. **Hard to reverse** — changing course later is costly.
2. **Surprising without context** — a future reader would wonder why the code looks this way.
3. **Real trade-off** — alternatives were considered and rejected for specific reasons.

Skip ADRs for obvious, easily reversed, or OpenSpec-only contract tweaks. Prefer an OpenSpec change when the public MCP / host / inventory contract shifts; use an ADR for durable design choices (vendoring strategy, bridge shape, packaging of non-npm corpora, etc.).

## How to write

- Path: `docs/adr/NNNN-slug.md` (zero-padded sequence; scan `docs/adr/` for the next number).
- Keep it short: title + 1–3 sentence decision. Optional **Status**, **Considered options**, **Consequences** only when they add value.
- Create `docs/adr/` lazily if missing; do not invent parallel `docs/decisions/` trees.
- Link the ADR from the operator-facing place that would otherwise surprise (README, fetch script comment, etc.) when readers need the “why”.
- Do not leave broken ADR links. If you remove an ADR, update references the same change.

## Format reference

Shared ADR format guidance lives in the domain-modeling skill’s `ADR-FORMAT.md` (agent skill on this machine). Match that template’s spirit: record the decision and why, not a ceremony of empty sections.
