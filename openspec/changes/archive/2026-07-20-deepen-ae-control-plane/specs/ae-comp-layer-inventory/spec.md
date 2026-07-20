## ADDED Requirements

### Requirement: Extended layer control-plane fields

Each listed layer MUST additionally include control-plane fields read from the live session so agents can audit order, switches, parenting/mattes, and frame-exact timing without a deep property inspect: `startTime` (seconds); integer `startFrame`, `inFrame`, `outFrame`, and `durationFrames` derived using the containing composition’s `frameRate`; boolean switches `enabled`, and when applicable `hasVideo`/`videoEnabled`, `hasAudio`/`audioEnabled`, `guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, `frameBlendingType` or equivalent frame-blending flag, and `timeRemapEnabled`; optional `parentLayerId`; optional track-matte fields (`trackMatteType` and `trackMatteLayerId` when a matte applies). Existing second-based `inPoint` / `outPoint` / `duration` MUST remain for compatibility.

#### Scenario: Frame timing alongside seconds

- **WHEN** a layer is listed in a composition with a known `frameRate`
- **THEN** the payload MUST include `inPoint`/`outPoint`/`duration` in seconds as today and MUST also include integer `inFrame`/`outFrame`/`durationFrames` (and `startFrame` for `startTime`) consistent with that frame rate

#### Scenario: Switches present

- **WHEN** a layer is listed
- **THEN** the payload MUST include `enabled` and MUST include applicable switch fields (`guideLayer`, `adjustmentLayer`, `threeDLayer`, `collapseTransformation`, frame blending, `timeRemapEnabled`) using false/omit rules that do not invent unsupported attributes on layer types that lack them

#### Scenario: Parent and track matte ids

- **WHEN** a layer has a parent layer or an active track matte
- **THEN** the payload MUST include `parentLayerId` and/or track-matte fields with stable `Layer.id` values for the related layers

#### Scenario: No parent or matte

- **WHEN** a layer has no parent and no track matte
- **THEN** the payload MUST omit those optional fields or set them null per the published schema, and MUST NOT invent fake ids

### Requirement: Solid source kind remains inspectable from list

For layers whose source is a Solid footage item, `source.footageKind` MUST equal `"solid"` so agents can prove direct Solid-sourced control layers from `ae_list_comps` alone.

#### Scenario: Solid-sourced layer

- **WHEN** a listed AV layer’s source `mainSource` is a `SolidSource`
- **THEN** `source.type` MUST be `"footage"` and `source.footageKind` MUST be `"solid"`
