/**
 * Bundle src/ae-scripts/entries/*.ts → dist/ae-scripts/<name>.jsx (ES3).
 * Each entry must export main(): string. Emit is a function body ending with return main();
 */
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import typescript from "@rollup/plugin-typescript";

import { assertExtendScriptCompatible, sanitizeExtendScript } from "./ae-script-compat.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entriesDir = join(root, "src", "ae-scripts", "entries");
const outDir = join(root, "dist", "ae-scripts");

const entryFiles = readdirSync(entriesDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => join(entriesDir, f));

if (entryFiles.length === 0) {
  console.error("build-ae-scripts: no entries in", entriesDir);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const stripExportsAndReturnMain = {
  name: "ae-return-main",
  renderChunk(code) {
    let next = code
      .replace(/\n?export \{[^}]+\};?\s*/g, "\n")
      .replace(/\n?export default [^;]+;?\s*/g, "\n")
      .trim();
    if (!/\bfunction main\b/.test(next) && !/\bmain\s*=/.test(next)) {
      throw new Error("ae-script entry must define main()");
    }
    next = sanitizeExtendScript(`${next}\nreturn main();\n`);
    return { code: next, map: null };
  },
};

for (const input of entryFiles) {
  const name = basename(input, ".ts");
  const bundle = await rollup({
    input,
    plugins: [
      typescript({
        tsconfig: join(root, "tsconfig.ae.json"),
        compilerOptions: {
          target: "ES5",
          module: "ESNext",
          noEmit: false,
          declaration: false,
          declarationMap: false,
          sourceMap: false,
        },
        filterRoot: join(root, "src", "ae-scripts"),
        exclude: ["**/*.d.ts"],
      }),
      stripExportsAndReturnMain,
    ],
    onwarn(warning, warn) {
      if (warning.code === "THIS_IS_UNDEFINED") return;
      warn(warning);
    },
  });

  const { output } = await bundle.generate({
    format: "es",
    sourcemap: false,
    generatedCode: {
      constBindings: false,
    },
  });

  const chunk = output.find((o) => o.type === "chunk");
  if (chunk?.type !== "chunk") {
    throw new Error(`No chunk for ${name}`);
  }

  assertExtendScriptCompatible(name, chunk.code);
  const outPath = join(outDir, `${name}.jsx`);
  writeFileSync(outPath, chunk.code, "utf8");
  await bundle.close();
  console.log(`ae-script: ${name}.jsx (${chunk.code.length} bytes)`);
}
