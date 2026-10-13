# Proposal

## Why

`set_property_keyframes` cannot repair a property After Effects considers hidden — the motivating case (issue #32) is `Audio Levels` on an audio-less solid, the shipped template placeholder that runtime replacement must clear. Hidden properties accept `removeKey` and reads but refuse `setValue`, so static mode removes every key and then throws, leaving the property partially mutated with an unverified rollback. Hidden-ness cannot be detected before a write, so the repair must be a desired state that never writes a value; the mutating failure path also needs to restore what it removed.

## What Changes

- Add a third mutually exclusive desired state to `set_property_keyframes`: `clearKeys: true` removes every keyframe and never writes a value. It works uniformly on visible and hidden properties. The resulting value is AE-defined (host observation: the last key's value is retained) and is reported as read-back evidence, not as a restore promise.
- Keep the existing rejection of an empty desired `keyframes` array; `clearKeys` is the explicit clear intent and the shipped design's rejection of an unspecified static value stays intact.
- Fix the static-mode partial-mutation hazard: when the sampled static restore fails after keys were removed, restore the removed keys in-place from the captured before-snapshot, verify restoration by re-reading the timeline, and report the restore attempt and verification outcome honestly in failure evidence instead of relying on batch undo.
- Evidence distinguishes the modes: `mode: "clear"` with after-state `numKeys: 0`, the actual retained value, and an explicit marker that no value was written; static-mode failures report the original error plus the in-place restore outcome.
- Preserve everything else: `expected` guards (including `expected.keyframes: []` asserting zero keys), `expressionHandling`, sibling-key preservation, fingerprint guards, idempotence (`already_satisfied` when there are no keys), and never-save semantics.
- Document the clear-mode value semantics (AE retains the last key value on a hidden property; callers cannot rely on any sampled value) in `docs/mcp-tools.md` and the `ae_patch_project` tool description.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ae-project-patch`: the property keyframe operation gains a clear-only desired state and its static-mode failure path gains verified in-place restoration of removed keys.

## Impact

- `src/patch/schema.ts` — `setPropertyKeyframesOpSchema`: add `clearKeys` and make the desired state exactly one of `keyframes` (non-empty), `staticValueAtTime`, or `clearKeys`.
- `src/patch/types.ts` — extend the mode union to `"clear"`, add clear-mode after-evidence (retained value, no-value-written marker) and static-mode restore-outcome evidence.
- `src/ae-scripts/shared/control-plane.ts` — preflight mode determination and zero-key idempotence for clear mode; apply gains a clear branch and an in-place restore-and-verify path for static restore failures.
- Result parsing and tests — unit tests for the schema union and evidence shapes; AE host tests covering a hidden property (solid-source round-trip fixture carrying leftover Audio Levels keys) and unchanged visible-property behavior; a host probe documenting whether `addKey`/`setValueAtKey` work while hidden (bounds what in-place restore can recover on a hidden property).
- Operator docs and orientation — `docs/mcp-tools.md`, the `src/server.ts` tool description, and the `ARCHITECTURE.md` patch-ops sentence.
- Builds on the in-flight `property-keyframe-management` change (complete, not yet synced); this change's delta composes after that one's at sync time.
