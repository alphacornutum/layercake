import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Package root: parent of `src/` or `dist/` (this module lives directly under either). */
export function resolvePackageRoot(fromUrl: string = import.meta.url): string {
  const here = dirname(fileURLToPath(fromUrl));
  return join(here, "..");
}
