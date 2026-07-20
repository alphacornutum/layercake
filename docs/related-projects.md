# Related projects and choosing an After Effects MCP

After Effects automation projects often look similar from a distance. They expose MCP tools, send ExtendScript into After Effects, and let an agent manipulate a project.

The important difference is the workflow each project is designed around.

This document compares LayerCake with [Dakkshin/after-effects-mcp](https://github.com/Dakkshin/after-effects-mcp), another open-source MCP server for Adobe After Effects. It is not a ranking. Both projects are useful, and they optimize for different jobs.

## The decision in one paragraph

Choose **LayerCake** when the main task is to inspect, understand, validate, or carefully modify an existing After Effects project. It is strongest when project state, dependencies, stable targeting, verification, and explicit save behavior matter.

Choose **after-effects-mcp** when the main task is to create or animate content through a broad set of ready-made commands. It exposes task-specific tools for compositions, text, shapes, solids, cameras, nulls, masks, effects, keyframes, expressions, and common layer properties through a persistent ScriptUI bridge panel.

## Different starting questions

A creation-first tool usually starts with:

> What should After Effects create or change?

LayerCake starts with:

> What is in this project, what state is it in, and how can an agent change it without acting on a stale or ambiguous understanding?

That distinction explains most of the architectural differences.

## Comparison

| Area                     | LayerCake                                                                                                                                  | Dakkshin/after-effects-mcp                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Primary job              | Inspect, understand, validate, and make controlled changes to existing projects                                                            | Create and edit motion-graphics content through ready-made commands                                                                 |
| Typical first action     | Bind project context, summarize health, inventory comps/sources/folders, then inspect a target                                             | Send a command to create or modify a composition, layer, property, effect, or animation                                             |
| After Effects connection | Invokes scripts through AppleScript `DoScriptFile` on macOS or `AfterFX.exe -r` on Windows                                                 | Installs a ScriptUI bridge panel that polls for commands and must remain open with automatic execution enabled                      |
| Panel required           | No                                                                                                                                         | Yes                                                                                                                                 |
| Inspection surface       | Project context, health summary, comp/layer inventory, sources, folders, item references, deep layer property trees, source interpretation | Project information, composition listing, and layer information, with the public feature set primarily centered on editing commands |
| Mutation surface         | A deliberately focused typed patch set plus unrestricted `ae_eval_script` for unsupported work                                             | A broad set of task-specific creation, property, animation, mask, and effect commands                                               |
| State model              | Project path, dirty state, revision, and fingerprint are explicit parts of the workflow                                                    | Command-oriented bridge; the public README focuses on operations rather than project binding                                        |
| Targeting                | Prefers stable `Item.id` and `Layer.id`; unique names are supported with ambiguity refusal                                                 | Uses the parameters defined by each composition or layer command                                                                    |
| Verification             | Typed patches return post-condition-verified before/after evidence                                                                         | Results are returned by the bridge command handlers                                                                                 |
| Save model               | Mutation and persistence are separate; `save_copy` and `create_backup` are explicit operations                                             | Saving is not a central abstraction in the public README                                                                            |
| Scripting support        | Arbitrary ExtendScript plus a locally searchable After Effects Scripting Guide                                                             | Task-specific scripts and a built-in help command                                                                                   |
| Best fit                 | Project forensics, template QA, migrations, structured maintenance, production pipelines                                                   | Interactive authoring, scene construction, animation experiments, direct creative control                                           |

The table describes the public repositories at the time this document was written. Both projects can evolve, so check their current READMEs and tool schemas before making a long-term integration decision.

## Where after-effects-mcp is strong

Dakkshin’s project offers a broad authoring surface out of the box. Its documented tools cover common creative operations such as:

- creating compositions;
- adding text, shape, solid, camera, and null layers;
- changing position, scale, rotation, opacity, timing, 2D/3D state, blend modes, and track mattes;
- adding keyframes and expressions;
- creating masks;
- duplicating and deleting layers;
- applying effects and effect templates;
- changing several layers in a batch.

This is useful when an agent should behave like an active motion-graphics operator and the desired result can be expressed as a sequence of creation and editing commands.

The persistent panel is also understandable to a human operator. Once After Effects and the bridge panel are open, the application is visibly waiting for commands. That can work well for an interactive workstation setup.

## Where LayerCake is strong

### Project forensics

LayerCake can answer questions that come before editing:

- What compositions, layers, sources, and folders exist?
- How are layers connected to source items?
- What are the in point, out point, duration, start time, and stretch values?
- Which properties have expressions or keyframes?
- Is the authored property value different from the evaluated value?
- Which fonts, footage files, or third-party effects are missing?
- What does removing or moving this project item affect?

This makes LayerCake useful for inherited projects, templates, render failures, migrations, audits, and automated quality checks.

### Stateful automation

After Effects is a desktop application with a mutable document open in memory. A human can edit that document while an agent is reasoning about it. Another tool call can change indexes or dirty state. A modal dialog can block execution. An object name may not be unique.

LayerCake makes this state visible. `ae_project_context` returns the current path, dirty state, revision, and fingerprint. Typed patch and save operations can verify that they are still working on the project state the agent inspected.

This does not make desktop automation transactional, but it gives the agent a way to notice when its assumptions are stale.

### Stable targeting

LayerCake distinguishes between After Effects project-item IDs and timeline-layer IDs:

- `Item.id` identifies compositions, footage, folders, and other Project panel items.
- `Layer.id` identifies a layer inside a composition.
- `layer.source.id` connects a layer to its source project item.

Names remain useful for humans, but they can be duplicated. Indexes are convenient, but they change when objects are inserted, removed, or reordered. LayerCake therefore prefers IDs for follow-up work and refuses ambiguous name-based mutation targets.

### Verified typed patches

A LayerCake typed patch is more than a thin wrapper around a property assignment. It can:

1. validate the operation;
2. check the project path and fingerprint;
3. resolve one exact target;
4. apply the change inside an undo group;
5. read the live project again;
6. return before/after evidence only after the requested post-condition is confirmed.

The typed surface covers text style, rename, solids and source replace, frame timing, expressions, layer reset/delete, Project panel ops, and safe delete. It is still narrower than creation-first tools for authoring (keyframes, masks, cameras, effect templates, batch creative commands). Unsupported work can use `ae_eval_script`.

### Explicit persistence

LayerCake separates changing the live project from saving it. Inventory, inspection, raw evaluation, and typed patch calls do not silently persist the project.

`ae_save_project` currently provides two explicit modes:

- `save_copy` performs an After Effects Save As and switches the active project path to the destination.
- `create_backup` copies the clean saved `.aep` file without changing the active session.

This is particularly useful in automated maintenance, where overwriting the source file should be a deliberate decision rather than a side effect.

### No bridge panel

LayerCake invokes scripts through the operating-system integration supported by each platform. The user does not need to install and keep a ScriptUI panel open.

That removes one piece of runtime state from the operator workflow. It also makes the MCP server responsible for checking and reporting the resolved After Effects host configuration.

### Scripting documentation as part of the tool

After Effects scripting is broad, old, and constrained by the ExtendScript ES3 runtime. LayerCake packages the Scripting Guide as a searchable local corpus so the agent can look up the object model before writing a script.

This matters because raw scripting remains the escape hatch for operations that have not yet earned a typed tool.

## Why LayerCake does not optimize for the longest tool list

A broad command library is valuable. LayerCake should continue to gain useful typed operations such as composition creation, keyframes, effects, render-queue control, and preview rendering.

The constraint is that new operations should preserve the project model rather than bypass it. A recurring mutation is a good candidate for a typed tool when LayerCake can define:

- a precise semantic operation;
- stable target resolution;
- clear validation errors;
- project-state guards;
- verified post-conditions;
- explicit persistence behavior;
- tests against real After Effects behavior.

Until then, `ae_eval_script` keeps the system open-ended.

This is the LayerCake trade-off: fewer typed creation commands today, but a stronger contract around inspection and controlled change.

## Common scenarios

### “Build a short motion-graphics scene from scratch”

A creation-first tool such as after-effects-mcp is likely the more direct choice. Its ready-made tools map closely to the requested work.

### “Explain an unfamiliar `.aep` before I touch it”

LayerCake is designed for this. Start with project context and summary, inventory compositions and sources, then inspect specific layers or footage items.

### “Validate hundreds of templates against our rendering conventions”

LayerCake is the stronger base. Its structured inventories, stable IDs, health summary, project fingerprints, and explicit output files are suitable for machine-readable validation workflows.

### “Let an agent perform supervised edits during a design session”

Either approach may work.

Use after-effects-mcp when the edits map to its existing creative commands and the bridge panel fits the workstation workflow. Use LayerCake when the agent must first identify exact targets, inspect expressions or dependencies, and preserve a deliberate audit trail around each change.

### “Automate a production render pipeline”

Neither repository is a complete render orchestration platform by itself.

LayerCake is useful for preflight inspection, template validation, controlled project edits, and future render-queue operations. A full pipeline still needs process supervision, output collection, timeouts, crash recovery, logging, and visual quality assurance.

### “Let two agents control the same After Effects instance”

Do not assume this is safe. LayerCake explicitly assumes a one-agent-to-one-After-Effects session and has no mutex. A file-based command bridge also needs careful request correlation and sequencing under concurrency.

Whichever project you choose, serialize operations against one After Effects session unless you have added a proven coordination layer.

## Can the approaches be combined?

The ideas are complementary, but running two MCP servers against the same live project at the same time can create stale state and conflicting edits.

A safer combination is architectural:

- use LayerCake’s inspection, context binding, stable targeting, verification, and save model;
- add creation-oriented typed operations where the workflow needs them;
- borrow implementation ideas from other open-source projects while keeping LayerCake’s contracts and tests.

A future LayerCake tool for keyframes or effects should not merely expose another command. It should behave like the rest of LayerCake: inspectable, precisely targeted, guarded where possible, verified after application, and explicit about persistence.

## Current LayerCake trade-offs

LayerCake’s strengths come with real limitations:

- The typed mutation surface is still narrower than creation-first authoring libraries.
- Complex creative edits often require agent-generated ExtendScript.
- Raw `ae_eval_script` bypasses typed patch guards and post-condition contracts.
- LayerCake does not visually judge rendered output.
- It assumes one agent controls one After Effects session.
- It can only automate features available through Adobe’s scripting API.
- Desktop automation can still be blocked by modal dialogs, application crashes, plugin behavior, and long-running scripts.

These limits should remain visible in the documentation. The project’s value comes from making difficult state explicit, not from claiming that desktop automation is effortless.

## A practical selection checklist

Use LayerCake when several of these are true:

- The project already exists and may be unfamiliar.
- You need machine-readable inventory or dependency information.
- Expressions, fonts, footage, effects, timing, or source interpretation matter.
- Duplicate names or changing indexes make target selection risky.
- A human may edit the project between agent operations.
- You need before/after evidence.
- Saving a copy or backup must be explicit.
- The work belongs in a repeatable production or validation pipeline.

Use a creation-first MCP when several of these are true:

- The project is new or disposable.
- The main job is constructing a scene.
- You want many ready-made commands for common creative operations.
- A persistent After Effects panel is acceptable.
- Fast interactive authoring matters more than project-state contracts.

## Source projects

- [alphacornutum/layercake](https://github.com/alphacornutum/layercake)
- [Dakkshin/after-effects-mcp](https://github.com/Dakkshin/after-effects-mcp)

This comparison should be updated when either project changes its public architecture or tool surface.
