import { isAbsolute } from "node:path";

import { listProjectContext } from "../inventory/list-project-context.js";
import { pathsMatch } from "../inventory/fingerprint.js";
import type { ProjectContext } from "../inventory/types.js";
import { assertOpenableProjectPath } from "./project-path.js";
import type { AeHost, OpenProjectResult } from "./types.js";

export type ClosePolicy = "discard" | "save";

export type CloseProjectResult = {
  closed: true;
  policy: ClosePolicy;
};

export type OpenProjectGuardedResult = OpenProjectResult & {
  alreadyOpen?: true;
  context?: ProjectContext;
};

export class SessionError extends Error {
  readonly code: string;
  readonly context?: ProjectContext;

  constructor(message: string, code: string, context?: ProjectContext) {
    super(message);
    this.name = "SessionError";
    this.code = code;
    this.context = context;
  }
}

/** True when AE has no saved file and no unsaved edits — treat as free to open over. */
export function isVacantSession(context: ProjectContext): boolean {
  return context.projectPath === null && !context.dirty;
}

export function assertClosePolicy(policy: string): ClosePolicy {
  if (policy === "discard" || policy === "save") {
    return policy;
  }
  throw new SessionError(
    `Invalid close policy ${JSON.stringify(policy)}. Use "discard" or "save" (never prompt).`,
    "invalid_policy",
  );
}

/**
 * Open with session guards: same-path no-op; refuse any different open project
 * (including dirty untitled). Clean untitled (null path, not dirty) is treated as vacant.
 */
export async function openProjectGuarded(
  host: AeHost,
  absolutePath: string,
  timeoutMs: number,
): Promise<OpenProjectGuardedResult> {
  assertOpenableProjectPath(absolutePath);

  const current = await listProjectContext(host, timeoutMs);

  if (current.projectPath !== null && pathsMatch(current.projectPath, absolutePath)) {
    return {
      path: absolutePath,
      opened: true,
      alreadyOpen: true,
      context: current,
    };
  }
  if (!isVacantSession(current)) {
    const openLabel = current.projectPath ?? "(unsaved)";
    throw new SessionError(
      `Another project is open (${openLabel}, dirty=${current.dirty}). ` +
        `Save and/or call ae_close_project before opening a different path. ` +
        `fingerprint=${current.fingerprint}`,
      "project_already_open",
      current,
    );
  }

  return host.openProject(absolutePath);
}

export async function closeProject(
  host: AeHost,
  options: {
    policy: ClosePolicy;
    expectedFingerprint?: string;
    timeoutMs: number;
  },
): Promise<CloseProjectResult> {
  const policy = assertClosePolicy(options.policy);
  const context = await listProjectContext(host, options.timeoutMs);

  if (options.expectedFingerprint !== undefined) {
    if (options.expectedFingerprint !== context.fingerprint) {
      throw new SessionError(
        `Stale fingerprint for close. expected=${options.expectedFingerprint} current=${context.fingerprint}. ` +
          `Re-read ae_project_context and retry.`,
        "stale_fingerprint",
        context,
      );
    }
  }

  if (policy === "save" && context.projectPath === null) {
    throw new SessionError(
      'Cannot close with policy "save": project has no savable path. ' +
        'Use ae_save_project save_copy first, or close with policy "discard".',
      "unsaved_cannot_save_close",
      context,
    );
  }

  const closeOption =
    policy === "save" ? "CloseOptions.SAVE_CHANGES" : "CloseOptions.DO_NOT_SAVE_CHANGES";

  const script = `
if (!app.project) {
  throw new Error("No After Effects project is open.");
}
var ok = app.project.close(${closeOption});
if (!ok) {
  throw new Error("Project close failed (AE returned false).");
}
return JSON.stringify({ closed: true });
`.trim();

  const result = await host.evalScript(script, options.timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    throw new Error(`${result.error}${line}`);
  }
  return { closed: true, policy };
}

export function assertAbsoluteProjectPath(path: string): void {
  if (!isAbsolute(path)) {
    throw new SessionError("Project path must be absolute.", "invalid_path");
  }
}
