## Context

`set_text_style` today accepts only `style.font`, with `preserveUnspecified` / `allStyleRuns`, authored pre-expression writes, and dual `fonts` / `evaluatedFonts` evidence. `ae_get_layer` leaves `TEXT_DOCUMENT` values as `{ unserializable: true }`. Session guards remain `project.path` + `project.fingerprint` (ADR 0002); nested `style` bag matches ADR 0004; targeting and post-conditions follow ADR 0003.

## Goals / Non-Goals

**Goals:**

- Partial typed mutation of a curated TextDocument style allowlist via existing `set_text_style`.
- Dual authored / evaluated style evidence on patch targets; post-condition on authored supplied keys only.
- Readable style projection from Source Text in `ae_get_layer` (`extended` / `full`), with Transform-like dual samples when keys/expressions apply.
- Shared field vocabulary between patch `style` / evidence and inspect serialization so agents can plan → patch → verify without eval.

**Non-Goals:**

- Op-level expected-current / `if_match` bags (rejected project-wide; fingerprints only).
- Create-text-layer MCP tool.
- Per-paragraph / arbitrary CharacterRange index targeting (keep document-level + existing `allStyleRuns` for character attrs).
- Clearing, disabling, or rewriting Source Text expressions inside `set_text_style`.
- Every TextDocument attribute in AE 24+ (hyphenation, composer engine, box autofit policies, etc.) — defer to follow-ups.
- Baking evaluated TextDocument back into the project.

## Decisions

### 1. Extend `set_text_style` (not a sibling op)

Reuse selectors (`layers` / `comps` / `all_text_layers`), undo grouping, and pre-expression helpers. Rename later only if the verb becomes misleading; for now `style` bag is the right ADR 0004 home.

**Rejected:** `set_text_document` sibling — doubles vocabulary for the same selector/evidence machinery.

### 2. Curated `style` allowlist (v1)

Zod object: all keys optional; refine ≥1 key present; reject unknown keys.

| Key               | Type (JSON)    | Notes                                                                   |
| ----------------- | -------------- | ----------------------------------------------------------------------- |
| `font`            | string         | Existing; exact PostScript/font string                                  |
| `fontSize`        | number         |                                                                         |
| `fillColor`       | `[r,g,b]` 0..1 | Setting implies apply fill when AE requires                             |
| `applyFill`       | boolean        |                                                                         |
| `strokeColor`     | `[r,g,b]` 0..1 |                                                                         |
| `applyStroke`     | boolean        |                                                                         |
| `strokeWidth`     | number         |                                                                         |
| `tracking`        | number         |                                                                         |
| `baselineShift`   | number         |                                                                         |
| `fauxBold`        | boolean        |                                                                         |
| `fauxItalic`      | boolean        |                                                                         |
| `allCaps`         | boolean        |                                                                         |
| `smallCaps`       | boolean        |                                                                         |
| `horizontalScale` | number         |                                                                         |
| `verticalScale`   | number         |                                                                         |
| `autoLeading`     | boolean        | Document/paragraph-wide per AE docs                                     |
| `leading`         | number         | Fixed leading; AE may interact with `autoLeading` — spike in host tests |
| `justification`   | string enum    | Map to `ParagraphJustification.*` (left/center/right/… closed set)      |
| `text`            | string         | Layer content (still on TextDocument; omit = preserve)                  |
| `boxTextSize`     | `[w,h]`        | Only when `boxText`; refuse clearly on point text                       |
| `boxTextPos`      | `[x,y]`        | Same                                                                    |

**Read-only in evidence/inspect (not writable in `style`):** `boxText`, `pointText` booleans when readable.

**Deferred:** `autoKernType`, hyphenation, indents/spacing, `leadingType`, box autofit/alignment enums, `fontObject`, etc.

### 3. Apply semantics

- Read authored doc via existing `readAuthoredTextDocument`.
- For each supplied key, write on document (and character range 0..length when `allStyleRuns` and the attribute is character-scoped; document-level attrs like `autoLeading` / `justification` / `text` / box fields write on the document).
- `textProp.setValue(doc)`; re-read authored; compare supplied keys only.
- Idempotent → `already_satisfied`.
- Do not touch `expression` / `expressionEnabled`.

### 4. Evidence shape

Prefer additive generalization:

```json
{
  "before": {
    "style": {
      /* full readable allowlist snapshot + boxText/pointText */
    },
    "evaluatedStyle": {
      /* same keys when sample readable */
    }
  },
  "after": { "style": {}, "evaluatedStyle": {} }
}
```

Keep `fonts` / `evaluatedFonts` as derived convenience arrays from `style.font` runs **or** document that they remain for one release alongside `style` — prefer **keep both** in v1 for font-only callers (`fonts` still populated from run scan) to avoid a hard break.

Post-condition: every supplied `style` key matches authored `after.style` (with defined equality: colors within epsilon, justification enum normalize, etc.).

### 5. Inspect serialization

When sampling a `TEXT_DOCUMENT` property at `extended`/`full`:

- Instead of `unserializable`, emit a projected object: `{ textDocument: true, style: {…}, boxText?, pointText? }` (exact envelope decided in impl; must be documented).
- When property has keys or expression: also set `authoredValue` / `evaluatedValue` as the same projection (mirroring Transform dual-sample), and `value` under caller `preExpression`.
- `overview` stays lean (no value samples) — unchanged.

Shared ExtendScript helper (inventory or patch-shared) to project TextDocument → style object so patch evidence and inspect cannot drift.

### 6. Guards and skill

Fingerprint + path only. Skill: plan with `ae_get_layer` style projection → `set_text_style` partial bag → trust authored evidence; if evaluated differs, use `set_property_expression` separately.

## Risks / Trade-offs

- **[Risk] AE `leading` / `autoLeading` interaction docs look wrong** → Host spike before locking post-conditions; evidence always returns both fields after write.
- **[Risk] Mixed-run attributes → `undefined`** → Document; for `allStyleRuns` writes apply across range; reads may need run aggregation (font already does multi-font list — other scalars may report first-run or omit if mixed).
- **[Risk] Evidence schema growth / font-key duplication** → Keep `fonts` arrays + add `style` snapshot; document precedence (post-condition uses `style` for new keys, `fonts` remains for font list).
- **[Risk] Inspect payload size** → Projection is small vs dumping raw doc; still subject to existing byte limit.
- **[Risk] Justification enum surface** → Closed string set in Zod; refuse unknown.

## Migration Plan

- Ship additive schema + evidence; existing `style.font`-only payloads keep working.
- Docs/skill update in same change.
- No data migration; no fingerprint format change.

## Open Questions

- (resolved) Inspect envelope is `{ kind: "textDocument", style, boxText?, pointText? }`.
- (resolved in apply) `fillColor` / `strokeColor` writes rely on AE’s documented side effects for `applyFill` / `applyStroke`; after snapshot reflects live state.
- Host spike notes (docs + apply policy): Scripting Guide claims setting `leading` also sets `autoLeading` to `true` (and then `leading` reads as `0`). Apply refuses `leading` + `autoLeading: true`, forces `autoLeading = false` around the leading write (and re-asserts after), then post-conditions on authored supplied keys. Justification write rejects `MULTIPLE_JUSTIFICATIONS`. Box geometry keys refuse when `boxText` is false.
