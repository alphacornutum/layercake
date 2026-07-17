## Why

The root README currently reads like an engineering handover: dense jargon, rename history, and hardware-verification caveats aimed at contributors. New users — including people who are not deeply technical — need a clear “Aushängeschild”: what LayerCake is, what you can ask, and an easy quickstart — with deeper detail linked from `docs/`, not stuffed into the landing page.

## What Changes

- Rewrite root `README.md` as overview + appetizer + easy quickstart (user-facing tone, a bit more concise than Chatty’s draft)
- Move reference-depth content into linked pages under `docs/` (setup, MCP tools/ids/skill detail, troubleshooting, scripting-guide attribution)
- Drop project history and former names; keep only current identity (`layercake` / **LayerCake**)
- Reflect Windows 11 UTM smoke success: no “hardware-unverified” caveat; no standalone Windows VM smoke checklist in the README
- Allow a single emoji or a two-emoji combination as light LayerCake branding in the README (charming, not clutter)
- Keep OpenSpec-contractual facts visible in the README (platforms, mutation via `ae_eval_script`, skill filesystem + `skill://`), even if brief, with links for depth
- Point contributor depth at `CONTRIBUTING.md`, `ARCHITECTURE.md`, `docs/adr/`

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `product-identity`: Operator README is showcase/quickstart; deeper ops docs may live under linked `docs/*`; current identity only; Windows host support available; optional light emoji branding. Existing platform + mutation-scope MUST statements remain (brief OK).

## Impact

- `README.md` (primary rewrite — shorter landing page)
- New operator docs under `docs/` (e.g. `setup.md`, `mcp-tools.md`, `troubleshooting.md`, `scripting-guide.md`)
- `openspec/specs/product-identity/spec.md` (via delta, then sync/archive later)
- No MCP tool contracts, host bridges, or env var semantics change
- `ae-product-skill` skill-channel requirements remain satisfied in the README (brief + link OK)
- Contributors continue to use `CONTRIBUTING.md` / `ARCHITECTURE.md` / `docs/adr/` for engineering detail
