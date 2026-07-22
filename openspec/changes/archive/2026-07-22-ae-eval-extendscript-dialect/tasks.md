## 1. Agent-safe dialect validation

- [x] 1.1 Export `validateAgentExtendScript` from `src/host/extendscript-compat.ts` (runtime; `acorn` as a production dependency): empty reject, refuse non-ASCII and `// @` / `/// <reference` directives, strip trailing commas for the candidate, ES3 `acorn` parse with `allowReturnOutsideFunction`, **no** undeclared-globals check; return `{ ok, source?, error?, denylistHits? }`
- [x] 1.2 Add a small ES5+ denylist scanner (at least `.map` / `.filter` / `.find` / `Object.assign` patterns); hits never fail alone; include hits in hard-refuse error text when present
- [x] 1.3 Wire validation into `src/host/script-wrapper.ts` (`validateScriptSource` or successor) so callers get the comma-stripped source to evaluate
- [x] 1.4 Ensure `ae_eval_script` in `src/server.ts` uses the validated source, returns dialect errors as `isError` text without calling the host, and expands the tool description for ES3 dialect + skill reference pointer

## 2. Product skill dialect reference

- [x] 2.1 Add `skills/drive-after-effects/references/extendscript.md` with compact forbid/prefer guidance (ES3 dialect, no modern syntax/ES5 Array helpers, `var`/`function`/`for`, JSON polyfill, `return`, no modals)
- [x] 2.2 Link that reference from `skills/drive-after-effects/SKILL.md` in the eval escape-hatch step / Gotchas
- [x] 2.3 Mirror the same reference + SKILL.md links under `.ai/src/skills/drive-after-effects/` so contributor and shipped copies stay aligned

## 3. Tests and docs

- [x] 3.1 Unit tests: refuse `const` / arrows / optional chaining / non-ASCII / directives; strip trailing commas then accept; denylist-alone does not throw; denylist appears in combined refuse message; valid ES3 `var`/`for` accepted
- [x] 3.2 Brief operator note in `docs/mcp-tools.md` for `ae_eval_script` dialect pre-flight (and skill reference)
- [x] 3.3 Run `npm test` (and typecheck/lint as needed); confirm first-party `assertExtendScriptCompatible` / build:ae-scripts behavior unchanged
