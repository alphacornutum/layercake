## Context

The root README is the GitHub / package “Aushängeschild.” Today it mixes product pitch, full MCP JSON, tool tables, troubleshooting, contributor caveats, and rename history. Chatty’s draft sets a better user tone; this change adopts that direction, shortens the landing page, and moves reference depth into linked `docs/` pages. Windows 11 UTM smoke is done — document Windows as available.

Existing OpenSpec requirements still apply: macOS + Windows host control, mutations via `ae_eval_script` until dedicated write tools exist, and skill install via filesystem + `skill://` (`ae-product-skill`). Those facts stay visible on the README (can be brief).

## Goals / Non-Goals

**Goals:**

- README = overview + appetizer + easy quickstart for non-technical and lightly technical users
- Deeper operator detail in `docs/*.md`, always linked from the README
- Tone: Chatty-inspired, more concise; optional 1–2 emoji LayerCake mark for charm
- State Windows host support without a pending-verification caveat
- Preserve contractual README facts (platforms, mutation path, skill channels)

**Non-Goals:**

- Changing MCP tools, host bridges, skill content, or env var behavior
- Rewriting `CONTRIBUTING.md` / `ARCHITECTURE.md` (link only)
- Emoji spam, badge walls, or marketing-site redesign
- Documenting former names or private repo history
- Duplicating full reference tables in both README and `docs/`

## Decisions

1. **README vs `docs/` split** — Root README is the showcase and quickstart. Reference depth lives under `docs/` and is linked. Rejected: one mega-README with everything Chatty listed; rejected: separate USER.md at repo root (extra landing confusion).

2. **Doc page ownership**

   | Path                      | Owns                                                                                                                                               |
   | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `README.md`               | What / why / example prompts / short capabilities / requirements / minimal quickstart / short verify & safety / brief tools+skill pointers / links |
   | `docs/setup.md`           | Full install variants, env/executable config, MCP client JSON (built + `tsx`), absolute-path notes, verify checklist, `test:ae`, fuller safety     |
   | `docs/mcp-tools.md`       | Full `ae_*` table, Layer vs Item ids, skill filesystem + `skill://` detail                                                                         |
   | `docs/troubleshooting.md` | Symptom guide, env vars table, limitations                                                                                                         |
   | `docs/scripting-guide.md` | `docs:fetch`, attribution, ADR link                                                                                                                |

3. **What stays on the README (even briefly)** — Platforms (macOS/Windows); mutation via `ae_eval_script` / no dedicated write tools yet; one MCP config sketch per OS (or “see setup” with enough to succeed); skill mentioned both ways; safety one-liner + link; Win11 smoke as one clause, not a section.

4. **Tone + emoji** — Outcome-first prose and a few example prompts. A single emoji or a two-emoji combination for LayerCake branding is allowed (e.g. near the title). No emoji clusters, no emoji in every heading.

5. **Identity: current only** — `layercake` where operators need it (MCP key, package). No “formerly …” block.

6. **Windows status** — One short note (Win11 VM / UTM smoke). Drop “hardware-unverified” and the dedicated Windows VM smoke checklist from the landing README (checklist detail can live in `docs/setup.md` if useful).

7. **Specs approach** — Delta on `product-identity` for audience, docs split, no-history, Windows-available, optional emoji. Do not change `ae-product-skill` requirements; README still documents both skill channels (brief + link to `docs/mcp-tools.md` is fine).

## Risks / Trade-offs

- **[Risk] Quickstart too thin to connect** → README keeps a minimal working path; full JSON variants in `docs/setup.md`.
- **[Risk] Contractual facts only in `docs/`** → Specs require platforms, mutation path, and skill channels on the README itself.
- **[Risk] Doc sprawl** → Cap at the four pages above unless content clearly needs a fifth (`docs/safety.md` only if safety outgrows a section in setup).
- **[Trade-off] Emoji taste varies** → Cap at one mark (1–2 emoji); easy to remove later.

## Migration Plan

1. Add `docs/setup.md`, `docs/mcp-tools.md`, `docs/troubleshooting.md`, `docs/scripting-guide.md`.
2. Rewrite `README.md` as showcase + quickstart with links into those pages.
3. Confirm OpenSpec README scenarios by inspection (product-identity + ae-product-skill).
4. Rollback = restore previous README / remove new docs files from git.

## Open Questions

None blocking. Optional later: npm package README vs GitHub README if publish layout diverges (out of scope here).
