# Design

## Context

See `proposal.md` for motivation and `specs/ae-project-patch/spec.md` plus `specs/ae-layer-inspect/spec.md` for the behavior contracts. `rename_layer` already resolves one layer, runs under the guarded patch batch, and reports name-only evidence. `ae_get_layer` returns compact identity metadata before walking properties, making it the natural read-only persistence check.

## Goals / Non-Goals

**Goals:**
- Treat a same-text inherited name as a required assignment, not an idempotent no-op.
- Verify actual AE name-assignment state before reporting success.
- Make assignment state observable via `ae_get_layer` without making property detail heavier.
- Preserve the current rename operation shape, selector resolution, save separation, and layer source.

**Non-Goals:**
- Add a second name operation or a `forceAssignment` option.
- Change the existing id-or-name selector contract or the fingerprint guard.
- Rename layers implicitly during source replacement; the explicit assignment itself must make the name resilient to replacement.

## Decisions

### Use the current `rename_layer` operation as an ensure-name operation

A requested name is satisfied only when the visible name matches and AE reports `isNameSet` true. When the name is inherited or the text differs, assign `layer.name = desired`, then re-read both name and assignment state. When the desired name is already explicit, return `already_satisfied` without writing. This makes the existing operation's default semantics consistent for both changed and same-text requests, without adding an option callers can forget.

Retain `rename_layer`'s existing id-or-name target resolution and ambiguity errors. The layer is resolved to its exact live identity before mutation; stable ids remain preferred as elsewhere in LayerCake. Requiring id-only inputs here would break existing name-targeted callers without changing the guarded apply path.

### Treat explicit-state verification as part of the post-condition

Success requires the re-read name to equal the request and `isNameSet` to be true. If the host cannot read that state, or the assignment does not make it true, report failure rather than infer success from text equality. Evidence includes `name` and `isNameSet` before and after, plus `isNameFromSource` and `sourceId` when AE exposes them. The source identity is read before and after so source preservation can be verified; no source replacement is performed by this operation.

### Expose name state in the existing layer inspection identity payload

Add the AE name-state fields beside `name` in `ae_get_layer`'s always-present layer identity metadata, independent of `detail`. Keep source identity in the existing `source` field. Do not infer `isNameFromSource` when AE does not expose it; report it as unavailable. This allows callers to verify the explicit state after `save_copy`, close, and reopen without requesting or parsing a property tree.

## Risks / Trade-offs

- **AE exposes the state differently or not on the full supported host range** → Verify the `Layer.isNameSet` and `Layer.isNameFromSource` behavior against the supported host floor. The patch must not claim success without proving `isNameSet`; `isNameFromSource` can remain unavailable as specified.
- **Some callers relied on an inherited matching name remaining inherited** → Such a call to `rename_layer` now pins that name explicitly. This is intentional: callers wanting no mutation should not invoke a naming operation; explicit-name state is the meaning of the requested operation.
- **Layer name assignment unexpectedly affects source or other layer state** → Capture source identity in evidence and cover same-name assignment and later source replacement in host tests.

## Migration Plan

No input schema migration is required. Existing `rename_layer` requests remain valid. Consumers parsing result evidence can continue reading `before.name` and `after.name`; new explicit-state fields are additive. Existing `ae_get_layer` consumers receive additive identity fields. No save is performed by patch apply; callers continue to use `ae_save_project` explicitly.

## Open Questions
