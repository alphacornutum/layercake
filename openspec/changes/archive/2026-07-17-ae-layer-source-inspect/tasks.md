## 1. Types, config, and ExtendScript helpers

- [x] 1.1 Add TypeScript result/input types for layer and source inspect (detail enums, lookup args, unserializable value shape, ambiguity error payload)
- [x] 1.2 Add `AE_INSPECT_MAX_BYTES` to config (default 524288) and `.env.example`; shared helper to enforce UTF-8 JSON size with a hard error (size, limit, narrow guidance)
- [x] 1.3 Add shared ExtendScript helpers for id/name resolution with not-found and ambiguity candidate lists (comp, layer, footage)
- [x] 1.4 Add shared PropertyGroup walk + best-effort value/keyframe/expression serializers (`overview` / `extended` / `full`, `matchNames`, `unserializable` flag)

## 2. `ae_get_layer`

- [x] 2.1 Implement `get-layer-script.ts` + `get-layer.ts` (resolve target, walk properties, echo `detail` / `atTime` / `preExpression`, enforce size limit)
- [x] 2.2 Register `ae_get_layer` in `src/server.ts` with Zod schema and an agent-facing description that documents tiers, expressions, lookup, `unserializable`, and size limit
- [x] 2.3 Unit-test parse/serialize fixtures for overview vs extended vs full, matchNames scoping, unserializable values, and over-limit hard error

## 3. `ae_get_source`

- [x] 3.1 Implement `get-source-script.ts` + `get-source.ts` (`overview` vs `full` interpret/proxy dump, enforce size limit)
- [x] 3.2 Register `ae_get_source` in `src/server.ts` with Zod schema and description documenting tiers, id-or-name lookup, and size limit
- [x] 3.3 Unit-test source inspect fixtures for overview/full, lookup validation errors, and over-limit hard error

## 4. Docs and verification

- [x] 4.1 Update README MCP tool table/sections for `ae_get_layer` / `ae_get_source` (tiers, how to get full expressions, interpret `full`, ambiguity errors, `AE_INSPECT_MAX_BYTES`)
- [x] 4.2 Add or extend gated AE host tests when env/fixture available; otherwise keep unit coverage green
- [x] 4.3 Run `npm run typecheck && npm run lint && npm test`
