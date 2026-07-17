## Context

`ae_list_comps` already returns compositions and layers with stable AE ids (`Item.id` / `Layer.id`). Agents still lack a first-class view of Project panel footage and folder organization. Layer → source linkage exists in the DOM (`AVLayer.source` → `AVItem`), and every project item has `parentFolder` for hierarchy. This change extends the inventory surface the same way comps were added: fixed ExtendScript snippets over the existing eval bridge, JSON results, native AE ids as handles.

## Goals / Non-Goals

**Goals:**

- Enrich `ae_list_comps` layers with a compact `source` object when `AVLayer.source` is present.
- Add `ae_list_sources` for all `FootageItem`s with useful metadata + stable id + folder placement.
- Add `ae_list_folders` for a nested Project-panel tree that agents can read without reconstructing paths.
- Keep tools read-only; reuse the eval bridge; keep ids as native `Item.id`.

**Non-Goals:**

- Replacing or deeply duplicating composition inventory (comps stay on `ae_list_comps`; precomp layers still get a compact source ref pointing at the comp id).
- Full Interpret Footage dumps (every alpha/pulldown enum) — expose the high-value subset; agents can `ae_eval_script` for edge cases.
- Proxy file management, replace/reload mutations, or import workflows.
- MCP-side id registry or cross-project identity.
- Windows host bridge work.

## Decisions

### 1. Compact source on `ae_list_comps` layers

**Choice:** When a layer has `source` (AVLayer with non-null `layer.source`), include:

```json
"source": {
  "id": 55,
  "name": "logo.png",
  "type": "footage",
  "footageKind": "file",
  "parentFolderId": 12,
  "folderPath": "Assets/Logos"
}
```

| Field            | Meaning                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `id`             | `Item.id` of the source AVItem                                                                     |
| `name`           | Project panel name                                                                                 |
| `type`           | `"footage"` or `"comp"` (`FootageItem` vs `CompItem`)                                              |
| `footageKind`    | Only when `type === "footage"`: `"file"` \| `"solid"` \| `"placeholder"` (from `mainSource` class) |
| `parentFolderId` | `parentFolder.id` (root folder’s id when at project root)                                          |
| `folderPath`     | `/`-joined folder names from root → parent (empty string `""` at root)                             |

Omit `source` entirely for layers without one (camera, light, text with null source, etc.). Do **not** embed full file paths or solid colors here — that belongs on `ae_list_sources` to keep layer inventory small.

**Why:** Agents scanning comps need the join key (`source.id`) without a second tool call for every layer. Full footage metadata stays on the sources tool.

**Alternatives considered:**

- Always null `source: null` — noisier JSON.
- Inline full footage metadata on every layer — duplicates data across layers sharing one source; huge payloads.
- Only return `sourceId` — too sparse for skimming.

### 2. Tool: `ae_list_sources`

**Choice:** One read-only tool, no required filters (optional later if needed). Returns every `FootageItem` in `app.project.items`:

```json
{
  "projectName": "Demo.aep",
  "sources": [
    {
      "id": 55,
      "name": "logo.png",
      "label": 0,
      "comment": "",
      "footageKind": "file",
      "width": 1920,
      "height": 1080,
      "pixelAspect": 1,
      "frameRate": 30,
      "duration": 0,
      "hasVideo": true,
      "hasAudio": false,
      "footageMissing": false,
      "isStill": true,
      "useProxy": false,
      "file": "/Users/me/project/logo.png",
      "missingFootagePath": null,
      "solidColor": null,
      "parentFolderId": 12,
      "folderPath": "Assets/Logos",
      "usedInCompIds": [101]
    }
  ]
}
```

Field notes:

- Identity: `id` ← `Item.id` (stable within the project file).
- `footageKind`: classify `mainSource` as FileSource / SolidSource / PlaceholderSource.
- `file`: absolute `File.fsName` when FileSource and present; else `null`.
- `missingFootagePath`: from FileSource when missing; else `null`.
- `solidColor`: `[r,g,b]` for SolidSource; else `null`.
- `usedInCompIds`: map `AVItem.usedIn` to composition `Item.id`s (helps agents without scanning all comps).
- Folder fields same convention as layer source refs.

**Why:** Mirrors `ae_list_comps` as a flat inventory of the other major Project panel entity. Compositions are intentionally excluded (already listed); they still appear as `type: "comp"` on layer source refs.

**Alternatives considered:**

- Include CompItems in `sources` — duplicates `ae_list_comps`.
- Separate tools per footage kind — worse discovery.
- Filter by folder id in v1 — defer until payload size hurts.

### 3. Tool: `ae_list_folders` (hierarchical tree)

**Choice:** Nested JSON from `app.project.rootFolder`:

```json
{
  "projectName": "Demo.aep",
  "root": {
    "id": 1,
    "name": "Root",
    "type": "folder",
    "children": [
      {
        "id": 12,
        "name": "Assets",
        "type": "folder",
        "children": [
          {
            "id": 55,
            "name": "logo.png",
            "type": "footage",
            "footageKind": "file"
          }
        ]
      },
      {
        "id": 101,
        "name": "Main",
        "type": "comp"
      }
    ]
  }
}
```

- Folders include nested `children` (order = Project panel folder order via `FolderItem.item(i)`).
- Non-folder leaves are compact: `id`, `name`, `type` (`footage` \| `comp`), plus `footageKind` for footage.
- Root uses `app.project.rootFolder` (`name` may be empty in AE; emit `"Root"` or the AE name consistently — prefer AE’s `rootFolder.name` if non-empty, else `"Root"`).

**Why:** Flat source lists with `folderPath` answer “where is this item?”; the tree answers “what does the project look like?” in one skim. Both are valuable; keeping them separate avoids forcing a huge nested blob when the agent only needs footage metadata.

**Alternatives considered:**

- Only `folderPath` on sources, no tree tool — agents reconstruct poorly (missing empty folders, ordering).
- Tree-only with full source metadata inlined — duplicates and balloons size.
- ASCII tree string — less structured for tooling; JSON nest is better for agents.

### 4. Shared helpers and implementation shape

**Choice:**

- Shared ExtendScript helpers (folder path builder, footage kind classifier) in a small shared module or duplicated carefully across scripts — prefer one shared string fragment imported by inventory scripts.
- TypeScript: `src/inventory/list-sources.ts`, `list-folders.ts`, extend `list-comps-script.ts` for source refs; register tools in `server.ts` like `ae_list_comps`.
- Validate/normalize lightly in TS (ensure arrays exist); primary shape comes from ExtendScript JSON.

**Why:** Matches the proven comps inventory pattern; keeps host transport unchanged.

### 5. Errors

**Choice:** Same as comps inventory:

- No project / host unavailable → structured tool error.
- Empty footage / empty folders → success with empty `sources: []` or a root with empty `children`.

## Risks / Trade-offs

- [Large projects → large `ae_list_sources` / tree JSON] → Mitigation: keep layer `source` compact; tree leaves summary-only; add filters later if needed.
- [Localized `typeName` temptation] → Mitigation: classify with `instanceof CompItem` / `FootageItem` / `FolderItem` and `mainSource` class checks, never locale strings.
- [Root folder naming inconsistency across AE versions] → Mitigation: normalize empty root name to `"Root"`; always return numeric `id`.
- [Missing footage `file` null vs path] → Mitigation: expose both `file` and `missingFootagePath` + `footageMissing`.
- [Agents confuse footage id with layer id] → Mitigation: tool descriptions stress `Item.id` vs `Layer.id` namespaces.

## Migration Plan

1. Extend list-comps script + unit tests for `source` presence/absence.
2. Add list-sources + list-folders scripts, tools, unit tests with mocked eval JSON.
3. Gated AE integration against fixture project (footage + nested folders).
4. Update README tool table and lookup examples (`itemById`).

Rollback: remove new tool registrations and revert list-comps source field; no data migrations.

## Open Questions

1. Whether optional filters (`folderId`, `footageKind`) should land in the same change if the fixture project is already large (default: no — add when needed).
2. Whether `usedInCompIds` is worth the extra AE walk on huge projects (default: yes for v1; drop if integration shows cost).
