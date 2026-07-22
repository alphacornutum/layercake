## Context

`set_text_style` already lists `allCaps` / `smallCaps` as writable booleans in Zod and shared ExtendScript helpers. Adobe’s Scripting Guide (AE 24+) marks those attributes **read-only**; the writable control is `TextDocument.fontCapsOption` (`FONT_NORMAL_CAPS` | `FONT_SMALL_CAPS` | `FONT_ALL_CAPS` | `FONT_ALL_SMALL_CAPS`). Direct boolean assignment is therefore incorrect on the supported host floor. Inspect/evidence already read the boolean projection — that path stays.

LayerCake historically assumed AE 22+ for `Layer.id` but never stated a product support floor. Examples still say AE 2025.

## Goals / Non-Goals

**Goals:**

- Reliable caps read + write through the existing boolean pair on AE 26+.
- Partial-bag merge for the coupled pair (omit key = preserve sibling).
- Document AE 26+ as supported; keep booleans as the only public surface.

**Non-Goals:**

- Exposing `fontCapsOption` on the MCP/JSON style bag.
- Runtime refuse when `app.version` &lt; 26.
- Title-casing / rewriting `style.text` for capitalization policy.
- Changing other style keys or CharacterRange targeting beyond existing `allStyleRuns`.

## Decisions

### 1. Public booleans only; write via enum

Agents and Audit keep `{ allCaps?, smallCaps? }`. Apply never assigns the read-only booleans on AE 24+; it sets `fontCapsOption` after encoding.

**Rejected:** Dual public keys (`fontCapsOption` + booleans) — two ways to say the same thing and partial-bag conflicts.

### 2. Merge omitted sibling, then encode

| allCaps | smallCaps | fontCapsOption |
| --- | --- | --- |
| false | false | `FONT_NORMAL_CAPS` |
| true | false | `FONT_ALL_CAPS` |
| false | true | `FONT_SMALL_CAPS` |
| true | true | `FONT_ALL_SMALL_CAPS` (LayerCake projection — AE raw booleans both stay false) |

When only one key is supplied, read current authored booleans, overlay supplied keys, write the enum. Callers enforcing a definite mode SHOULD send both keys (same discipline as `leading` + `autoLeading`).

**Rejected:** Mutual exclusion (setting one true clears the other) — breaks omit=preserve. **Rejected:** Require-both — safer but noisier; merge + docs is enough.

### 3. Read path unchanged

Continue projecting `doc.allCaps` / `doc.smallCaps` into style snapshots. Post-condition compares supplied boolean keys against authored after-state.

### 4. `allStyleRuns`

Treat caps like other character keys: when `allStyleRuns` is true, prefer writing `fontCapsOption` on the full-range `CharacterRange` when available, else the document (same pattern as other char attrs). Host smoke validates.

### 5. Supported floor AE 26+ (docs only)

README badge + Requirements note; setup/env examples use After Effects 2026. No version gate in code. Caps API exists since 24; 26+ is the product support statement (“older may work”).

## Risks / Trade-offs

- **[Risk]** `CharacterRange.fontCapsOption` missing or different → Mitigation: fall back to document write; host smoke; clear apply error if both fail.
- **[Risk]** Merge yields `ALL_SMALL_CAPS` when caller only meant to flip `allCaps` → Mitigation: document; Audit sends both keys.
- **[Risk]** Pre-26 hosts break on caps writes → Mitigation: documented unsupported; other ops may still work.
- **[Trade-off]** No runtime version check keeps host path simple at the cost of softer failure on old AE.

## Migration Plan

Additive behavior fix for an already-documented allowlist key. No schema migration. Update operator docs in the same change.

## Open Questions

None — product decisions locked in explore (booleans only, merge, AE 26+ docs floor).

### 6. Project caps booleans from `fontCapsOption` when readable

Adobe's `allCaps`/`smallCaps` stay `false`/`false` under `FONT_ALL_SMALL_CAPS`. Inspect/evidence/post-condition MUST derive the boolean pair from `fontCapsOption` when present so `(true,true)` round-trips; fall back to raw booleans only when the enum is unavailable.
