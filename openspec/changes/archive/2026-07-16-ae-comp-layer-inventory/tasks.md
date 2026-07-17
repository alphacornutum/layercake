## 1. Inventory script

- [x] 1.1 Add an ExtendScript inventory module that walks project items, selects `CompItem`s, and serializes the nested JSON shape from the design (comp + layer fields)
- [x] 1.2 Implement layer type classification (`camera`, `light`, `text`, `shape`, `null`, `adjustment`, `guide`, `av`, `other`) and `hasEffects` via the Effects property group
- [x] 1.3 Support optional `compIds` / `compNames` filters (union match) and a `missing` report for unmatched filter entries
- [x] 1.4 Fail clearly when `Layer.id` is unavailable (AE &lt; 22) or when no project is open

## 2. MCP tool

- [x] 2.1 Register `ae_list_comps` in `src/server.ts` with Zod schema for optional `compIds` / `compNames`
- [x] 2.2 Wire the tool through the existing host eval bridge; parse/validate JSON and return it as the tool result
- [x] 2.3 Document in the tool description: stable `id` vs ephemeral `index`, `label` as UI label color index (0–16), and that folded/twirl state is not available

## 3. Tests and docs

- [x] 3.1 Unit-test inventory filter/`missing` behavior and payload shape using mocked eval results (no AE required)
- [x] 3.2 Add a gated AE integration case that opens a fixture project, calls `ae_list_comps`, and asserts comps/layers/ids are present
- [x] 3.3 Update README tool table with `ae_list_comps` usage and the `layerById` / `compById` ExtendScript lookup pattern
