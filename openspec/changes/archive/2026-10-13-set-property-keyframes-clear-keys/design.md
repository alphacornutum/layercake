# Design

## Context

`set_property_keyframes` shipped in `property-keyframe-management` (complete, not yet synced to main specs). Its static mode removes every key and then calls `prop.setValue(sample)`. On a property After Effects considers hidden — the motivating case is `Audio Levels` on an audio-less solid (issue #32) — `setValue` is refused with "the property or a parent property is hidden", but only _after_ the keys are already removed, leaving partial mutation; the batch `app.undo()` rollback was observed as `completed: false` (AE 26.5x89).

Host observations that constrain the design:

- Reads (`value`, `valueAtTime`, key metadata) and `removeKey` work while hidden; only value _writes_ are refused.
- The vendored Scripting Guide exposes no `isHidden` or equivalent attribute — hidden-ness is only observable through a refused write, never before mutation.
- Whether `addKey`/`setValueAtKey` work on a hidden property is unknown (the leftover keys in the motivating fixture were created by a source round-trip, not by adding keys while hidden).

## Goals / Non-Goals

**Goals:**

- A clear-only desired state that never writes a value, so it is immune to the hidden-property write refusal and works uniformly on visible and hidden properties.
- A static-mode failure path that restores the removed keys in place from the captured before-state, verifies the restoration by re-reading, and reports the restore outcome honestly instead of depending on batch undo.
- Evidence that distinguishes "keys cleared, no value written" from failure, and that reports the actual retained value without presenting it as a restore.
- Compose mechanically with the prior change's un-synced delta.

**Non-Goals:**

- No hidden-ness detection: there is no API, and special-casing `layer.hasAudio === false` for the Audio group is a leaky proxy we will not add.
- No empty `keyframes: []` desired state: the shipped design's rejection of an empty timeline with an unspecified static value stands; `clearKeys` is the explicit clear intent.
- No generic static value setter, no timeline-mode changes, no support for markers or other opaque keyed properties.
- No expression-write guarantees on hidden properties beyond honest failure reporting; expected guards, sibling preservation, fingerprint guards, and never-save semantics are unchanged.

## Decisions

### `clearKeys: true` as a literal-true third desired state

Schema: `clearKeys: z.literal(true)` so `clearKeys: false` fails validation rather than silently meaning "do nothing". The desired-state refinement becomes exactly one of `keyframes` (non-empty), `staticValueAtTime`, or `clearKeys`. Empty desired `keyframes` stays rejected; empty _expected_ `keyframes` still asserts zero keys.

Preflight: mode `"clear"` skips static sampling entirely. Idempotence reuses the static-mode rule: zero keys and no expression clear needed means `already_satisfied`. Domain checks are unchanged — clear mode still requires the supported numeric domain so before/after evidence and the sibling preservation walk stay faithful (markers remain refused).

Evidence: `mode: "clear"`, after-state `numKeys: 0` with an empty timeline, expression state, and `retainedValue` — a read of the property's value after clearing, in a field deliberately distinct from `staticValue` so it can never be misread as a sampled restore. Operator docs state that AE chooses the retained value (observed: the last key's value on a hidden property) and callers cannot rely on any particular value.

**Alternatives rejected:** `keyframes: []` (reverses a documented design decision and an empty array reads as caller error); a mode enum replacing the two-field XOR (schema churn for existing callers for no behavioral gain); making `clearKeys` a plain optional boolean (a `false` no-op is a silent footgun).

### Static restore failure: in-place restore with verification

The static apply branch wraps its remove-loop plus `setValue(sample)`. On a write error, it recreates the removed keys from the captured `kf.before.keyframes` (addKey, setValueAtKey, interpolation and ease), re-reads the timeline with the existing snapshot reader, and compares against the before-snapshot with the existing equality check. The target result reports the original error plus `restore: { attempted, verified }`; `verified` reflects the re-read comparison, never an assumption that a non-throwing restore call succeeded.

`mutated`/`anyChanged` stay true even when restore verifies — writes occurred and the project is dirty. Batch undo reporting continues to run exactly as today; the in-place restore is the op's own recovery evidence for this known failure path, layered under it.

**Alternatives rejected:** pre-detect hidden-ness and refuse before removal (impossible — no API; and the only observable is the refused write itself); relying on batch `app.undo()` alone (observed `completed: false` on the motivating fixture); reusing the swallowing `clearPropertyKeys`/reset-style helpers as-is (the prior design already rejected silent best-effort semantics for this op; the mechanical replay may reuse the existing restore helper, but the re-read verification — not a swallowed exception — decides `verified`).

### Host probe: key writes on a hidden property

A host test probes whether `addKey`/`setValueAtKey` succeed on a hidden `Audio Levels` while `hasAudio === false`. Host result (AE 26.5x89): a hidden property refuses every value write — `addKey`, `setValueAtKey`, and `setValue` — while `removeKey` and reads succeed. So the in-place restore cannot verify on the motivating fixture (it reports `restore.verified: false`), timeline mode cannot write to a hidden property either, and clear mode is the only supported way to remove keys there. Clear mode never depends on a write, which is why it is the fix.

### Delta composition with the unsynced prior change

The MODIFIED requirement ("Property keyframe operation replaces a complete timeline or restores a sampled static value") currently exists only in `property-keyframe-management`'s delta, so `openspec validate` reports an INFO that archive would refuse this delta today. The ordering contract is: sync/archive `property-keyframe-management` first, then this change. The requirement header is deliberately unchanged (no RENAMED) so the two deltas compose mechanically; the header reading slightly stale ("or restores a sampled static value") is accepted over rename churn in the same step.

## Risks / Trade-offs

- `addKey` refused while hidden → in-place restore cannot verify on the motivating fixture → clear mode still works; static mode fails honestly with `verified: false` and the actual post-state. Mitigated by the probe and docs.
- AE retains an unexpected value after clearing → evidence reports the actual read-back and docs call the value AE-defined. No mitigation promise beyond honesty.
- Expression clear (`expressionHandling: "clear"`) may itself be refused while hidden → the default `reject_enabled` policy still preflights enabled expressions before mutation; a refused clear is reported as a failure, not swallowed. The motivating case has no expression.
- Two active changes touch `ae-project-patch` → sync order dependency (prior change first). `openspec validate` already surfaces it as INFO.
- Reading `prop.value` on a hidden property is assumed to work (`valueAtTime` is verified; `value` is host-test-confirmed for `retainedValue`).

## Migration Plan

Additive op field and branches; existing payloads behave identically. Implement in order: schema union → result types/parsing → preflight mode → apply clear branch → static restore path → unit tests → host tests (hidden fixture via the source round-trip repro, visible-property regression) → operator docs (`docs/mcp-tools.md`, server tool description, `ARCHITECTURE.md` patch-ops sentence) → full QA including `exuno check` and `npm run test:ae` on a configured host. Rollback is removal of the additive field and branches; no payload migration needed.
