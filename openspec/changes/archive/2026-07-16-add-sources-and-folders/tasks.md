## 1. Shared inventory helpers

- [x] 1.1 Extract shared ExtendScript helpers for folder path building (`parentFolderId` + `folderPath`) and `footageKind` classification (`file` / `solid` / `placeholder`) reusable by comps, sources, and folders scripts
- [x] 1.2 Add a compact `serializeSourceRef(avItem)` helper used by layer inventory (id, name, type, footageKind when applicable, folder fields)

## 2. Enrich `ae_list_comps` with layer sources

- [x] 2.1 Extend `list-comps-script` so layers with `AVLayer.source` include the compact `source` object; omit `source` when null/absent
- [x] 2.2 Update unit tests for list-comps payload shape (source present on footage/precomp layers; omitted on camera/light/etc.)
- [x] 2.3 Update `ae_list_comps` tool description to mention the `source` join key (`Item.id`)

## 3. `ae_list_sources` tool

- [x] 3.1 Add ExtendScript + TypeScript module that inventories all `FootageItem`s with metadata from the design (`footageKind`, dimensions, paths, solid color, `usedInCompIds`, folder fields)
- [x] 3.2 Register `ae_list_sources` in `src/server.ts` (no required args); wire through the existing host eval bridge
- [x] 3.3 Unit-test sources payload shape with mocked eval JSON (file / solid / placeholder / missing footage cases)

## 4. `ae_list_folders` tool

- [x] 4.1 Add ExtendScript + TypeScript module that walks `app.project.rootFolder` into the nested tree shape (folder nodes + compact footage/comp leaves)
- [x] 4.2 Register `ae_list_folders` in `src/server.ts`; normalize empty root name to `"Root"`
- [x] 4.3 Unit-test nested folder tree shape with mocked eval JSON (nested folders, empty folders, mixed children)

## 5. Integration tests and docs

- [x] 5.1 Extend gated AE integration coverage (or fixture project) to assert layer `source` refs, `ae_list_sources` ids/metadata, and `ae_list_folders` hierarchy
- [x] 5.2 Update README tool table with `ae_list_sources` / `ae_list_folders`, document `itemById` lookup, and note `Item.id` vs `Layer.id`
