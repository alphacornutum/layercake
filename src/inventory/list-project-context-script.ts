import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * Lean ExtendScript bind token for ae_project_context.
 * Reads revision, dirty, file path, and app.version only (no health walks).
 */
const LIST_PROJECT_CONTEXT_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function projectPathOf() {
  try {
    if (app.project.file) return app.project.file.fsName;
  } catch (e) {}
  return null;
}

var revision = 0;
try {
  revision = app.project.revision;
} catch (e) {
  throw new Error("Could not read app.project.revision (requires a modern After Effects build).");
}

var dirty = false;
try {
  dirty = !!app.project.dirty;
} catch (e) {
  throw new Error("Could not read app.project.dirty (requires After Effects 17.5+).");
}

return JSON.stringify({
  projectName: projectNameOf(),
  projectPath: projectPathOf(),
  dirty: dirty,
  revision: revision,
  aeVersion: String(app.version)
});
`.trim();

export const LIST_PROJECT_CONTEXT_SCRIPT = `${SHARED_INVENTORY_HELPERS}\n\n${LIST_PROJECT_CONTEXT_BODY}`;
