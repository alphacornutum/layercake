# ExtendScript dialect for `ae_eval_script`

After Effects evaluates **ExtendScript** — an ES3-like dialect, not modern Node or browser JavaScript. LayerCake refuses modern syntax before the host runs. Prefer typed `ae_patch_project` when an op exists.

## Prefer

- `var` (not `const` / `let`)
- `function name() { ... }` (not arrow functions)
- `for (var i = 0; i < n; i++)` (not `.map` / `.filter` / `.forEach` / `.find`)
- `JSON.stringify` / `JSON.parse` — LayerCake injects a polyfill
- Top-level `return` of a value (string or JSON text)
- Lookups by stable `Item.id` / `Layer.id` (see helpers in `SKILL.md`)

## Avoid (refused or will fail in AE)

| Pattern                                        | Why                                     |
| ---------------------------------------------- | --------------------------------------- |
| `const` / `let`                                | Not ES3                                 |
| `=>` arrows                                    | Not ES3                                 |
| `` `template` ``                               | Not ES3                                 |
| `?.` / `??`                                    | Not ES3                                 |
| Trailing commas in `{ a: 1, }`                 | Illegal in ES3 (LayerCake strips these) |
| `.map(` / `.filter(` / `.find(` / `.includes(` | Missing on ExtendScript arrays          |
| `Object.assign(` / `Array.from(`               | Typically missing                       |
| Modal dialogs / long UI                        | Blocks until `AE_SCRIPT_TIMEOUT_MS`     |
| Non-ASCII in source                            | DoScriptFile encoding is unreliable     |
| `// @ts-…` / `/// <reference`                  | Misread as compiler directives          |

## Minimal example

```javascript
var items = app.project.items;
var names = [];
for (var i = 1; i <= items.length; i++) {
  names.push(items[i].name);
}
return JSON.stringify(names);
```

For DOM APIs, use `ae_docs_search` / `ae_docs_get` before inventing method names.
