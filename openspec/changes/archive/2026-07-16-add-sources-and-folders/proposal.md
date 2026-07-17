## Why

Agents can inventory comps and layers via `ae_list_comps`, but still cannot see what media a layer uses, what footage exists in the Project panel, or how the project is organized into folders—without hand-rolled ExtendScript. Exposing source handles (and folder placement) next to layer inventory closes that gap so agents can find, inspect, and later target the same project items reliably.

## What Changes

- Extend `ae_list_comps` so each layer that has an `AVLayer.source` includes a compact source reference (stable `Item.id`, name, kind, and folder placement). Layers without a source omit the field.
- Add a read-only MCP tool that lists all project **sources** (`FootageItem`s: file, solid, placeholder) with rich metadata and the same stable `Item.id` used elsewhere.
- Include folder location on every listed source (parent folder id + human-readable path).
- Add a separate read-only MCP tool that returns the Project panel **folder hierarchy** in a nested tree that is easy for agents to skim (folders + child item summaries).
- Document ExtendScript lookup patterns for source ids (same `Item.id` scan pattern as comps).

## Capabilities

### New Capabilities

- `ae-project-sources`: Read-only MCP tool that inventories project footage sources as agent-friendly JSON, using After Effects’ persistent `Item.id`, with metadata and folder placement.
- `ae-project-folders`: Read-only MCP tool that returns the Project panel folder tree (hierarchical JSON) so agents can understand organization without reconstructing it from flat item lists.

### Modified Capabilities

- `ae-comp-layer-inventory`: Layer inventory payloads MUST include a source reference for layers that have an `AVLayer.source`.

## Impact

- Extend the existing `ae_list_comps` ExtendScript / TypeScript inventory path.
- New MCP tool registrations and ExtendScript snippets for sources and folder tree.
- README / tool descriptions updated for the new fields and tools.
- No host-bridge changes; reuses the existing eval path.
- Compositions remain the domain of `ae_list_comps` (they may appear as layer `source` refs when used as precomps, but are not duplicated as “sources” in the footage inventory).
