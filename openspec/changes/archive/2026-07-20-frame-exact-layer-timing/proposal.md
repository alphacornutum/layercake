## Why

`set_layer_timing` can report integer-frame success while After Effects still stores fractional-second layer edges. Agents then see `[518, 637)` (119 frames) in inventory, but after save/reopen the exclusive out edge slips and contribution becomes `[518, 636)` (118 frames). Rounded `Math.round(time * frameRate)` post-conditions hide that class of defect. Exact expected frame count must be a product guarantee, not an audit-only hope.

## What Changes

- Strengthen `set_layer_timing` so a successful write leaves every supplied timing edge **on-grid** (`time * frameRate` within a tight epsilon of the integer frame) and the re-read integer frames (including derived `durationFrames = outFrame - inFrame`) **exactly** match the request.
- Enrich timing evidence with both integer frames and raw seconds (`startTime` / `inPoint` / `outPoint`) so agents can see drift without a separate eval.
- Fail the post-condition (do not report `changed`) when rounded frames match but edges are off-grid or durationFrames is wrong.
- Document the stronger contract in operator docs and the product skill; note that save/reopen + render-boundary probes remain agent/audit composition (patch still does not save — ADR 0003).
- **Not BREAKING** for valid payloads that already land on-grid; **stricter success** for previously “successful” off-grid writes that only passed via nearest-frame rounding.

## Capabilities

### New Capabilities

<!-- none — this hardens an existing op -->

### Modified Capabilities

- `ae-project-patch`: Strengthen `set_layer_timing` post-condition and evidence for on-grid exactness and exact durationFrames.
- `ae-product-skill`: Teach agents the frame-exact contract and that persistence/render probes stay outside the op.

## Impact

- `src/patch/apply-control-plane-script.ts` (`applySetLayerTiming`, `readLayerTimingFrames`, shared `timeToFrame` / `frameToTime` helpers)
- Possibly `src/inventory/shared-script.ts` if on-grid helpers are shared
- `src/patch/types.ts` evidence shapes; unit tests in `tests/patch.test.ts`; host coverage in `tests/editing.ae.test.ts` when AE is available
- `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/` (via AgentSync)
- Complements (does not include) parallel change `set-layer-transform` for authored transform values / honest `resetTransforms`
