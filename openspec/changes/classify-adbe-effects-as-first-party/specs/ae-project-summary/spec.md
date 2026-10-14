# Spec Delta

## MODIFIED Requirements

### Requirement: First-party effect classification

First-party classification MUST treat effect match names beginning with `ADBE` as first-party, and MUST also use the vendored After Effects Scripting Guide first-party effects corpus (`matchnames/effects/firstparty.md` or a generated artifact extracted from it) to recognize listed match names that do not begin with `ADBE`. Match names that satisfy neither rule MUST be classified as `thirdParty`.

#### Scenario: ADBE-prefixed match name is first-party

- **WHEN** a used effect’s `matchName` begins with `ADBE`, whether or not it appears in the first-party allowlist
- **THEN** its `origin` MUST be `firstParty`

#### Scenario: Stock non-ADBE effect is first-party

- **WHEN** a used effect’s `matchName` appears in the first-party allowlist, including non-`ADBE` stock names such as bundled `CC` effects
- **THEN** its `origin` MUST be `firstParty`

#### Scenario: Unknown matchName is third-party

- **WHEN** a used effect’s `matchName` neither begins with `ADBE` nor appears in the first-party allowlist
- **THEN** its `origin` MUST be `thirdParty`
