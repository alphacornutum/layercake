## Why

Agents currently must hand-roll ExtendScript via `ae_eval_script` to discover compositions and layers. That is slow, error-prone, and forces every caller to reinvent the same inventory shape. A dedicated read-only inventory tool gives agents a reliable JSON map of comps/layers—including stable IDs they can reuse in later scripts—without inventing DOM traversal each time.

## What Changes

- Add an MCP tool that returns composition + layer inventory as structured JSON (all comps, or a filtered subset).
- Per layer, expose: type, in/out points, duration, stretch, motion blur, UI label color, whether effects exist, current stack index, name, and a **stable layer id** suitable for later lookup.
- Per composition, expose identity fields (stable item id, name, duration, frame rate, layer count) so agents can target comps the same way.
- Document how agents resolve a returned layer id back into a `Layer` object (via ExtendScript using AE’s native `Layer.id`, not an MCP-side cache).
- Note: timeline “folded/twirled” state is **not** available in the After Effects scripting API; that field is out of scope unless Adobe exposes it later.

## Capabilities

### New Capabilities

- `ae-comp-layer-inventory`: Read-only MCP tool(s) that inventory compositions and their layers as agent-friendly JSON, using After Effects’ persistent `Layer.id` / `Item.id` as stable handles.

### Modified Capabilities

- _(none — additive tool surface on the existing host/eval bridge)_

## Impact

- New MCP tool registration and ExtendScript inventory script in the TypeScript MCP server.
- Depends on After Effects ≥ 22 for `Layer.id` (already the realistic floor for this product).
- No changes to docs tools; inventory is project-state, not documentation.
- Future layer-targeted tools SHOULD accept the same stable ids this inventory returns.
