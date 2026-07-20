## ADDED Requirements

### Requirement: Composition settings fields on list

Each listed composition MUST include composition settings read from the live session so agents can plan `set_comp_settings` without `ae_eval_script`: `width`, `height`, `pixelAspect`, `frameRate`, integer `durationFrames`, integer `displayStartFrame`, integer `workAreaStartFrame`, integer `workAreaDurationFrames`, `renderer` (current renderer string when readable), and a `switches` object with booleans `motionBlur`, `frameBlending`, `draft3d`, `hideShyLayers`, `dropFrame`, and `preserveNestedResolution`. Existing second-based `duration` MUST remain for compatibility. Integer frame fields MUST be derived using that composition’s `frameRate` (nearest-frame conventions consistent with layer frame helpers).

#### Scenario: Settings present on each composition

- **WHEN** a composition is listed
- **THEN** the composition object MUST include `width`, `height`, `pixelAspect`, `frameRate`, `durationFrames`, `displayStartFrame`, `workAreaStartFrame`, `workAreaDurationFrames`, `renderer` when readable, and the `switches` object with the listed boolean keys

#### Scenario: Seconds duration kept

- **WHEN** a composition is listed
- **THEN** `duration` MUST remain present in seconds alongside `durationFrames`

#### Scenario: Filter still returns settings

- **WHEN** the caller filters with `compIds` or `compNames` and matches succeed
- **THEN** each returned composition MUST still include the composition settings fields
