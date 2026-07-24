## Context

`wrapExtendScript` evaluates caller source inside an IIFE and writes `OK\n` + `String(completionValue)` to a result file. `undefined`/`null` are coerced to `""`, so MCP reports success with an empty text body even when the script ran and mutated the project. Agents pasting full-file IIFEs that only `return` _inside_ the IIFE hit this and mis-diagnose it as truncation or a multi‑KB host limit. Inspect tools have an explicit `AE_INSPECT_MAX_BYTES` gate; eval does not. This change documents that contract only—no preflight or protocol change.

## Goals / Non-Goals

**Goals:**

- Make the wrap completion-value / top-level `return` rule unambiguous in `extendscript-execution`, operator docs, and the product skill ExtendScript reference.
- State clearly that empty success is normal for void / side-effect-only scripts.
- State clearly that LayerCake does not impose an `ae_eval_script` result size limit (and point at inspect’s separate limit when contrasting).
- Show the bare-IIFE vs `return (function…)` good/bad pattern so measure scripts stop looking like host bugs.

**Non-Goals:**

- No dialect preflight refuse for bare IIFEs (void IIFEs remain valid).
- No fail-closed on empty `OK` bodies.
- No result-file protocol change (no undefined vs `""` distinction at the Node boundary).
- No eval size limit, streaming, or first-class `resultPath` API.
- No `ARCHITECTURE.md` updates (ownership unchanged).

## Decisions

1. **Docs + contract only** — Codify existing wrap behavior rather than changing the host. Alternatives considered: refuse bare trailing IIFEs (rejected—punishes void scripts); refuse empty OK (rejected—same); refuse IIFE-with-inner-`return` heuristic (deferred—useful later, out of scope for docs-only); auto-inject outer `return` (rejected—too surprising).

2. **ADDED documentation requirements** — Prefer ADDED requirements on `extendscript-execution` and `ae-product-skill` rather than MODIFIED runtime eval scenarios, so archive sync records the teaching contract without rewriting “successful evaluation” semantics (empty string remains a valid success payload).

3. **Canonical skill path** — Edit `.ai/src/skills/drive-after-effects/references/extendscript.md` (and SKILL pointer if needed), then `agentsync sync`. Operator docs: `docs/mcp-tools.md` + `docs/troubleshooting.md`. Optional one-liner on the `ae_eval_script` tool description in `src/server.ts` for discoverability.

4. **Contrast inspect limit explicitly** — Mention `AE_INSPECT_MAX_BYTES` only to prevent agents from assuming the same gate applies to eval.

## Risks / Trade-offs

- **[Risk] Agents still paste bare IIFEs** → Mitigation: explicit good/bad examples in skill reference + troubleshooting symptom (“empty success + dirty project”).
- **[Risk] Docs-only leaves the footgun runnable** → Accepted; product chose not to refuse void scripts or empty OK. Future change MAY add a precise preflight if this keeps recurring.
- **[Trade-off] Spec grows without runtime tests** → Acceptable; scenarios are reviewable against docs/skill text.
