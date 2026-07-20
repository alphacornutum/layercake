## MODIFIED Requirements

### Requirement: Documented operator product scope

Operator-facing documentation (README) MUST state that host control runs on macOS and Windows. It MUST state that typed project mutations go through `ae_patch_project` (including operations such as text style, Project panel create/move/delete, and `rename_layer`) with explicit persistence via `ae_save_project`, and that `ae_eval_script` remains the escape hatch for one-off or unsupported edits. These facts MAY appear under plain-language section titles and MAY be brief when fuller explanation lives in linked `docs/` pages.

#### Scenario: Host platform constraint visible to operators

- **WHEN** an operator reads the project README requirements or equivalent top-level constraints
- **THEN** the documentation MUST state that After Effects host control is supported on macOS and Windows

#### Scenario: Mutation scope visible to operators

- **WHEN** an operator reads the project README capability or limitations section (or equivalent)
- **THEN** the documentation MUST mention typed `ae_patch_project` mutation (including layer rename among supported ops) and explicit save, and MUST NOT claim that dedicated mutation tools are out of scope or that `ae_eval_script` is the only mutation path

## ADDED Requirements

### Requirement: README advertises verified patch evidence

The project README MUST briefly state that successful typed patch results include verified before/after evidence (post-condition checks), with fuller detail deferred to linked docs (for example `docs/mcp-tools.md`).

#### Scenario: Verified evidence mentioned

- **WHEN** an operator reads the README capability summary for patching
- **THEN** the documentation MUST indicate that patch results report verified before/after evidence (not only that a write was attempted)
