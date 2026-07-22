import { projectNameOf } from "../shared/inventory";

function projectPathOf(): string | null {
  try {
    if (app.project.file) return app.project.file.fsName;
  } catch (_e) {}
  return null;
}

export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }

  let revision = 0;
  try {
    revision = (app.project as any).revision;
  } catch (_e) {
    throw new Error("Could not read app.project.revision (requires a modern After Effects build).");
  }

  let dirty = false;
  try {
    dirty = !!(app.project as any).dirty;
  } catch (_e) {
    throw new Error("Could not read app.project.dirty (requires After Effects 17.5+).");
  }

  return JSON.stringify({
    projectName: projectNameOf(),
    projectPath: projectPathOf(),
    dirty: dirty,
    revision: revision,
    aeVersion: String(app.version),
  });
}
