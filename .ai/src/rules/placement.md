---
description: "Where new files go and when to extract shared inventory helpers"
alwaysApply: true
---

# Placement Rules

## Default locations

| Kind                          | Location                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| MCP tool registration         | `src/server.ts`                                                                                                             |
| Host bridge / wrap protocol   | `src/host/`                                                                                                                 |
| Inventory tool                | `src/inventory/` — `list-<name>.ts`, `list-<name>-script.ts`, types in `types.ts`, parse in `parse.js`                      |
| Shared ExtendScript helpers   | `src/inventory/shared-script.ts` when two+ inventory scripts need the same helper                                           |
| Shared id\|name resolve       | `src/inventory/resolve-script.ts` (inspect + patch; callers define `resolveFail`)                                           |
| Shared layer id\|name Zod     | `src/inventory/layer-target-schema.ts` (`compTargetSchema` / `layerTargetSchema` / `getLayerInputSchema`; patch re-exports) |
| Comp switch key allowlist     | `src/inventory/comp-switches.ts` (`COMP_SWITCH_KEYS`; drives Zod, parse, ExtendScript `compSwitchKeys`)                     |
| Typed patch ops               | `src/patch/` (`schema.ts`, `apply-script.ts`, `types.ts`)                                                                   |
| Docs corpus/search            | `src/docs/`                                                                                                                 |
| Unit / AE tests               | `tests/*.test.ts` / `tests/*.ae.test.ts`                                                                                    |
| Doc fetch script              | `scripts/fetch-docs.mjs`                                                                                                    |
| Behavior specs                | `openspec/specs/<capability>/spec.md`                                                                                       |
| System architecture map       | Root `ARCHITECTURE.md` (update on OpenSpec sync/archive)                                                                    |
| Architecture Decision Records | `docs/adr/NNNN-slug.md` (see `docs-adr` rule)                                                                               |
| Agent guidance                | `.ai/src/` only                                                                                                             |

## Extract vs edit in place

- Edit in place when the change is local to one tool’s script or parser.
- Move helpers into `shared-script.ts` when the same ExtendScript function appears in a second inventory script.
- Add a new `src/` top-level package only for a new subsystem (do not invent `src/utils/` for one helper).

## Naming

- MCP tools: `ae_<verb>_<noun>` (`ae_list_comps`, `ae_eval_script`).
- Keep public tool names stable; rename only with an intentional contract change.
- New `ae_patch_project` ops: prefer semantic domain verbs (`rename_layer`, `move_project_item`) over bland `get`/`set` when a clear verb exists; use op-specific field names (`layerName`, `style.font`) — no shared `value` bag. Existing op names (`set_text_style`) stay.
- Large or heterogeneous partial mutators: nest writes under an op-specific bag (`settings`, `switches`, `style`); omit key = preserve. Comps-only ops use nested `target` (`compId` XOR `compName`). Small flat sets (e.g. `set_layer_timing` frames) may stay flat. See ADR 0004.
