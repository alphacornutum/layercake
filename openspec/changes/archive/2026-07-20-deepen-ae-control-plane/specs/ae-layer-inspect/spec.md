## ADDED Requirements

### Requirement: Dual authored and evaluated transform samples

For `detail` values `extended` and `full`, when the property walk includes Transform properties that support `valueAtTime` (at least Scale; and Anchor Point, Position, Rotation/Orientation, and Opacity when included), the property node MUST expose dual samples when the property has an expression and/or keyframes: `authoredValue` from `valueAtTime(..., true)` (pre-expression) and `evaluatedValue` from `valueAtTime(..., false)` (post-expression) at the effective `atTime`. The existing `value` field MUST continue to reflect the caller’s `preExpression` flag (default `true`) so current clients remain valid. Operator documentation MUST state that authored/wrapper purity checks MUST use `authoredValue` (or `value` with `preExpression: true`), not post-expression samples alone.

#### Scenario: Scale with expression includes both samples

- **WHEN** `ae_get_layer` is called with `detail` `extended` or `full` and the layer’s Scale property has a non-empty expression
- **THEN** the Scale property node MUST include `authoredValue` and `evaluatedValue` at the effective `atTime`, and MUST still include `value` consistent with the request’s `preExpression`

#### Scenario: Default value remains pre-expression

- **WHEN** the caller omits `preExpression` (default true) with `extended` or `full`
- **THEN** `value` MUST match the pre-expression sample and MUST NOT silently switch to post-expression-only serialization

#### Scenario: Docs warn against treating evaluated as authored

- **WHEN** an operator reads `docs/mcp-tools.md` (or equivalent) for `ae_get_layer`
- **THEN** the docs MUST state that `authoredValue` is pre-expression authored state and `evaluatedValue` is post-expression, and that purity/normalization checks MUST not treat post-expression Scale as authored state
