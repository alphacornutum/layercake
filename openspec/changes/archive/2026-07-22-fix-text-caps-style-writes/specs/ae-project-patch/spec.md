## ADDED Requirements

### Requirement: Caps style writes via fontCapsOption

When `set_text_style` supplies `style.allCaps` and/or `style.smallCaps`, apply MUST write capitalization through After Effects `TextDocument.fontCapsOption` (or an equivalent CharacterRange write when `allStyleRuns` targets character scope), NOT by assigning the read-only `allCaps` / `smallCaps` boolean attributes as the primary write path on hosts where those attributes are read-only. The public style bag, inspect SourceText projection, and patch evidence MUST continue to use boolean `allCaps` / `smallCaps` only — `fontCapsOption` MUST NOT be accepted as a `style` key. When only one of the pair is supplied, apply MUST merge the omitted sibling from the current authored boolean state (omit key = preserve), then encode: `(false,false)` → `FONT_NORMAL_CAPS`, `(true,false)` → `FONT_ALL_CAPS`, `(false,true)` → `FONT_SMALL_CAPS`, `(true,true)` → `FONT_ALL_SMALL_CAPS`. Post-condition success for supplied caps keys MUST depend on authored after-state booleans matching the request (after merge), not on a public enum field. When `fontCapsOption` is readable, authored `allCaps`/`smallCaps` in evidence and post-condition MUST be projected from that enum so `FONT_ALL_SMALL_CAPS` appears as `(true, true)` (Adobe's raw booleans both stay false for that mode). Operator documentation MUST note the internal write path and that callers enforcing a definite caps mode SHOULD supply both booleans.

#### Scenario: allCaps write round-trips on authored evidence

- **WHEN** a `set_text_style` operation supplies `style.allCaps: true` and `style.smallCaps: false` on a text layer
- **THEN** apply MUST succeed with authored after `style.allCaps` true and `style.smallCaps` false (via `fontCapsOption` under the hood)

#### Scenario: Partial caps key preserves sibling

- **WHEN** authored state is all-caps off and small-caps on, and the operation supplies only `style.allCaps: true`
- **THEN** apply MUST preserve small-caps on (encode `FONT_ALL_SMALL_CAPS`) and MUST NOT clear the omitted sibling

#### Scenario: Normal caps clears both

- **WHEN** a `set_text_style` operation supplies `style.allCaps: false` and `style.smallCaps: false`
- **THEN** apply MUST leave authored after booleans both false

#### Scenario: fontCapsOption not a public style key

- **WHEN** `style` includes `fontCapsOption`
- **THEN** validation MUST reject the unknown key before mutation
