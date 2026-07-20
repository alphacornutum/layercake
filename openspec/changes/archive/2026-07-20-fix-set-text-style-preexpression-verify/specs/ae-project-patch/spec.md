## ADDED Requirements

### Requirement: Pre-expression TextDocument for set_text_style fonts

`set_text_style` MUST read, mutate, and post-condition-verify fonts against the authored / pre-expression `TextDocument` for each target’s Source Text property. When the property can vary over time or has a non-empty expression, apply MUST obtain that document via `valueAtTime` with the pre-expression flag set to true (composition time), not via post-expression `Property.value` alone. An active expression that still evaluates to a different on-screen font MUST NOT alone cause post-condition failure when the authored fonts match the requested `style.font`.

#### Scenario: Expression consumer succeeds on authored font match

- **WHEN** `set_text_style` writes the requested font on a text layer whose Source Text expression still evaluates to a different PostScript font
- **THEN** apply MUST report `changed` (or `already_satisfied` if authored fonts already matched) when the pre-expression post-read fonts match the request, and MUST NOT fail solely because the post-expression sample still shows the expression result

#### Scenario: set_text_style does not bake post-expression TextDocument

- **WHEN** `set_text_style` applies a font change on a layer with an active Source Text expression
- **THEN** apply MUST base the mutation on the pre-expression `TextDocument` and MUST NOT use post-expression `Property.value` as the sole read path for that write

### Requirement: Dual authored and evaluated font evidence for set_text_style

`set_text_style` per-target before/after evidence MUST include authored font lists under `fonts` (pre-expression `TextDocument`) when readable. When a post-expression sample is readable at composition time, evidence MUST also include `evaluatedFonts` on the same before/after object (post-expression fonts). Post-condition success MUST depend only on authored `fonts` matching the request, not on `evaluatedFonts`. Operator documentation MUST state that `fonts` is authored / pre-expression, `evaluatedFonts` is post-expression / on-screen when present, and that a mismatch after a successful change indicates an expression or other live override still driving appearance.

#### Scenario: Successful target includes both font lists when evaluated is readable

- **WHEN** a successful `set_text_style` target returns before/after evidence and the host can sample post-expression fonts
- **THEN** evidence MUST include `fonts` from the pre-expression document and `evaluatedFonts` from the post-expression sample on those before/after objects

#### Scenario: Evaluated mismatch does not fail authored success

- **WHEN** authored `after.fonts` match the requested font but `after.evaluatedFonts` still list a different font
- **THEN** that target MUST still report `changed` (or `already_satisfied` when authored already matched) and MUST NOT be reported as post-condition `failed` solely due to the evaluated mismatch

#### Scenario: Operator docs explain dual font evidence

- **WHEN** an operator reads `docs/mcp-tools.md` (or equivalent) for `ae_patch_project` / `set_text_style`
- **THEN** the docs MUST state that `fonts` is authored / pre-expression (post-condition), `evaluatedFonts` is post-expression when present, and that mismatch after success means patch expression sources (or expressions) for on-screen change

## MODIFIED Requirements

### Requirement: Authored project state for patch ops

`ae_patch_project` MUST mutate authored project/document state. Panel operations MUST select targets by stable `Item.id` (not by evaluating expressions) and MUST NOT read or write `Property.expression` as part of create, move, or delete. For `set_text_style`, apply MUST read and write the authored / pre-expression `TextDocument` (not post-expression `Property.value` when expressions or keyframes apply). Operator documentation for the tool MUST state this authored / pre-expression contract for the patch vocabulary (including `set_text_style` authored fonts and panel structure ops). Documentation MUST also note that deleting an item that owns layers removes those properties with the item, and that deleting in-use footage may leave expression strings intact while later evaluation fails.

#### Scenario: Move does not rewrite expressions

- **WHEN** `move_project_item` relocates a composition or footage item whose layers (or layers in other comps) have expression strings set
- **THEN** apply MUST change only project-panel placement (`parentFolder`) and MUST NOT modify those layers’ `Property.expression` strings as part of the move

#### Scenario: set_text_style does not bake post-expression TextDocument

- **WHEN** `set_text_style` applies a font change on a layer with an active Source Text expression
- **THEN** apply MUST base the mutation on the pre-expression `TextDocument` and MUST NOT use post-expression `Property.value` as the sole read path for that write
