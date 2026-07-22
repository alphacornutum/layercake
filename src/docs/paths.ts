import { join } from "node:path";

import { resolvePackageRoot } from "../package-root.js";

/** Vendored Scripting Guide markdown under the LayerCake package root. */
export function resolveDocsCorpusPath(packageRoot: string = resolvePackageRoot()): string {
  return join(packageRoot, "vendor", "after-effects-scripting-guide", "docs");
}
