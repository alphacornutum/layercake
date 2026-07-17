import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import type { AeHost } from "../host/types.js";
import { listProjectContext } from "../inventory/list-project-context.js";
import { pathsMatch } from "../inventory/fingerprint.js";
import type { ProjectContext } from "../inventory/types.js";

export type SaveMode = "save_copy" | "create_backup";

export type SaveProjectInput = {
  mode: SaveMode;
  expectedFingerprint: string;
  /** Absolute destination for save_copy; optional override for create_backup. */
  path?: string;
  allowOverwrite?: boolean;
  /** Absolute path guard for the open project. */
  projectPath?: string;
};

export type SaveProjectSuccess = {
  ok: true;
  mode: SaveMode;
  writtenPath: string;
  activePathChanged: boolean;
  activeProjectPath: string | null;
  fingerprint: string;
  dirty: boolean;
  revision: number;
};

export type SaveProjectFailure = {
  ok: false;
  error: string;
  code:
    | "stale_fingerprint"
    | "path_mismatch"
    | "overwrite_refused"
    | "validation"
    | "save_failed"
    | "no_project";
  context?: ProjectContext;
};

export type SaveProjectResult = SaveProjectSuccess | SaveProjectFailure;

function escapeExtendScriptStringLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function timestampSlug(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Save to dest via AE. When restoreOriginalPath is set, save back to that path
 * so the active project stays bound (AE has no true "save a copy").
 */
function buildSaveScript(destPath: string, restoreOriginalPath: string | null): string {
  const dest = escapeExtendScriptStringLiteral(destPath);
  const restore =
    restoreOriginalPath === null
      ? "null"
      : `"${escapeExtendScriptStringLiteral(restoreOriginalPath)}"`;
  return `
if (!app.project) {
  throw new Error("No After Effects project is open.");
}
var dest = new File("${dest}");
var beforePath = null;
try {
  if (app.project.file) beforePath = app.project.file.fsName;
} catch (e) {}
app.project.save(dest);
var restorePath = ${restore};
if (restorePath) {
  app.project.save(new File(restorePath));
}
var activePath = null;
try {
  if (app.project.file) activePath = app.project.file.fsName;
} catch (e2) {}
return JSON.stringify({
  writtenPath: dest.fsName,
  activeProjectPath: activePath,
  beforePath: beforePath
});
`.trim();
}

export async function saveProject(
  host: AeHost,
  input: SaveProjectInput,
  options: { artifactDir: string; timeoutMs: number },
): Promise<SaveProjectResult> {
  if (input.mode !== "save_copy" && input.mode !== "create_backup") {
    return {
      ok: false,
      error: `Unsupported save mode ${JSON.stringify(input.mode)}. Use save_copy or create_backup.`,
      code: "validation",
    };
  }

  let context: ProjectContext;
  try {
    context = await listProjectContext(host, options.timeoutMs);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "no_project",
    };
  }

  if (input.expectedFingerprint !== context.fingerprint) {
    return {
      ok: false,
      error: `Stale fingerprint for save. expected=${input.expectedFingerprint} current=${context.fingerprint}`,
      code: "stale_fingerprint",
      context,
    };
  }

  if (input.projectPath !== undefined) {
    if (!pathsMatch(input.projectPath, context.projectPath)) {
      return {
        ok: false,
        error: "Project path mismatch. Open project path does not match the guard path.",
        code: "path_mismatch",
        context,
      };
    }
  }

  let destPath: string;
  if (input.mode === "save_copy") {
    if (!input.path || !isAbsolute(input.path)) {
      return {
        ok: false,
        error: "save_copy requires an absolute destination path.",
        code: "validation",
        context,
      };
    }
    destPath = input.path;
  } else if (input.path) {
    if (!isAbsolute(input.path)) {
      return {
        ok: false,
        error: "create_backup path override must be absolute.",
        code: "validation",
        context,
      };
    }
    destPath = input.path;
  } else {
    mkdirSync(options.artifactDir, { recursive: true });
    const base =
      context.projectPath !== null
        ? context.projectPath.replace(/^.*[\\/]/, "").replace(/\.aepx?$/i, "")
        : "project";
    destPath = join(options.artifactDir, `${base}-backup-${timestampSlug()}.aep`);
  }

  if (existsSync(destPath) && !input.allowOverwrite) {
    return {
      ok: false,
      error: `Destination exists and allowOverwrite is not true: ${destPath}`,
      code: "overwrite_refused",
      context,
    };
  }

  const parent = destPath.replace(/[\\/][^\\/]+$/, "");
  if (parent && parent !== destPath) {
    mkdirSync(parent, { recursive: true });
  }

  // Clean on-disk project: filesystem copy keeps the AE session on the original path.
  if (
    input.mode === "create_backup" &&
    !context.dirty &&
    context.projectPath !== null &&
    existsSync(context.projectPath)
  ) {
    copyFileSync(context.projectPath, destPath);
    const afterCopy = await listProjectContext(host, options.timeoutMs);
    return {
      ok: true,
      mode: input.mode,
      writtenPath: destPath,
      activePathChanged: false,
      activeProjectPath: afterCopy.projectPath,
      fingerprint: afterCopy.fingerprint,
      dirty: afterCopy.dirty,
      revision: afterCopy.revision,
    };
  }

  // AE save(file) switches the active project; restore original path when we have one
  // so create_backup / save_copy can keep the session bound to the caller's project.
  const restoreOriginal =
    input.mode === "create_backup" && context.projectPath !== null
      ? context.projectPath
      : input.mode === "save_copy" && context.projectPath !== null
        ? context.projectPath
        : null;

  // save_copy: write to dest and stay on dest (normal Save As). create_backup: restore.
  const restorePath = input.mode === "create_backup" ? restoreOriginal : null;

  const script = buildSaveScript(destPath, restorePath);
  const result = await host.evalScript(script, options.timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    return {
      ok: false,
      error: `${result.error}${line}`,
      code: "save_failed",
      context,
    };
  }

  let writtenPath = destPath;
  try {
    const parsed = JSON.parse(result.result) as { writtenPath?: string };
    if (parsed.writtenPath) writtenPath = parsed.writtenPath;
  } catch {
    // keep default
  }

  const after = await listProjectContext(host, options.timeoutMs);
  return {
    ok: true,
    mode: input.mode,
    writtenPath,
    activePathChanged: !pathsMatch(context.projectPath, after.projectPath),
    activeProjectPath: after.projectPath,
    fingerprint: after.fingerprint,
    dirty: after.dirty,
    revision: after.revision,
  };
}
