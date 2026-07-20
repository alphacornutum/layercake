## Context

`set_layer_timing` writes `startTime` / `inPoint` / `outPoint` via `frameToTime(frame, fps) = frame / fps`, then post-checks with `timeToFrame(t, fps) = Math.round(t * fps)`. That round-trip is usually exact for clean writes, but AE can retain or nudge fractional-second edges (especially when only some fields are written, or host quantizes on save). Inventory then shows correct _rounded_ frames while exclusive-end contribution is one frame short after persistence — e.g. target `[518, 637)` → 119 frames becomes `[518, 636)` → 118.

ADR 0003: patch reports `changed` only after post-condition re-read; patch never saves. Save/reopen and render probes stay agent-composed.

Parallel change `set-layer-transform` addresses authored transform evidence; this change is timing-only.

## Goals / Non-Goals

**Goals:**

- Successful `set_layer_timing` MUST leave every written edge on-grid and yield exact requested integer frames, including exact `durationFrames = outFrame - inFrame` when both in and out are in scope (supplied or already matching).
- Post-condition MUST fail when rounded frames match but edges are off-grid.
- Evidence MUST expose frames + seconds so agents can diagnose drift without `ae_eval_script`.
- Docs/skill MUST state the stronger contract and that persistence/render audits remain outside the op.

**Non-Goals:**

- Baking `ae_save_project` or reopen into the op.
- A host render/contribution probe MCP tool (audit/skill guidance only).
- Changing exclusive-end semantics (`durationFrames = out - in`); we keep that model and make it _true_.
- `set_layer_transform` / `resetTransforms` (separate change).
- Drop-frame timecode UI quirks beyond using composition `frameRate` for conversion.

## Decisions

### 1. On-grid post-condition (strong “integer frames”)

After write, for each supplied timing field (`startFrame`, `inFrame`, `outFrame`), require:

1. `timeToFrame(seconds, fps) === requestedFrame` (integer equality), and
2. `abs(seconds * fps - requestedFrame) < epsilon` (on-grid; recommended epsilon `1e-6` frames, or equivalent seconds tolerance `1e-6 / fps`).

If AE returns a value that rounds correctly but fails (2), status is `failed` with actual `after` (frames + seconds) and a clear message (e.g. off-grid edge).

**Alternatives considered:** Keep round-only post-condition (rejected — recreates the half-frame lie). Rewrite in a loop until on-grid (optional mitigation if single write drifts; prefer one write + fail loudly unless host tests show AE systematically nudges).

### 2. Exact durationFrames

When the effective in/out after the op are known (both supplied, or one supplied and the other already at a verified integer), require:

`after.outFrame - after.inFrame === expectedDurationFrames`

where expected is derived from the request’s effective in/out (supplied overrides before). Mismatch → `failed` even if each edge rounds individually.

### 3. Evidence shape (additive)

Extend timing `before`/`after` to include at least:

- existing: `startFrame`, `inFrame`, `outFrame`, `stretch`
- add: `startTime`, `inPoint`, `outPoint` (seconds)
- add: `durationFrames` (derived from integer in/out)

Additive fields; no removal of existing keys.

### 4. Write strategy

Keep writing `frame / frameRate`. Optionally re-assign the same computed seconds if a first re-read is off-grid by tiny float noise. Do not invent half-frame offsets (e.g. `+ 0.5/fps`) unless host tests prove AE requires them for exclusive-end inclusion — default is exact `n/fps`.

### 5. Persistence / render (documentation only)

Skill + `docs/mcp-tools.md` MUST note: for critical carriers, agents SHOULD save/reopen and re-read integer frames, and MAY probe boundary-frame contribution via eval/render workflows. The op itself MUST NOT claim persistence or pixel proof.

### 6. Shared helpers

Prefer adding `isOnGridFrame(time, frame, frameRate)` (or equivalent) next to `timeToFrame` / `frameToTime` in `shared-script.ts` so inventory and patch stay consistent if inventory later surfaces an on-grid flag (out of scope to require inventory changes in this change unless cheap).

## Risks / Trade-offs

- **[Risk] Stricter post-condition fails more often on pathological AE nudges** → Mitigation: clear `after` seconds in evidence; optional single rewrite; host test on fixture; document that `ae_eval_script` remains escape hatch.
- **[Risk] Float epsilon too tight/loose across fps (23.976, 29.97)** → Mitigation: compare in frame units (`abs(t*fps - frame) < 1e-6`) rather than absolute seconds alone; validate on non-integer fps in unit/AE tests.
- **[Risk] Agents assume save is covered** → Mitigation: explicit non-goal in docs/skill (ADR 0003 alignment).
- **[Trade-off] No render probe in product** → Accept; keeps thin primitives; audit dual-check stays outside MCP.

## Migration Plan

- Deploy as stricter success semantics; no schema field renames.
- Callers that only checked `status === "changed"` may newly see `failed` for off-grid outcomes — correct behavior.
- No data migration.

## Open Questions

- Whether a single automatic rewrite pass is needed on real hosts (decide during `test:ae` — default: fail without rewrite unless tests show systematic tiny drift after one clean write).
