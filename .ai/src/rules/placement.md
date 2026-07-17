---
description: "Where new files go and when to extract shared inventory helpers"
alwaysApply: true
---

# Placement Rules

## Default locations

| Kind                        | Location                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| MCP tool registration       | `src/server.ts`                                                                                        |
| Host bridge / wrap protocol | `src/host/`                                                                                            |
| Inventory tool              | `src/inventory/` — `list-<name>.ts`, `list-<name>-script.ts`, types in `types.ts`, parse in `parse.js` |
| Shared ExtendScript helpers | `src/inventory/shared-script.ts` when two+ inventory scripts need the same helper                      |
| Docs corpus/search          | `src/docs/`                                                                                            |
| Unit / AE tests             | `tests/*.test.ts` / `tests/*.ae.test.ts`                                                               |
| Doc fetch script            | `scripts/fetch-docs.mjs`                                                                               |
| Behavior specs              | `openspec/specs/<capability>/spec.md`                                                                  |
| System architecture map     | Root `ARCHITECTURE.md` (update on OpenSpec sync/archive)                                               |
| Agent guidance              | `.ai/src/` only                                                                                        |

## Extract vs edit in place

- Edit in place when the change is local to one tool’s script or parser.
- Move helpers into `shared-script.ts` when the same ExtendScript function appears in a second inventory script.
- Add a new `src/` top-level package only for a new subsystem (do not invent `src/utils/` for one helper).

## Naming

- MCP tools: `ae_<verb>_<noun>` (`ae_list_comps`, `ae_eval_script`).
- Keep public tool names stable; rename only with an intentional contract change.
