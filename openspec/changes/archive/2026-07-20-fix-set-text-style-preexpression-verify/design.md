## Context

`ae_patch_project` `set_text_style` mutates `TextDocument` fonts and reports post-condition-verified before/after evidence. The capability already requires authored / pre-expression project state. Inventory (`ae_get_layer`) already samples with `valueAtTime(t, preExpression)` (default `true`). Apply currently uses `Source Text.value` for read/verify, which is post-expression — so expression-linked consumers fail post-condition while sources still paint the old font, and `setValue` of a post-expression document can bake evaluated content into authored state. Docs-only mitigation for “on-screen still wrong” is weak; agents need both values in the tool result.

## Goals / Non-Goals

**Goals:**

- Align `set_text_style` read → mutate → post-read with pre-expression `TextDocument`.
- Keep post-condition on authored fonts only.
- Return **both** authored and evaluated fonts in before/after evidence so agents can see expression override without a second inspect round-trip.
- Document how to interpret the dual evidence; skill guidance for source-first visual normalization.

**Non-Goals:**

- Disabling, rewriting, or inspecting `Property.expression` as part of patch.
- Failing the target when evaluated fonts differ from the request (no post-expression verification mode).
- Renaming existing `fonts` keys (additive `evaluatedFonts` only).
- New host fixtures or expression-font e2e (no suitable committed `.aep`).
- Changing other ops’ post-condition field semantics.

## Decisions

1. **Pre-expression read helper (mirror inspect gate)**  
   Introduce `readAuthoredTextDocument(textProp, comp)` in the apply ExtendScript: use `textProp.valueAtTime(comp.time, true)` when the property can vary over time or has a non-empty expression; otherwise `textProp.value`. Use that document for before, after mutation + `setValue`, after, and failure re-read.  
   _Alternatives considered:_ Always `valueAtTime(..., true)` (slightly heavier, fine but inspect already special-cases); temporarily clear `expressionEnabled` (rejected — mutates expression state and races AE).

2. **Post-condition stays font-string match on authored fonts**  
   `fontsAllMatch(after.fonts, requestedFont)` — an expression that still evaluates to another PostScript font MUST NOT alone fail the target when authored fonts match.

3. **Dual evidence: `fonts` + `evaluatedFonts`**  
   Evidence shape (additive):

   ```ts
   before?: { fonts: string[]; evaluatedFonts?: string[] };
   after?: { fonts: string[]; evaluatedFonts?: string[] };
   ```

   - `fonts` — authored / pre-expression (required for success paths when readable; post-condition source).
   - `evaluatedFonts` — post-expression sample at `comp.time` when readable (`valueAtTime(t, false)` or `.value` when no expression/keys). Include whenever readable (not only on mismatch) so agents have a stable field.

   Helpers: `readEvaluatedTextDocument(textProp, comp)` alongside the authored helper; both feed `readFonts`.  
   _Alternatives considered:_ Docs-only warning (rejected — agents miss residual override); separate top-level `afterEvaluated` (rejected — nesting under before/after keeps parity); rename `fonts` → `authoredFonts` (**BREAKING**, rejected).

4. **Docs / skill interpret the pair**  
   If `after.fonts` matches the request but `after.evaluatedFonts` does not, an expression (or other live override) is still driving on-screen style — patch sources next. No new tool args.

5. **OpenSpec deltas over silent bugfix**  
   Codify pre-expression post-condition + dual evidence so sync/archive keeps the contract explicit.

## Risks / Trade-offs

- **[Risk] Agents expect on-screen font change after patching only consumers** → Mitigation: return both `fonts` and `evaluatedFonts`; skill + mcp-tools tell agents to treat mismatch as “patch sources / expressions next.”
- **[Risk] Slightly larger evidence payloads** → Mitigation: same string arrays as today plus one optional list; still compact.
- **[Risk] `valueAtTime` throws on some AE builds/layers** → Mitigation: try/catch; omit `evaluatedFonts` when unreadable; keep unsupported/failed messaging when authored fonts are unreadable.
- **[Risk] Rollback/`dirty` confusion after prior false failures** → Mitigation: unchanged undo-on-`applyError` path; document checking `rollback.completed` when diagnosing dirty sessions.

## Migration Plan

Ship as a patch-behavior fix in one change: apply script + types + unit assert + docs/skill + agentsync. No project-file migration. Existing callers that only read `before.fonts` / `after.fonts` keep working; new `evaluatedFonts` is additive.
