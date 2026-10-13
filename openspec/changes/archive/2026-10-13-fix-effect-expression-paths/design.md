# Design

## Context

See [proposal.md](./proposal.md). The property walker in `src/ae-scripts/shared/control-plane.ts` already calls `property(segment)` for each path segment — the same mechanism AE uses in expressions. Issue #25 repro on AE 26.5 confirmed:

- **Fails:** `["ADBE Effect Parade", "ADBE Slider Control-0001"]`
- **Works:** `["ADBE Effect Parade", "ADBE Slider Control", "ADBE Slider Control-0001"]`
- **Works:** `["ADBE Effect Parade", "Contrast Boost", "ADBE Slider Control-0001"]` (display name middle segment)

The private template AEP used in the GitHub issue cannot ship in the public repo. Regression coverage must recreate the scenario inside existing host tests.

## Goals / Non-Goals

**Goals:**

- Make the effect-instance segment rule discoverable in docs, tool descriptions, and the product skill.
- Lock behavior with a host test that builds a Slider Control on a fixture layer via eval setup (no committed template AEP).
- Keep MCP contracts unchanged (additive documentation + test only).

**Non-Goals:**

- Resolver “hint” when a segment exists only nested under an effect group (issue #25 suggestion #2).
- New `#` propertyPath delimiter (suggestion #3 — redundant with `->`).
- `ae_get_layer` emitting copy-paste `pathSegments` on tree nodes (follow-up if agents still struggle after docs).

## Decisions

### D1 — Docs-first, no resolver change

**Decision:** Do not change `resolvePropertySegments` or Zod schemas.

**Rationale:** Behavior matches AE and the existing OpenSpec contract; wrong paths are caller errors. Adding search/hints would be surprising magic and ambiguous with multiple Slider Controls.

**Alternative rejected:** Nested-segment hint on failure — useful but out of scope for this change.

### D2 — Host test setup via eval on public fixture

**Decision:** Add one test block to `tests/editing.ae.test.ts` (or a focused describe within it) that:

1. Opens a temp copy of `fixtures/hello-world.aep` (existing pattern).
2. Uses `host.evalScript` to add `ADBE Slider Control` to a known layer (e.g. `main` / `Hello World`), rename the effect instance to a distinctive display name (e.g. `Contrast Boost`), return `{ compId, layerId }`.
3. Re-binds `ae_project_context` fingerprint.
4. Asserts `set_property_expression` with two-segment path returns `ok: false` and the not-found message.
5. Asserts three-segment path via effect matchName succeeds; expression evidence shows `resolvedMatchNames`.
6. Clears expression, asserts three-segment path via display name succeeds and normalizes middle segment in evidence.
7. Cleans up (optional: `reset_layer_surface` clearEffects or undo via discard on temp copy — test already uses temp AEP discarded in `afterAll`).

**Rationale:** Matches issue #25 topology without shipping proprietary projects. Reuses established editing.ae patterns (eval setup → typed patch → assert evidence).

**Alternative rejected:** Commit a minimal synthetic `.aep` with Slider Control — harder to maintain across AE versions; eval setup is self-documenting.

### D3 — Documentation surfaces

**Decision:** Update in lockstep:

| Surface                                       | Change                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `docs/mcp-tools.md`                           | New subsection under `set_property_expression` with tree diagram, failing vs working JSON, `propertyPath` example |
| `src/server.ts`                               | One sentence each on `ae_get_layer` (tree ≠ flat path) and `ae_patch_project` (effect instance segment)           |
| `.ai/src/skills/drive-after-effects/SKILL.md` | Short gotcha under typed patch / expressions                                                                      |

Run `agentsync sync` after skill edit.

**Rationale:** Agents read tool descriptions first; skill and mcp-tools are the durable reference.

### D4 — Unit tests optional

**Decision:** No new Vitest unit tests for the walker — host test covers the integration contract. Existing `patch.test.ts` schema tests remain sufficient.

## Risks / Trade-offs

- **[Display names locale-dependent]** → Docs prefer effect matchName when only one instance; display name documented for disambiguation only.
- **[Eval setup flakiness across AE versions]** → Use matchName `ADBE Slider Control` for addProperty; rename via `.name` assignment (Scripting Guide pattern).
- **[Test runtime]** → Single small eval + three patch calls; acceptable in gated `test:ae` suite.

## Migration Plan

1. Ship docs + test; no operator migration — existing correct three-segment calls unchanged.
2. Agents using two-segment paths continue to fail (correct); update prompts/skills to use documented paths.
3. Rollback = revert change; no data migration.

## Open Questions

_(none — scope is documentation + host test only)_
