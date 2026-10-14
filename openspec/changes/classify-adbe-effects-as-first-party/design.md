# Design

## Context

See `proposal.md` for the motivation. The summary will use the `ADBE` prefix as a first-party signal and a generated fallback allowlist for known first-party names that do not use that prefix.

## Goals / Non-Goals

**Goals:**

- Keep effect-origin classification deterministic and local to the match name.
- Preserve recognition for stock effects whose match names use other prefixes or names, without retaining redundant `ADBE` entries in the runtime fallback list.

**Non-Goals:**

- Change the summary response shape or effect availability detection.
- Identify plugin vendors or resolve ambiguous names through the host.

## Decisions

- Classify a match name as first-party when it starts with `ADBE` or is present in the generated fallback allowlist. This preserves known non-`ADBE` built-ins such as `CC` effects.
- Keep the vendored guide corpus unchanged, but have its generator omit `ADBE`-prefixed names from the runtime fallback list. The output is intentionally a filtered projection of the corpus so the runtime list contains only names not already covered by the prefix rule.
- Add unit coverage for an unlisted `ADBE` name, a known non-`ADBE` stock name, an unknown non-`ADBE` name, and the generated fallback list excluding `ADBE` entries.

## Risks / Trade-offs

- A third-party effect could use an `ADBE`-prefixed match name and be reported as first-party. The contract intentionally accepts this trade-off by treating that prefix as sufficient evidence of a native Adobe feature.
- First-party classifications may change for existing projects containing unlisted `ADBE` effects; the summary payload remains compatible, but `origin` and `hasThirdPartyEffects` can change.
