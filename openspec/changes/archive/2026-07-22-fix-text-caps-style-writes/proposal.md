## Why

`set_text_style` already allowlists `allCaps` / `smallCaps` booleans, but Adobe marks those attributes read-only since AE 24 — writes must go through `TextDocument.fontCapsOption`. Direct boolean assignment fails or no-ops on supported hosts, so Audit/template policy cannot reliably enforce capitalization via the typed bag. LayerCake also lacks a clear supported After Effects version floor.

## What Changes

- Fix `set_text_style` apply so supplied `allCaps` / `smallCaps` write via `fontCapsOption` (merge omitted sibling from current authored state, then encode the four-value enum).
- Keep the public style bag and inspect/evidence projection as booleans only — do **not** expose `fontCapsOption`.
- Post-condition and evidence continue to use authored `allCaps` / `smallCaps`.
- Document **After Effects 26+** as the supported baseline (README badge + Requirements); older versions may work but are unsupported. Align setup examples to AE 2026 where they currently say 2025.
- Add host coverage for the four caps modes (unit coverage for schema/apply-script presence).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ae-project-patch`: Clarify caps write semantics for `allCaps` / `smallCaps` (internal `fontCapsOption` mapping; merge partial pair; boolean-only public surface).

## Impact

- `src/inventory/text-document-script.ts` (apply/read helpers)
- Patch schema unchanged (booleans already present)
- `docs/mcp-tools.md`, root `README.md`, `docs/setup.md` / `.env.example` examples as needed for AE 26+
- Host tests in `tests/editing.ae.test.ts`; unit asserts in `tests/patch.test.ts`
- Operators / agents: caps patches that previously silently failed should succeed on AE 26+; no JSON shape change
