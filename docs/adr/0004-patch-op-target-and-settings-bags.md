# Nested patch targets and op-specific settings bags

For `ae_patch_project` mutators with a large or heterogeneous partial allowlist, put writes under an op-specific nested bag (`settings`, `switches`, `style`) — omit key = preserve — rather than scattering optional fields on the op root or inventing a shared `value` bag. Comps-only patch ops use a nested `target` with exactly one of `compId` | `compName` (same ambiguity/candidate rules as the composition half of layer targets), not a bare top-level id. Small homogeneous sets may stay flat when that already matches an existing op (`set_layer_timing`’s few frame fields); do not “flatten for consistency” when a bag would make explicit supply clearer.

## Status

accepted

## Considered options

- **Flat scalars on the op** (like `set_layer_timing`) for all new settings — Rejected for large/mixed allowlists; “what was supplied” is harder to validate and extend.
- **Flat `compId` on comps-only ops** (like `rename_project_item.itemId`) — Rejected for new comps-only mutators; nested `target` matches inspect/layer-target parity. Existing item-id panel ops stay as they are.
- **Shared generic `value` bag** — Rejected; placement and ADR 0003 already prefer semantic verbs and op-specific field names.

## Consequences

- Prefer `target` + `settings` (or domain bag) for new composition-level and similarly broad partial mutators; see `set_comp_settings`.
- Layer-targeting ops remain under ADR 0003 (`layerTargetSchema`); this ADR covers comps-only targets and bag shape, not a second targeting system for layers.
- Inventory may mirror bag names where helpful (e.g. composition `switches` alongside patch `settings.switches`).
