# Optional names on typed create ops

Typed `ae_patch_project` **create** operations treat `name` as optional. Omit → keep After Effects’ (or the host API’s) default name for that create path. When an AE API requires a name argument, LayerCake may pass a short conventional placeholder the host uniquifies (documented per op; e.g. `"Solid"`, `"Untitled Folder"`) rather than inventing uniqueness schemes. When `name` is supplied, set that opaque string after create with no normalization. Evidence always returns the final `name` and new id(s). Later renames stay on `rename_layer` / `rename_project_item`.

## Status

accepted

## Considered options

- **Always require `name`** — Rejected; fights AE defaults for text layers and forces agents to invent names for throwaway creates.
- **LayerCake-generated unique names** (`Solid_a1b2…`) — Rejected; surprising vs AE panel behavior; evidence already returns the real name.

## Consequences

- Applies to `create_folder`, `create_solid`, `create_text`, and future `create_*` ops.
- Explicit names remain useful for panel structure; omit is allowed, not preferred for folders agents must find by name later.
- See [docs/mcp-tools.md](../mcp-tools.md) for per-op placeholders.
