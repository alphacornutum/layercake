import { existsSync } from "node:fs";
import { extname, isAbsolute } from "node:path";

/** Validate an absolute .aep/.aet path for openProject. */
export function assertOpenableProjectPath(absolutePath: string): void {
  if (!isAbsolute(absolutePath)) {
    throw new Error("Project path must be absolute.");
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Project path does not exist: ${absolutePath}`);
  }
  const ext = extname(absolutePath).toLowerCase();
  if (ext !== ".aep" && ext !== ".aet") {
    throw new Error(`Path is not a valid After Effects project file (.aep/.aet): ${absolutePath}`);
  }
}
