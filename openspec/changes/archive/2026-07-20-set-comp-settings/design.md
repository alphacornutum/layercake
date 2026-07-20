## Context

Agents can set layer timing via typed `set_layer_timing` and batch it under one undo group, but composition settings (duration, work area, dims, rate, display start, round-trippable advanced flags) still require `ae_eval_script`. Wrapper normalization needs both halves of the same clock: change the comp, then adjust layer bounds, with atomic rollback if either fails.

`ae_list_comps` today exposes only `id`, `name`, `duration` (seconds), `frameRate`, `numLayers`, and layers — not enough to plan settings mutations without eval.

Session guards remain path + fingerprint (ADR 0002). Partial desired-state + post-condition evidence matches existing control-plane ops (no expected-current CAS bag).

## Goals / Non-Goals

**Goals:**

- Add `set_comp_settings` to `ae_patch_project` with nested comps-only `target` (`compId` XOR `compName`), nested partial `settings` bag, integer-frame evidence, post-conditions, `already_satisfied`.
- Closed allowlist for dims/PAR/fps, duration/display-start/work-area frames, renderer, and round-trippable composition switches.
- Work-area policy: clamp work area to new duration end when a duration write would leave it past the end; fail when the caller explicitly requests a work area past duration.
- Same-batch atomicity with `set_layer_timing` via existing validate-all + undo group; document caller order: settings before timing.
- Extend `ae_list_comps` composition objects with the same settings fields (filter via existing `compIds` / `compNames`).
- Update skill, operator docs, and `README.md` when the public surface is affected.

**Non-Goals:**

- No expected-current / compare-and-swap field bag.
- No new `ae_get_comp` tool in this change.
- No automatic rewrite of layer in/out when duration or frame rate changes (caller uses `set_layer_timing`).
- No bgColor, resolutionFactor, shutter samples, or other Advanced-tab fields beyond the allowlist.
- No implicit save; no mega-tool bundling patch + save.
- No change to `rename_project_item` (stays `itemId`); “comps-only id-or-name” applies to this op and future comps-only patch selectors, not a retrofit of every item-id op.

## Decisions

### 1. Op shape — nested `target` + nested partial `settings`

Align with layer ops (`target`) and bag-style mutators (`style` / `switches`): identity and mutation payload stay separate. All allowlisted writes live under `settings`; omit a key = preserve.

```json
{
  "op": "set_comp_settings",
  "target": { "compId": 42 },
  "settings": {
    "width": 1920,
    "height": 1080,
    "pixelAspect": 1,
    "frameRate": 30,
    "durationFrames": 450,
    "displayStartFrame": 0,
    "workAreaStartFrame": 0,
    "workAreaDurationFrames": 450,
    "renderer": "ADBE Advanced 3d",
    "switches": { "motionBlur": true }
  }
}
```

- `target`: shared Zod `compTargetSchema` — exactly one of `compId` | `compName` (resolve via existing `resolveComp`; ambiguous names → candidates).
- `settings`: strict partial bag; at least one allowlisted mutation field required (scalars and/or `switches` keys and/or `renderer`).
- `settings.switches`: optional nested boolean bag (same spirit as `set_layer_switches`; mirrors inventory composition `switches`).
- Integer frames for duration, display start, and work area; convert with the composition’s frame rate (after applying a `settings.frameRate` change in this op if supplied — see Decision 4).

**Alternatives:** Flat scalars on the op (like `set_layer_timing`) — rejected; allowlist is large and heterogeneous, so a nested bag keeps “explicitly supplied” clear (same rationale as `switches` / `style`). Flat `compId` on the op (like `rename_project_item.itemId`) — rejected for this op; nested `target` matches layer-targeting parity for comps-only selectors. Expected/desired CAS — rejected. Separate MCP tool — rejected; batch atomicity with timing requires the patch vocabulary. Generic shared `value` bag — rejected (placement rule). Persisted for future ops in [ADR 0004](../../../docs/adr/0004-patch-op-target-and-settings-bags.md).

### 2. Write allowlist (v1)

| Field (`settings.*`)                           | AE (approx.)                         | Notes                                                                                             |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `width`, `height`                              | `AVItem.width` / `height`            | Integers                                                                                          |
| `pixelAspect`                                  | `AVItem.pixelAspect`                 | Float; post-condition must account for AE PAR table quirks (compare re-read, not naive UI labels) |
| `frameRate`                                    | `AVItem.frameRate` / `frameDuration` | Prefer setting `frameRate`; verify via integer-frame helpers + re-read                            |
| `durationFrames`                               | `AVItem.duration`                    | Write seconds = frames / rate                                                                     |
| `displayStartFrame`                            | `CompItem.displayStartFrame`         | Integer R/W (AE 17.1+)                                                                            |
| `workAreaStartFrame`, `workAreaDurationFrames` | `workAreaStart` / `workAreaDuration` | Integer frames                                                                                    |
| `renderer`                                     | `CompItem.renderer`                  | Must be a member of live `comp.renderers` or fail                                                 |
| `switches.motionBlur`                          | `CompItem.motionBlur`                |                                                                                                   |
| `switches.frameBlending`                       | `CompItem.frameBlending`             |                                                                                                   |
| `switches.draft3d`                             | `CompItem.draft3d`                   |                                                                                                   |
| `switches.hideShyLayers`                       | `CompItem.hideShyLayers`             |                                                                                                   |
| `switches.dropFrame`                           | `CompItem.dropFrame`                 |                                                                                                   |
| `switches.preserveNestedResolution`            | `CompItem.preserveNestedResolution`  |                                                                                                   |

Unknown keys fail Zod. Inapplicable/unsupported host (e.g. old AE without `displayStartFrame`): fail that target with a clear message; do not silently skip.

Evidence `before` / `after`: full settings snapshot covering the allowlist (frame fields as integers; switches object; `renderer` when readable). Post-condition success depends only on caller-supplied keys.

### 3. Work-area clamp vs explicit overrun

Apply order inside the op (after resolve, before post-condition):

1. Read before snapshot.
2. If `settings.durationFrames` is supplied and the **merged** end (desired or preserved duration) would leave the current/preserved work area past that end → set work area end to the new duration end first (adjust duration and/or start of work area as needed so it fits).
3. Apply other supplied `settings` fields (dims, rate, display start, switches, renderer, explicit work-area fields).
4. If the caller supplied `settings.workAreaStartFrame` and/or `settings.workAreaDurationFrames` and the resulting work area would end past the resulting duration → **fail** (do not clamp caller-explicit overrun).
5. Post-condition re-read.

Duration-only shrink that would orphan the work area is the auto-clamp case. Explicit work-area-past-duration is the hard error.

### 4. Batch order with `set_layer_timing`

Do **not** reorder operations inside the apply script. Document in skill + `docs/mcp-tools.md`: when a batch changes composition settings (especially `frameRate`) and layer timing, put `set_comp_settings` **before** `set_layer_timing` ops so frame fields use the new rate. Mixing is allowed; wrong order is caller error (timing frames interpret against whatever rate is live when that op runs).

Atomicity remains the existing undo group + rollback report.

### 5. Inventory: extend `ae_list_comps`, no new tool

Add composition-level fields aligned with the allowlist:

- Keep existing `duration` (seconds) and `frameRate` for compatibility.
- Add `width`, `height`, `pixelAspect`, `durationFrames`, `displayStartFrame`, `workAreaStartFrame`, `workAreaDurationFrames`, `renderer`, and a `switches` object with the boolean allowlist keys.

Agents filter with existing `compIds` / `compNames`. No `ae_get_comp` in this change (scalars stay cheap vs layer trees).

### 6. Placement

- Zod: `src/patch/schema.ts` (+ shared `compTargetSchema` next to `layerTargetSchema` if extracted); `settings` + nested `switches` strict bags.
- Apply: `apply-control-plane-script.ts` helpers; dispatch from `apply-script.ts`.
- Inventory: `list-comps-script.ts`, `types.ts`, `parse.ts`, unit fixtures.
- Docs/skill: `docs/mcp-tools.md`, root `README.md` when the public surface is affected, `.ai/src/skills/drive-after-effects/SKILL.md` → `agentsync sync`.
- ADR: payload shape recorded in [ADR 0004](../../../docs/adr/0004-patch-op-target-and-settings-bags.md) (`target` + op-specific bags). PAR equality stays a docs/implement detail unless a host spike forces a further ADR.

### 7. Testing

- Unit: schema (`target` XOR, empty/unknown `settings`, empty `switches`); inventory parse of new fields; vocabulary membership.
- Host: fixture smoke — change duration/work area (and optionally restore via undo/close without save); optional batch with `set_layer_timing`.

## Risks / Trade-offs

- **[PAR / fps float drift]** → Post-condition on re-read values; document known AE PAR table; refuse claiming UI label equality.
- **[Caller puts timing before settings]** → Documented order rule; wrong order can mis-interpret frames — not auto-fixed.
- **[Duration shrink leaves layers past comp end]** → AE allows this; out of scope — agents fix with `set_layer_timing`.
- **[renderer string machine-dependent]** → Validate against live `comp.renderers`; inventory exposes current value + agents can discover members via eval if needed (listing `renderers` array on inventory is optional nice-to-have; include `renderer` string always, `renderers` array only if cheap).
- **[displayStartFrame AE version]** → Fail clearly on hosts that lack the attribute.

## Migration Plan

Additive only. Ship schema + apply + inventory + docs together. No caller migration.

## Open Questions

None blocking — resolve during implement if host spikes show clamp edge cases (zero-length work area, negative display start).
