## Context

`ae_eval_script` only rejects empty source today (`validateScriptSource`). First-party emit already uses `scripts/ae-script-compat.mjs` (sanitize + ES3 parse + undeclared-globals). Agents writing modern JS burn host latency and get cryptic AE errors. The product skill shows ES3-ish examples but does not document the dialect. Specs currently call caller-supplied eval “opaque” and out of scope for the first-party ES3 authoring gate.

## Goals / Non-Goals

**Goals:**

- Teach agents a compact ExtendScript dialect via a skill reference under `drive-after-effects`.
- Refuse non-ES3 syntax (and related sanitize hazards) on `ae_eval_script` **before** After Effects runs.
- Soft-detect common ES5+ APIs that parse as ES3 but fail at runtime; do not refuse solely for those hits.
- Reuse the existing compat machinery; keep one escape hatch (no `ae_eval_ts`).

**Non-Goals:**

- Transpile / downlevel / Babel / esbuild for agent scripts.
- Inject ES5 Array/Object polyfills into `wrapExtendScript`.
- Run undeclared-globals analysis on agent scripts.
- Typecheck agent snippets against Types-for-Adobe.
- Change wrap/result-file protocol or JSON polyfill injection.
- A second product skill or second eval tool.

## Decisions

### D1 — Skill reference, not a second skill

Add `skills/drive-after-effects/references/extendscript.md` (SEP-2640 path `skill://drive-after-effects/references/extendscript.md`). Keep the “exactly one end-user skill” contract. Cross-link from `SKILL.md` step 10 (eval escape hatch) and Gotchas.

**Alternatives:** Second skill (`write-extendscript`) — clearer trigger, but relaxes the single-skill requirement and index/instructions. Tool-description-only — too easy to ignore and hard to keep complete.

### D2 — Agent-safe validation subset (hard refuse)

New export (e.g. `validateAgentExtendScript(source)`) shared from `ae-script-compat`:

1. Trim; reject empty (existing behavior).
2. Reject compiler-directive comments (`// @…`, `/// <reference`).
3. Reject non-ASCII bytes (do not silently `?`-replace agent source — corruption is worse than refuse).
4. Apply trailing-comma strip for the candidate to evaluate (same as first-party sanitize for commas only).
5. `acorn` parse with `ecmaVersion: 3` and `allowReturnOutsideFunction: true`; on failure → refuse with a message that names ExtendScript/ES3 and points at `var` / `function` / `for` and the skill reference URI.
6. Do **not** run undeclared-globals / eslint-scope checks.

Evaluate the **comma-stripped** source (not the raw string) so trailing commas are fixed rather than refused when that is the only issue.

**Alternatives:** Full `assertExtendScriptCompatible` — too strict (globals). Silent full `sanitizeExtendScript` including non-ASCII replace — mutates agent intent. Syntax-only warn-and-proceed — still wastes host calls.

### D3 — Soft denylist (warn, do not refuse alone)

Scan the candidate source for a small fixed list of common footguns (string heuristics / simple regex on property access and `Object.assign`), e.g. `.map(`, `.filter(`, `.find(`, `.findIndex(`, `.includes(`, `.flat(`, `.flatMap(`, `Object.assign(`, `Object.entries(`, `Object.keys(` is OK in ES3… actually `Object.keys` exists in some ExtendScript builds — stick to clearly missing ES5 array methods and `Object.assign` / `Array.from` / `String.prototype.startsWith` etc.).

- When **hard-refusing** for syntax/directives/non-ASCII: append any denylist hits to the error text.
- When syntax is valid and only denylist hits: **still evaluate**; do not change the success payload shape (agents often `JSON.parse` the result). Teaching for this case lives in the skill reference + `ae_eval_script` tool description.

**Alternatives:** Hard-refuse denylist — clearer but false positives (e.g. a local function named `map`). Transpile+polyfill — rejected in proposal.

### D4 — Where the logic lives

Agent-safe validation lives in `src/host/extendscript-compat.ts` (imported by `validateScriptSource`) so the published package does not need to ship `scripts/`. `acorn` is a production dependency. First-party `assertExtendScriptCompatible` (including undeclared-globals) remains build-time in `scripts/ae-script-compat.mjs`.

**Alternatives:** Keep agent validation in `scripts/ae-script-compat.mjs` and add that file to npm `files` — rejected because `scripts/` is not part of the published package surface and would also pull `eslint-scope` unless split.

### D5 — Docs / contract surface

- Expand `ae_eval_script` description: ES3 dialect, hard refuse on modern syntax, JSON polyfill, link/pointer to skill reference.
- Brief note in `docs/mcp-tools.md`.
- Amend typed-authoring spec so escape-hatch pre-flight is allowed without requiring the AE TS project.

## Risks / Trade-offs

- **[Risk] False refuse on rare valid ExtendScript extensions** → Mitigation: ES3 parse is the Adobe baseline; allow `allowReturnOutsideFunction`; no globals check; keep denylist soft.
- **[Risk] Denylist false positives / false negatives** → Mitigation: soft-only; small list; skill teaches the real rule (“no ES5 Array extras”).
- **[Risk] Agents ignore skill reference** → Mitigation: refuse messages must be actionable without opening the skill; skill is reinforcement.
- **[Risk] Line numbers in AE errors refer to wrapped body** → Mitigation: unchanged from today; out of scope (no source maps).
- **[Trade-off] Soft denylist won’t stop `.map` before AE** → Accepted; hard syntax gate stops the larger class (`const`, arrows); skill covers APIs; revisit hard-refuse methods only with evidence.

## Migration Plan

- Additive validation on existing tool — no MCP rename.
- Scripts that already send valid ExtendScript keep working (trailing commas auto-stripped).
- Scripts that sent modern syntax start getting `isError` validation text instead of AE parse errors — improvement, not a silent behavior change for successful scripts.
- Rollback: revert validation call; skill reference can remain as docs-only.

## Open Questions

- None blocking. Denylist exact membership can be tuned in implementation/tests without further design.
