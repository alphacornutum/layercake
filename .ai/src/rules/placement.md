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
| Inventory tool                | `src/inventory/` — `list-<name>.ts`, thin `list-<name>-script.ts` loaders, types in `types.ts`, parse in `parse.js`         |
| First-party ExtendScript      | `src/ae-scripts/entries/` + `src/ae-scripts/shared/`; emit via `npm run build:ae-scripts`                                   |
| Shared ExtendScript helpers   | `src/ae-scripts/shared/` when two+ entries need the same helper; helper-only entries use `loadAeHelperScript`               |
| Shared id\|name resolve       | `src/ae-scripts/shared/resolve.ts` (imported by inspect + patch entries)                                                    |
| Shared layer id\|name Zod     | `src/inventory/layer-target-schema.ts` (`compTargetSchema` / `layerTargetSchema` / `getLayerInputSchema`; patch re-exports) |
| Comp switch key allowlist     | `src/inventory/comp-switches.ts` (`COMP_SWITCH_KEYS`; keep in sync with `src/ae-scripts/shared/inventory.ts`)               |
| Typed patch ops               | `src/patch/` (`schema.ts`, `apply-script.ts` preamble + `patch-apply` entry, `types.ts`)                                    |
| Docs corpus/search            | `src/docs/`                                                                                                                 |
| Unit / AE tests               | `tests/*.test.ts` / `tests/*.ae.test.ts`                                                                                    |
| Doc fetch script              | `scripts/fetch-docs.mjs`                                                                                                    |
| Behavior specs                | `openspec/specs/<capability>/spec.md`                                                                                       |
| System architecture map       | Root `ARCHITECTURE.md` (update on OpenSpec sync/archive)                                                                    |
| Architecture Decision Records | `docs/adr/NNNN-slug.md` (see `docs-adr` rule)                                                                               |
| Agent guidance                | `.ai/src/` only                                                                                                             |

## Extract vs edit in place

- Edit in place when the change is local to one AE entry or its Node loader/parser.
- Move helpers into `src/ae-scripts/shared/` when the same ExtendScript function appears in a second entry.
- Add a new `src/` top-level package only for a new subsystem (do not invent `src/utils/` for one helper).

## Naming

- MCP tools: `ae_<verb>_<noun>` (`ae_list_comps`, `ae_eval_script`).
- Keep public tool names stable; rename only with an intentional contract change.
- New `ae_patch_project` ops: prefer semantic domain verbs (`rename_layer`, `move_project_item`) over bland `get`/`set` when a clear verb exists; use op-specific field names (`layerName`, `style.font`) — no shared `value` bag. Existing op names (`set_text_style`) stay.
- Large or heterogeneous partial mutators: nest writes under an op-specific bag (`settings`, `switches`, `style`); omit key = preserve. Comps-only ops use nested `target` (`compId` XOR `compName`). Small flat sets (e.g. `set_layer_timing` frames) may stay flat. See ADR 0004.
