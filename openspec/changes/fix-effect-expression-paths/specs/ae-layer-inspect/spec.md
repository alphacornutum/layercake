## MODIFIED Requirements

### Requirement: Agent-facing tool documentation

The MCP tool description for `ae_get_layer` MUST document depth tiers, that full expression text and keyframe timelines require `extended` or `full` (or selectors under those tiers), `atTime` / `preExpression` defaults, id-or-name lookup with ambiguity errors, the `unserializable` policy, and that over-limit results are hard errors (narrow with leaner `detail` / `matchNames`). The description MUST state that the returned property tree is hierarchical (each node has `name` and `matchName`) and is not a flat copy-paste path for `set_property_expression` — selectors for nested effect parameters MUST include intermediate effect instance segments between `ADBE Effect Parade` and the parameter matchName.

#### Scenario: Description mentions how to get expressions

- **WHEN** an agent reads the `ae_get_layer` tool description
- **THEN** it MUST be able to determine that `overview` does not return expression bodies and that `extended` or `full` does

#### Scenario: Description warns about effect path construction

- **WHEN** an agent reads the `ae_get_layer` tool description after this change ships
- **THEN** it MUST be able to determine that effect parameter selectors for patch need the effect instance segment, not only parade + parameter matchName
