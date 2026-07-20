## Why

Agents auditing and normalizing After Effects projects still fall back to `ae_eval_script` for routine control-plane work: prove Solid vs Comp sources, reorder layers, replace sources, set frame-exact timing and expressions, reset layer surfaces, delete layers, and delete unused footage without AE’s permissive recursive/in-use defaults. Those operations are generic AE physics, not template policy — they belong as typed, guarded LayerCake primitives so domain skills can compose safely without inventing Cover/Contain or `main`/`config` rules inside the MCP.

## What Changes

- **Richer `ae_list_comps` layer rows**: add switches, parent/matte ids, startTime, time-remap flag, integer-frame timing alongside existing seconds, and clearer source-kind evidence so agents can prove top-of-stack order and Solid-sourced control layers without deep inspect.
- **Authored vs evaluated samples on `ae_get_layer`**: for selected transform (and similarly expression-driven) properties, expose dual evidence — authored/pre-expression vs evaluated/post-expression — so agents do not treat post-expression Scale as authored wrapper state (same contract family as `set_text_style` fonts).
- **New read-only item-reference inventory** (`ae_get_item_refs` or equivalent): return known inbound references for a project item (layers/comps via `usedIn`, proxy relationships, parent/matte links discovered by scan) plus an `unknownRefsPossible` / incomplete flag when expression or other reference classes were not fully resolved — facts only; no `deletionCandidate` policy bit.
- **Extend `ae_patch_project` vocabulary** with generic typed ops (stable ids; path+fingerprint; undo group; no implicit save; post-condition evidence; `already_satisfied` where applicable):
  - `rename_project_item` — rename CompItem / FootageItem / FolderItem by `Item.id`
  - `set_layer_index` — reorder one layer by stable comp/layer ids
  - `create_solid` — always create a new Solid FootageItem (explicit name, dimensions, pixel aspect, color); no silent reuse
  - `replace_layer_source` — replace AVLayer source; preserve `Layer.id` when AE permits; otherwise recreate layer, return new id, delete old atomically within the op
  - `set_layer_timing` — set start/in/out/stretch/time-remap using **integer frames** when the containing comp frame rate is known (refuse ambiguous raw-seconds-only payloads that ignore fps)
  - `set_property_expression` — set or clear expression body + enabled on a PropertyBase identified by exactly one of `matchNames[]` or nexrender-style `propertyPath` (`.` / `->`)
  - `reset_layer_surface` — remove keyframes, effects, masks, layer styles, markers, track matte, parenting, and caller-listed disallowed switches; reset authored transform defaults where specified
  - `delete_layer` — delete one timeline layer by stable ids
  - `safe_delete_project_item` — delete FootageItems/folders only when inbound-ref check passes; folders must be empty (non-recursive); refuse root; keep existing permissive `delete_project_item` unchanged
- **Docs + product skill**: document new inventory fields, dual sampling, ref inspect, and patch ops; prefer typed ops over eval for these flows; keep template policy (Cover/Contain bodies, protected `{music}` names, render-backed trim) out of LayerCake.
- **Out of scope (explicit)**: plan/preview tokens; render-backed contribution sampling; mega `normalize_visual_wrapper`; Cover/Contain classifiers; reachability-as-policy rooted at `main`/`config`; tightening or removing permissive `delete_project_item`.

## Capabilities

### New Capabilities

- `ae-item-references`: Read-only inbound-reference inspect for a project item so agents and `safe_delete_project_item` share the same fact model (known refs + incompleteness flag).

### Modified Capabilities

- `ae-comp-layer-inventory`: Expand layer attribute coverage (switches, parent/matte, start/time-remap, frame timing, source-kind clarity) without bloating into full property trees.
- `ae-layer-inspect`: Dual authored/evaluated value evidence for expression-capable properties (at least Transform Scale and related transforms used in wrapper audits).
- `ae-project-patch`: Add the new typed ops listed above; keep apply-only + fingerprint guards; do not add plan tokens; leave `delete_project_item` permissive.
- `ae-product-skill`: Guide agents to use the new inventory/refs/patch primitives for control-plane work; keep domain purity/expression corpora in agent skills.

## Impact

- Code: `src/inventory/` (list-comps serialize/parse/types; get-layer inspect samples; new item-refs script/tool), `src/patch/` (schema, apply-script, types, tests), `src/server.ts` registrations/descriptions.
- Docs: `docs/mcp-tools.md`, `ARCHITECTURE.md` capability map, `skills/drive-after-effects/SKILL.md` (+ `.ai/src` mirror via AgentSync).
- Tests: unit coverage for schemas/parse/apply planning; host e2e (`test:ae`) for new mutators when AE is available.
- No host-bridge protocol change; no implicit save; no Linux transport; no render pipeline.
