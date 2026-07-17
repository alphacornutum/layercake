/**
 * Composite concurrency token for the open AE project.
 * Format: rev:{revision}|dirty:{0|1}|path:{absolute|unsaved}
 */
export function buildFingerprint(
  revision: number,
  dirty: boolean,
  projectPath: string | null,
): string {
  const pathPart = projectPath && projectPath.length > 0 ? projectPath : "unsaved";
  return `rev:${revision}|dirty:${dirty ? 1 : 0}|path:${pathPart}`;
}

export function pathsMatch(expected: string | null, actual: string | null): boolean {
  if (expected === null || actual === null) {
    return expected === actual;
  }
  return normalizePathKey(expected) === normalizePathKey(actual);
}

/** Normalize for path-guard comparison (slashes + trailing slash). */
export function normalizePathKey(path: string): string {
  const trimmed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "darwin" || process.platform === "win32"
    ? trimmed.toLowerCase()
    : trimmed;
}
