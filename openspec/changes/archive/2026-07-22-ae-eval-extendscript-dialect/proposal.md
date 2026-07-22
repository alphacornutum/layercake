## Why

Agents using `ae_eval_script` often submit modern JavaScript (`const`/`let`, arrow functions, `Array.map`, optional chaining) that After Effects’ ExtendScript host cannot parse or run. Failures waste host round-trips and produce opaque AE errors. First-party scripts already pass an ES3 compatibility gate; the escape hatch does not teach the dialect or refuse bad syntax before evaluation.

## What Changes

- Add a compact ExtendScript dialect reference under the existing `drive-after-effects` product skill (not a second skill), and point agents at it when using `ae_eval_script`.
- Pre-validate `ae_eval_script` source with an **agent-safe subset** of the existing AE script compatibility gate: hard refuse on non-ES3 syntax and ES3-illegal trailing commas (after the same ASCII/directive sanitize used for first-party emit) **before** invoking After Effects.
- Soft-warn (do not refuse solely for) a small denylist of common ES5+ APIs that survive ES3 parse but fail at runtime (e.g. `.map`, `.filter`, `.find`, `.includes`, `Object.assign`).
- Surface clear validation errors that steer agents toward ExtendScript idioms (`var`, `function`, `for` loops) and the skill reference.
- Update `ae_eval_script` tool description / operator docs as needed so the dialect contract is visible without relying only on the skill.
- **No** `ae_eval_ts` / transpile / ES5 polyfill injection into the eval wrap.
- **No** undeclared-globals check on agent scripts (too strict for free-form eval).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `extendscript-execution`: Require pre-eval dialect validation (hard refuse syntax / trailing commas; soft-warn ES5+ method denylist) without changing the wrap/result-file protocol or JSON polyfill behavior.
- `ae-product-skill`: Require a compact dialect reference under `drive-after-effects` and skill guidance that points agents to it for `ae_eval_script`.
- `typed-extendscript-authoring`: Narrow the “caller-supplied eval remains opaque / out of scope” clause so agent-safe pre-flight validation is allowed, while keeping full first-party emit gates (including undeclared globals) separate from the escape hatch.

## Impact

- `src/host/script-wrapper.ts` / `validateScriptSource` (or adjacent helper): call into shared compat logic before `host.evalScript`.
- `scripts/ae-script-compat.mjs` (and typings): export an agent-safe validation path reusable from Node runtime (not build-only).
- `src/server.ts`: richer `ae_eval_script` description; pass through validation errors as `isError` text.
- `skills/drive-after-effects/` (+ synced `.ai/src` skill if mirrored): new `references/extendscript.md` (or equivalent) and SKILL.md cross-links.
- Unit tests for refuse/warn cases; operator docs (`docs/mcp-tools.md`) brief note.
- No new MCP tool; no change to inventory/patch first-party emit beyond sharing compat helpers.
