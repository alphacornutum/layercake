## Context

LayerCake already exposes slice inventories (`ae_list_comps`, `ae_list_sources`, `ae_list_folders`) and deep `ae_get_*` inspect tools. After `ae_open_project`, agents still lack a single project-level passport for orientation and portability: counts, third-party effect usage, missing footage, missing/substituted fonts. Effect classification cannot use a naive `ADBE*` prefix — bundled stock effects also use `CC`/`CS`, `EXtractoR`, `Keylight`, `CINEMA 4D Effect`, etc. The vendored Scripting Guide already maintains `matchnames/effects/firstparty.md`.

```
ae_host_status / ae_open_project
        │
        ▼
ae_project_summary   ← NEW (passport)
        │
        ├── ae_list_comps / sources / folders
        ├── ae_get_layer / ae_get_source
        └── ae_eval_script
```

## Goals / Non-Goals

**Goals:**

- Read-only MCP tool `ae_project_summary` returning compact JSON for the open project.
- Identity (name, file path when available, AE `app.version`).
- Orientation counts (comps, footage items, folders, layers).
- Effect dependency audit: unique effects used across all compositions, with `origin` (`firstParty` | `thirdParty`), `available` (present in `app.effects`), instance counts, and boolean `hasThirdPartyEffects`.
- Missing-footage rollup (count + compact id/name/path entries).
- Missing/substituted fonts when the Fonts API is available.
- A few cheap project settings for orientation (bits per channel, time display type).
- First-party classification via allowlist built from the vendored first-party matchName corpus.
- Product skill + operator docs updated so agents call this early when health/portability matters.

**Non-Goals:**

- Per-layer effect dumps or enriching `ae_list_comps` with effect lists / third-party booleans.
- Listing every installed plugin on the machine (only effects **used in the project**, plus availability against `app.effects`).
- ScriptUI panels, CEP/UXP extensions, animation presets, or expression-module deps.
- Mutating the project or auto-replacing missing fonts/footage.
- Perfect historical allowlist for every AE version ever shipped (track current guide corpus; regenerate with docs fetch).
- Silent truncation of large effect lists (keep unique-by-matchName; omit per-instance layer dumps by default — optional thin usage refs only if cheap).

## Decisions

### 1. One project tool, not flags on list tools

**Choice:** New `ae_project_summary` instead of adding `hasThirdPartyEffects` to `ae_list_comps`.

**Why:** Different cost profile (full Effect Parade walk), different agent question (“passport” vs “structure”), keeps list payloads lean.

**Alternatives considered:** Boolean-only on comps inventory — cheap to ask, expensive to answer without listing which plugins; forces every comps call to pay for the walk.

### 2. Broad passport shape (v1)

**Choice:** Single JSON object with sections:

| Section  | Contents                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| Identity | `projectName`, `projectPath` (null if unsaved), `aeVersion`                                 |
| Counts   | `numComps`, `numFootage`, `numFolders`, `numLayers`                                         |
| Settings | `bitsPerChannel`, `timeDisplayType` (stringified enum name or numeric + documented mapping) |
| Effects  | `hasThirdPartyEffects`, `effects[]` unique by `matchName`                                   |
| Footage  | `missingFootageCount`, `missingFootage[]` compact refs                                      |
| Fonts    | `fontsApiAvailable`, `missingOrSubstitutedFonts[]`                                          |

Each effect entry: `matchName`, `displayName` (best-effort from first instance or `app.effects`), `origin`, `available`, `instanceCount`. Usage locations (layer ids) are **out of default payload** to control size; agents that need them use inspect/eval.

**Why:** Matches “broad” product ask without becoming a full project dump.

**Alternatives considered:** Deps-only tool — narrower; mega-dump of every layer×effect — too large for MCP context.

### 3. First-party allowlist from vendored guide

**Choice:** Maintain a generated allowlist of first-party effect `matchName` strings extracted from `vendor/after-effects-scripting-guide/docs/matchnames/effects/firstparty.md`. Classification in TypeScript after the ExtendScript walk returns raw matchNames (or classify in script with injected set — prefer **TS-side classify** so unit tests don’t need AE).

Pipeline:

1. `npm run docs:fetch` (or a dedicated step in that script / `docs:allowlist`) regenerates `src/inventory/first-party-effect-match-names.json` (or `.ts` const).
2. Summary tool loads the set; any used effect whose matchName is not in the set → `origin: "thirdParty"`.
3. `available`: matchName present in `app.effects` (built once per call).

**Why:** Authoritative for “ships with AE” better than prefix heuristics; corpus already vendored (ADR 0001).

**Alternatives considered:** Prefix regex (Fendra-style) — fragile false positives/negatives. Classify only via `app.effects` category — does not define first-party; only “installed here.”

### 4. ExtendScript collects; TypeScript classifies and shapes

**Choice:** Fixed inventory script walks all comps → layers → `ADBE Effect Parade`, aggregates unique matchNames + counts, collects missing footage and fonts, returns raw JSON. Node parses, applies allowlist + `available` already computed in script (script can build `app.effects` set for availability; allowlist stays in Node).

**Availability in script vs Node:** Compute `available` in ExtendScript (has live `app.effects`). Compute `origin` in Node (has allowlist file).

**Why:** Matches existing inventory pattern; allowlist testable without host.

### 5. Fonts API soft-fail

**Choice:** If `app.fonts` / `missingOrSubstitutedFonts` throws or is missing (older AE), return `fontsApiAvailable: false` and empty font list — do not fail the whole summary.

**Why:** Fonts APIs are newer (24.x era); LayerCake’s realistic floor is AE 22+ for `Layer.id`, but font APIs may still be absent.

### 6. Skill workflow update

**Choice:** Add an optional early step after open: call `ae_project_summary` when the agent needs health/portability context (third-party plugins, missing media/fonts), then proceed to `ae_list_*` as today.

**Why:** Avoids forcing the summary on every trivial rename; teaches agents when the passport matters.

## Risks / Trade-offs

- **[Risk] Allowlist drifts when Adobe adds stock effects** → Mitigation: regenerate from guide on `docs:fetch`; document that unknown stock effects may briefly classify as third-party until corpus updates.
- **[Risk] Full project Effect Parade walk is slow on huge projects** → Mitigation: unique aggregation only; no property trees; consider documenting cost; future optional `includeUsage: false` already default.
- **[Risk] Renamed effect display names confuse agents** → Mitigation: always key on `matchName`; `displayName` is informational.
- **[Risk] Missing effects still present in parade with odd names** → Mitigation: `available: false` when not in `app.effects`; still count toward third-party if not on allowlist.
- **[Risk] ADR vs OpenSpec** → Allowlist generation from vendored markdown is a mild packaging choice; only add ADR if we invent a surprising durable strategy beyond “extract from already-vendored guide.”

## Migration Plan

- Additive tool only; no changes to existing tool schemas.
- Update `docs/mcp-tools.md`, README brief mention, product skill, `ARCHITECTURE.md` on sync/archive.
- Commit generated allowlist so clones work without re-fetch (same spirit as expecting docs corpus present for docs tools — if corpus missing, summary still runs but third-party classification may treat all non-empty allowlist-misses as third-party; if allowlist file missing, fail classification with clear error or treat unknown as thirdParty with `allowlistLoaded: false` — prefer **ship committed JSON** so default installs work).

## Open Questions

- None blocking: layer usage ids deferred; settings set kept minimal (`bitsPerChannel`, `timeDisplayType`).
