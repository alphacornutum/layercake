## ADDED Requirements

### Requirement: Layer source reference

Each listed layer that has an After Effects `AVLayer.source` MUST include a compact `source` object so agents can join layers to project items without a separate inventory call. Layers without a source MUST omit the `source` field.

#### Scenario: Footage or precomp source present

- **WHEN** a layer has a non-null `source` AVItem
- **THEN** the layer payload MUST include `source` with `id` (that item’s `Item.id`), `name`, `type` (`"footage"` or `"comp"`), `parentFolderId`, and `folderPath`

#### Scenario: Footage kind on footage sources

- **WHEN** a layer’s source is a `FootageItem`
- **THEN** `source.footageKind` MUST be one of `file`, `solid`, or `placeholder`

#### Scenario: Comp source omits footageKind

- **WHEN** a layer’s source is a `CompItem`
- **THEN** `source.type` MUST be `"comp"` and `source` MUST NOT require a `footageKind` field

#### Scenario: No source on non-AV or sourceless layers

- **WHEN** a layer has no source (for example camera, light, or text with null source)
- **THEN** the layer payload MUST omit the `source` field

#### Scenario: Source ref stays compact

- **WHEN** a layer includes `source`
- **THEN** that object MUST NOT be required to embed full media metadata such as filesystem `file` path or `solidColor` (those belong to `ae_list_sources`)
