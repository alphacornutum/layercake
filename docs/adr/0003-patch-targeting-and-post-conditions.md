# Id-or-name targeting, post-condition verification, and typed patch norms

Layer-targeting patch ops (`rename_layer`, `set_text_style` layer/comp selectors) resolve compositions and layers with the same id-or-name rules as `ae_get_layer`: exactly one selector per axis, case-sensitive exact names, ambiguous names refuse before mutation with candidate lists. Shared ExtendScript helpers live in `src/inventory/resolve-script.ts` so inspect and patch stay aligned. After every mutating write, apply re-reads the affected live field(s) and reports `changed` only when the post-condition matches; failed targets still include the actual re-read `after` when readable. For `set_text_style`, font post-reads use the pre-expression `TextDocument` (`valueAtTime(..., true)` when keys/expressions apply); success depends on authored `fonts` only. Evidence may also include `evaluatedFonts` (post-expression at composition time) so agents can see residual expression override without failing the authored post-condition. Persistence stays composed (`ae_patch_project` never saves; agents sequence optional `save_copy`/`create_backup` separately). New ops use semantic verbs and op-specific field names (no shared `value` bag); existing names like `set_text_style` stay.

## Status

accepted

## Considered options

- **Id-only patch selectors** — Rejected; agents already resolve by unique name in inspect, and template rename flows often start from names.
- **Mega-tool bundling patch + save + verify** — Rejected; hides composition and fights thin MCP primitives.
- **Shared `value` / bland `set_*` for every op** — Rejected for new ops; prefer domain verbs (`rename_layer`) and explicit fields (`layerName`, `style.font`).
- **Fire-and-forget mutation evidence** — Rejected; agents need verified before/after to prove compliance (e.g. mustache renames).

## Consequences

- Prefer stable ids when names may collide; name-based targets are for unique matches only.
- AE allows duplicate layer names — LayerCake does not enforce uniqueness on rename.
- README / `docs/mcp-tools.md` advertise verified before/after evidence; skill documents copy-first when the original must stay pristine.
