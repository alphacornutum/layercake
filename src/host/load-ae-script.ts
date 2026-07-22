import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Package root (works from src/host via tsx and from dist/host after build). */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Load an ES3-emitted first-party AE script from dist/ae-scripts/<name>.jsx.
 * Run `npm run build:ae-scripts` before eval/tests.
 */
export function loadAeScript(name: string): string {
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid AE script name: ${name}`);
  }
  const path = join(PACKAGE_ROOT, "dist", "ae-scripts", `${name}.jsx`);
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Missing AE script "${name}" at ${path}. Run \`npm run build:ae-scripts\` first. (${msg})`,
    );
  }
}

/**
 * Load a helper-only bundle for concatenation before another eval payload.
 * The build appends `return main();` to every entry; that terminal return must
 * be removed so the caller's entrypoint remains reachable.
 */
export function loadAeHelperScript(name: string): string {
  const source = loadAeScript(name);
  const terminalReturn = /\nreturn main\(\);\s*$/;
  if (!terminalReturn.test(source)) {
    throw new Error(`AE helper script "${name}" has no terminal main() return`);
  }
  return source.replace(terminalReturn, "").trimEnd();
}
