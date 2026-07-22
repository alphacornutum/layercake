## Why

Agents can detect point vs box text via `ae_get_layer` (`boxText` / `pointText`) and can restyle or resize box geometry with `set_text_style`, but cannot create text layers through the typed patch vocabulary. AE marks `TextDocument.boxText` / `pointText` as read-only, so “convert layout” is recreate-and-delete — without typed create, agents fall back to raw `ae_eval_script`. Existing create ops also force `name`, which fights AE’s default naming for new layers/items.

## What Changes

- Add `ae_patch_project` op `create_text`: create a horizontal point or box text layer in a composition (`layout: "point" | "box"`), with required `text`, required `boxTextSize` when box, optional `name`, and optional partial `style` bag (same allowlist / authored write semantics as `set_text_style`).
- Record ADR **0006** (next free number): for all typed **create** patch ops, `name` is optional — omit keeps AE/host default naming for that create path; when supplied, set the opaque string after create. Apply the softens to existing `create_solid` and `create_folder` (name becomes optional; not a hard break for callers that still pass `name`).
- Teach the drive-after-effects skill the point↔box “convert” recipe: inspect → `create_text` with the other layout → copy transform/timing/switches/name/index via typed ops → `delete_layer` old → use the **new** `Layer.id`. Explicitly state there is no in-place layout flip.
- Update operator docs (`docs/mcp-tools.md`) and `ARCHITECTURE.md` as needed for the new op and naming rule.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ae-project-patch`: Add `create_text`; make `name` optional on `create_solid` and `create_folder` per ADR 0006; evidence returns final name + new ids.
- `ae-product-skill`: Document `create_text`, optional create names, and the recreate-based point↔box conversion workflow (no fake convert op).

## Impact

- Code: `src/patch/schema.ts`, `types.ts`, apply ExtendScript (`src/ae-scripts/` + patch apply path), `src/server.ts` descriptions; unit tests; host tests when AE available.
- Docs: `docs/adr/0006-*.md`, `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/` (+ `agentsync sync`), `ARCHITECTURE.md` if the capability map lists create ops.
- Contracts: additive patch vocabulary; existing `create_*` callers that pass `name` keep working; omit-`name` is new behavior.
- Out of scope: in-place point↔box convert; vertical text create (`addVerticalText` / `addVerticalBoxText`); deep copy of effects/masks/parenting/expressions/keyframes as part of create; `executeCommand` UI convert.
