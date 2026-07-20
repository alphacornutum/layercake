## Why

After `replace_layer_source` swaps a 1920×1080 Solid for a 600×1100 Solid, AE updates Anchor Point to the new source center while Position often stays at the old center — the slot looks offset even though the source dimensions are correct. `reset_layer_surface` with `resetTransforms: true` today reports `"transforms": true` without actually resetting or verifying authored transform values, so agents cannot trust evidence or repair the slot through typed patch. Agents need a post-condition-verified transform setter and honest transform-reset evidence that returns actual values.

## What Changes

- Add typed `set_layer_transform` to `ae_patch_project`: one layer per op, shared id-or-name `target`, nested partial `transform` bag of authored 2D Transform values (omit key = preserve). Stale-project safety stays on existing `project.path` / `project.fingerprint` guards — no op-level expected-current bag.
- Evidence `before` / `after` MUST include **actual authored/pre-expression property values** for the allowlisted transform keys (not mere boolean flags); `changed` only after post-condition re-read matches supplied keys; `already_satisfied` when already matching.
- Fix `reset_layer_surface` / `resetTransforms`: actually apply AE defaults for the 2D transform baseline on that layer/source and verify via post-condition (or fail clearly). **Drop** `cleared.transforms` boolean proof; when `resetTransforms` is true, evidence MUST include actual authored transform before/after values. Expressions remain a separate `clearExpressions` flag — not implied by `resetTransforms`.
- Update closed vocabulary lists, operator docs (`docs/mcp-tools.md`), and product skill (`.ai/src/skills/drive-after-effects/` + sync). No implicit save; no render-pixel proof.

## Capabilities

### New Capabilities

<!-- none — extends existing patch vocabulary -->

### Modified Capabilities

- `ae-project-patch`: Add `set_layer_transform` requirement; harden `reset_layer_surface` `resetTransforms` honesty / value evidence (no transform category boolean); extend closed vocabulary and control-plane post-condition lists to include the new op.
- `ae-product-skill`: Document `set_layer_transform` (partial `transform` bag, authored value evidence, prefer over eval for slot/transform repair; fingerprint guards for stale project) and honest `resetTransforms` behavior (values, not boolean; expressions separate).

## Impact

- `src/patch/schema.ts`, `apply-script.ts`, `apply-control-plane-script.ts`, `types.ts` — new op + `resetTransforms` apply/evidence fix (implementation in a later apply step; this change is planning-only).
- Unit tests in `tests/patch.test.ts`; optional host smoke on fixture when practical.
- `docs/mcp-tools.md`, `.ai/src/skills/drive-after-effects/SKILL.md` (then `agentsync sync`).
- Complementary to parallel change `frame-exact-layer-timing` (timing evidence hardening) — do not scope timing work here; agents may compose both ops in one batch when needed.
- Out of scope: generic `set_property_value` / untyped property bag; frame-timing changes; save inside patch; render/pixel probes; 3D-only transform extras (orientation, separate X/Y/Z rotation) in v1; op-level expected-current guards.
