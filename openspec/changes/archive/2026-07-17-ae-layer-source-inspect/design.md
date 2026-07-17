## Context

Inventory tools (`ae_list_comps`, `ae_list_sources`, `ae_list_folders`) give agents a project map with stable ids, but deliberately omit property trees, keyframes, expressions, and Interpret Footage detail. Agents that need that depth today must hand-roll ExtendScript via `ae_eval_script`. This change adds typed read-only inspect tools on the same host/eval bridge pattern as inventory: fixed ExtendScript serializers, JSON results, native AE ids as handles.

```
ae_list_*          → discover / map
ae_get_layer       → deep layer property dump (tiers + selectors)
ae_get_source      → deep footage + interpret dump
ae_eval_script     → escape hatch / mutations
```

## Goals / Non-Goals

**Goals:**

- `ae_get_layer`: recursive PropertyGroup walk for one layer with depth tiers (`overview` | `extended` | `full`) and optional `matchNames` selectors.
- Value sampling at a chosen time (default composition CTI), with explicit `preExpression` (default `true`), plus full keyframe timelines and full expression text at appropriate tiers.
- Lookup by id or name for comp/layer; ambiguous names return hard errors listing candidates; missing targets are hard errors.
- `ae_get_source`: on-demand deep dump of one `FootageItem` (item fields + `mainSource` / `proxySource` interpret settings) without bloating `ae_list_sources`.
- Best-effort value serialization; unsupported `propertyValueType`s flagged `unserializable: true`.
- Sanity size limit on inspect result JSON so pathological dumps cannot flood agent context.
- MCP tool descriptions and README document depth tiers and the size limit so agents know how to retrieve full expressions/keyframes (and how to recover when over limit).

**Non-Goals:**

- Mutating properties, keys, expressions, or interpret settings.
- Perfect serializers for `SHAPE`, `TEXT_DOCUMENT`, `MARKER`, `CUSTOM_VALUE`, etc. in v1 (flag + defer).
- Silent truncation of inspect payloads to “fit” a size budget.
- Changing list-tool payloads or adding interpret dumps to `ae_list_sources`.
- Comp-level property dumps (markers-on-comp, etc.) except as needed to resolve layer context.
- MCP-side id registry; Windows host bridge.

## Decisions

### 1. Two tools, not one mega-inspect

**Choice:** Separate `ae_get_layer` and `ae_get_source`.

**Why:** Layer dumps are property-tree heavy; footage dumps are item/source interpret heavy. Different args, tiers, and failure modes. Matches inventory asymmetry (`ae_list_comps` vs `ae_list_sources`).

**Alternatives considered:** Single `ae_inspect({ kind })` — worse discoverability and schemas.

### 2. Layer lookup: id or name, exact-one

**Choice:** Caller MUST supply exactly one of `compId` | `compName`, and exactly one of `layerId` | `layerName`.

| Resolution | Behavior                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Id         | Resolve uniquely or hard-error not found                                                                                                              |
| Name       | Case-sensitive exact match (AE default); 0 matches → not found; 2+ → ambiguity error listing `{ id, name }` (comps) or `{ id, index, name }` (layers) |

**Why:** Names help exploration; ids remain the stable follow-up handle. Never silently pick the first match.

**Alternatives considered:** Id-only — worse UX. Soft `{ missing }` like list filters — wrong for a get-one tool.

### 3. Depth tiers + selectors

**Choice:** `detail` enum defaulting to `overview`, plus optional `matchNames: string[]` that scopes the walk to matching PropertyBase `matchName` subtrees (and their descendants). Selectors compose with `detail`.

| `detail`             | Contents                                                                                                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview` (default) | Layer identity/timing attrs; property tree skeleton (`name`, `matchName`, `propertyValueType` or group flag, `numKeys`, `hasExpression`, `expressionEnabled`, enabled/active where applicable). **No** expression bodies, **no** keyframe arrays, **no** sampled values                        |
| `extended`           | Overview fields plus: value at `atTime` with `preExpression` flag echoed; **full** `expression` string when present; keyframes with `time` + serialized `value` (+ basic in/out interpolation type names when available). Omit spatial tangents / ease speed-influence unless cheap to include |
| `full`               | Extended plus keyframe ease (`KeyframeEase` speed/influence) and spatial tangents where the DOM exposes them; richest best-effort value serialization                                                                                                                                          |

**Why:** Default stays agent-context-safe; tool description tells agents to use `extended`/`full` (or selectors) for expressions and key timelines.

**Alternatives considered:** Always-full dump — blows MCP/context. Truncated expression previews in overview — rejected; full text only at deeper tiers.

### 4. Time and expression evaluation

**Choice:**

- `atTime?: number` — seconds in composition time; default `comp.time` (CTI).
- `preExpression?: boolean` — default `true`. Sampled with `valueAtTime(atTime, preExpression)` when the property can vary / has expression; otherwise `value` with the same semantics documented.
- Response MUST echo `atTime` and `preExpression` used for the sample.

**Why:** Default `preExpression: true` favors authored/keyframed truth; agents pass `false` for post-expression (on-screen) values. Explicit echo avoids ambiguity.

### 5. Serialization policy

**Choice:** Best-effort JSON for common types (`OneD`, `TwoD`, `TwoD_SPATIAL`, `ThreeD`, `ThreeD_SPATIAL`, `COLOR`, `LAYER_INDEX`, `MASK_INDEX`, enums as string names when possible). For types that need dedicated handling (`SHAPE`, `TEXT_DOCUMENT`, `MARKER`, `CUSTOM_VALUE`, `NO_VALUE`, unknown):

```json
{
  "unserializable": true,
  "propertyValueType": "SHAPE"
}
```

Document deferred types in README / tool description. Implement richer serializers only when a concrete use case appears (separate change).

**Why:** Unblocks inspect without boiling the ocean; keeps contract honest.

### 6. Source tool shape

**Choice:** `ae_get_source` with exactly one of `sourceId` | `sourceName`, and `detail`: `overview` | `full` (default `overview`).

- `overview`: Same high-value fields as `ae_list_sources` row for that item, plus a short interpret summary (e.g. alpha/fields/fps/loop flags) when available.
- `full`: Complete `mainSource` (+ `proxySource` when present) interpret dump: alpha mode, premul, invert, field separation, pulldown, native/conform/display frame rates, loop, isStill, file path / solid color / placeholder as applicable. Enum values as stable string names.

Ambiguous / missing names: same hard-error pattern as layers.

**Why:** List stays thin; interpret depth is on-demand. Footage has no property/key/expression tree.

### 7. Module placement

**Choice:** Follow inventory placement: `src/inventory/get-layer.ts` + `get-layer-script.ts`, `get-source.ts` + `get-source-script.ts`, shared walk/serialize helpers in `shared-script.ts` (or a small `inspect-script.ts` if helpers are inspect-only), types in `types.ts`, thin registration in `server.ts`.

**Why:** Same dependency direction (`server` → inventory → host); reuse folder/source helpers already in shared script.

### 8. Agent-facing documentation in the tool itself

**Choice:** `ae_get_layer` / `ae_get_source` MCP `description` strings MUST state:

- Default `overview` is lean (flags/counts only for animation).
- Use `detail: "extended"` or `"full"` (and/or `matchNames`) to retrieve **full expression text** and keyframe timelines.
- `preExpression` default and `atTime` default.
- Id vs name lookup and ambiguity behavior.
- `unserializable` policy.
- Result JSON size limit (default and that over-limit is a hard error; narrow with `detail` / `matchNames`).

README tool table MUST mirror the same guidance.

**Why:** Agents often only see tool schemas; burying this in README alone causes unnecessary overview-only loops.

### 9. Inspect result size limit

**Choice:** After building the success JSON string for `ae_get_layer` / `ae_get_source`, enforce a maximum byte length (UTF-8). Default **512 KiB** (`524288` bytes). Override via env `AE_INSPECT_MAX_BYTES` (positive integer), loaded through `config` like other `AE_*` knobs. On exceed: **hard error** (`isError`) including actual size, limit, and guidance to retry with a leaner `detail` and/or `matchNames` — **never** silently truncate.

Apply the check in TypeScript after the host returns (or after local stringify of the parsed object), not by inventing a partial tree inside ExtendScript.

**Why:** Depth tiers reduce typical size; a ceiling still stops pathological `full` dumps from flooding MCP/agent context. Silent truncation would look like a successful incomplete inspect.

**Alternatives considered:**

- Soft truncate + `truncated: true` — rejected; agents cannot trust completeness.
- Walk-time property/key caps only — useful later as optimization; insufficient alone without a final byte check.
- Much higher default (multi‑MB) — defeats the sanity goal for agent context.

## Risks / Trade-offs

- **[Risk] Huge `full` payloads on dense layers** → Mitigation: default `overview`; selectors; document tiers; **512 KiB hard ceiling** with recovery guidance; timeout headroom via `AE_SCRIPT_TIMEOUT_MS`.
- **[Risk] Legitimate large inspect blocked by default limit** → Mitigation: `AE_INSPECT_MAX_BYTES` override; narrower `matchNames` often better than raising the cap.
- **[Risk] ExtendScript walk performance on complex effects** → Mitigation: matchName filtering; keep overview cheap; host tests on a fixture layer.
- **[Risk] Enum/string naming drift across AE versions** → Mitigation: prefer AE enum `.toString()` / known maps; fall back to numeric + note in payload if needed.
- **[Risk] Name lookup collisions frustrate agents** → Mitigation: return candidate ids so the next call is unambiguous.
- **[Trade-off] `preExpression` default true** → Authored values by default, not viewer result; documented explicitly.

## Migration Plan

Additive tools only. No migration of existing list payloads. Ship behind normal MCP restart after build. Rollback = omit tool registration (or revert change).

## Open Questions

- Whether `extended` should include basic interpolation type names only, leaving ease/tangents strictly to `full` (lean yes unless implementation finds them free).
- Exact matchName matching: exact string match only in v1 (no globs) — confirm during implement if agents need prefix match; start exact-only.
