## Context

The MCP server already exposes thin primitives (`ae_host_status`, `ae_open_project`, `ae_eval_script`, docs tools). The original design deferred higher-level tools like `list_comps` until real agent workflows appeared. Agents now need a reliable project map: every composition, every layer, key timeline attributes, and a handle that survives reorder/rename so later `ae_eval_script` calls (or future typed tools) can find the same layer again.

After Effects already provides this handle: `Layer.id` (AE 22+) is a persistent integer that stays stable across save/reload and stack moves. Compositions inherit `Item.id` the same way. No MCP-side ID registry is required for reliability within a project file.

UI “label color” in After Effects is the scripting attribute `Layer.label` (integer `0` = None, `1`–`16` = Labels preferences swatches).

## Goals / Non-Goals

**Goals:**

- One agent-friendly MCP tool that returns nested JSON for compositions and their layers.
- Optional filter to inventory only selected compositions (by stable id and/or name).
- Include the fields agents asked for (type, in/out, motion blur, label, has-effects, duration, stretch, stable ids), plus minimal identity context (name, index, comp id).
- Document the ExtendScript pattern to resolve `layerId` → `Layer` so agents can use ids immediately with `ae_eval_script`.
- Keep the tool read-only (no project mutation).

**Non-Goals:**

- Timeline fold/twirl (“folded”) state — not exposed by the AE scripting DOM; do not invent a fake field.
- Full effect graphs, keyframes, expressions, or property dumps (inventory only; deeper inspect can come later).
- MCP-side persistent ID cache or remapping layer across projects/imports (AE assigns new ids on import into another project).
- A separate resolve tool in this change (lookup via `ae_eval_script` + documented helper is enough; a typed `ae_get_layer` can follow if agents struggle).
- Windows host bridge work.

## Decisions

### 1. Single tool: `ae_list_comps`

**Choice:** One tool named `ae_list_comps` with an optional filter argument:

| Arg             | Type       | Meaning                                                                 |
| --------------- | ---------- | ----------------------------------------------------------------------- |
| _(omit)_ / `{}` | —          | Inventory **all** compositions in the open project                      |
| `compIds`       | `number[]` | Include comps whose `Item.id` is in the list                            |
| `compNames`     | `string[]` | Include comps whose `name` matches exactly (case-sensitive, AE default) |

If both filters are provided, a composition matches if it satisfies **either** list (union). Unknown ids/names MUST NOT fail the whole call; they appear in a `missing` array so agents can see what did not resolve.

**Why:** Agents prefer one discoverable tool over a list/get pair for the same snapshot. Filtering is optional args on the same tool, which matches how agents already use MCP tools and avoids an extra round trip for “all comps.” Comp-level listing without layers would be a second tool later if payload size becomes a problem—not now.

**Alternatives considered:**

- Two tools (`ae_list_comps` summary + `ae_list_layers`) — cleaner for huge projects, worse for the common “show me everything” agent loop.
- Filter only by name — fragile when duplicate names exist; ids are the reliable handle.
- Required args — forces agents to know comps first; circular for discovery.

### 2. Stable identity: native AE ids, not MCP aliases

**Choice:** Return:

- `comp.id` ← `CompItem.id` (`Item.id`)
- `layer.id` ← `Layer.id`

Expose current `layer.index` (1-based stack position) as **ephemeral** context only. Tool description and README MUST state that agents SHOULD prefer `id` for follow-up work, and that `index` changes when layers are reordered.

Resolution pattern (for docs / tool description):

```javascript
function layerById(comp, layerId) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).id === layerId) return comp.layer(i);
  }
  return null;
}
```

Same idea for comps by scanning `app.project.items` for `CompItem` with matching `id`.

**Why:** AE’s id already meets the reliability bar (survives move/rename/save). An MCP-side map would desync on project switch, undo, or another process mutating AE, and would be strictly worse.

**Alternatives considered:**

- MCP UUID map keyed by session — more control, fragile across restarts/project reloads.
- `name` + `index` compound keys — break on rename/reorder.
- Marker/comment stamps — mutate the project; unacceptable for a read tool.

### 3. Response shape: compact nested JSON

**Choice:** Tool result is JSON (stringified in the MCP text content, same pattern as other tools):

```json
{
  "projectName": "Demo.aep",
  "compositions": [
    {
      "id": 101,
      "name": "Main",
      "duration": 10,
      "frameRate": 30,
      "numLayers": 2,
      "layers": [
        {
          "id": 42,
          "index": 1,
          "name": "Logo",
          "type": "av",
          "inPoint": 0,
          "outPoint": 5,
          "duration": 5,
          "stretch": 100,
          "motionBlur": false,
          "label": 3,
          "hasEffects": true
        }
      ]
    }
  ],
  "missing": { "compIds": [], "compNames": [] }
}
```

Field mapping:

| JSON field             | AE source                    | Notes                                                                                                                 |
| ---------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `type`                 | runtime class / flags        | One of: `av`, `text`, `shape`, `camera`, `light`, `null`, `adjustment`, `guide`, `other` (best-effort classification) |
| `inPoint` / `outPoint` | `Layer.inPoint` / `outPoint` | Seconds, composition time                                                                                             |
| `duration`             | `outPoint - inPoint`         | Layer span in comp time (not source media length)                                                                     |
| `stretch`              | `Layer.stretch`              | Percent (100 = none)                                                                                                  |
| `motionBlur`           | `AVLayer.motionBlur`         | `false` for layer types without the switch                                                                            |
| `label`                | `Layer.label`                | `0`–`16` UI label color index                                                                                         |
| `hasEffects`           | `effects.numProperties > 0`  | Via `"ADBE Effect Parade"` when present; else `false`                                                                 |

Omit `folded`: not scriptable. Do **not** alias `shy` as folded (different meaning).

**Why:** Nested comps→layers matches how agents reason about AE. Flat lists of layers force re-grouping. Keeping fields scalar/boolean keeps tokens low; effect names can be a follow-up tool.

**Alternatives considered:**

- Flat `layers[]` with `compId` — harder to skim, similar size.
- Include effect matchNames now — useful but balloons payloads; defer.
- Human label color names — preference-dependent and localized; numeric `label` is authoritative.

### 4. Implementation: fixed ExtendScript via existing eval bridge

**Choice:** Ship a checked-in ExtendScript inventory snippet (or TS-built string) executed through the existing host eval path. Parse JSON in TypeScript and return as the tool result. No new host transport.

**Why:** Reuses proven bridge; keeps inventory logic testable as a pure script string; matches deferred-higher-level-tools plan from `after-effects-mcp`.

**Alternatives considered:**

- Agents write their own eval each time — status quo, what we are replacing.
- CEP/UXP panel API — out of scope.

### 5. Errors and empty projects

**Choice:**

- No open project / host unavailable → structured tool error (same style as other host tools).
- Project with zero comps → success with `"compositions": []`.
- Filter matches nothing → success with empty `compositions` and populated `missing` when applicable.

## Risks / Trade-offs

- [Very large projects → huge JSON] → Mitigation: optional `compIds`/`compNames` filter; document that agents should filter; consider a summary mode later if needed.
- [AE &lt; 22 lacks `Layer.id`] → Mitigation: require AE 22+ in tool description; fail with a clear error if `id` is missing/undefined.
- [Duplicate layer/comp names] → Mitigation: always return ids; matching by name is filter-only convenience.
- [Type classification edge cases (null, adjustment, guide)] → Mitigation: ordered checks (null/adjustment/guide before generic `av`); unknown → `other`.
- [Agents confuse `label` with fill color] → Mitigation: tool description explicitly says “timeline label color index (0–16)”.
- [Agents ask for folded state] → Mitigation: document non-availability in tool description and this design; do not fake it.

## Migration Plan

1. Add inventory ExtendScript + `ae_list_comps` tool registration.
2. Unit-test JSON shape / filter logic with mocked eval results; gated AE integration test against a fixture project.
3. Update README tool table + Cursor MCP examples.

Rollback: remove the tool registration; no data migrations.

## Open Questions

1. Whether a follow-up typed `ae_get_layer({ compId, layerId })` is worth adding after agents use inventory in practice (likely yes if eval boilerplate is noisy).
2. Whether `compNames` matching should be case-insensitive (AE UI is usually case-sensitive; start strict).
