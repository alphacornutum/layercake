#!/usr/bin/env node
/**
 * Extract first-party effect match names from the vendored Scripting Guide
 * into src/inventory/first-party-effect-match-names.ts for ae_project_summary.
 *
 * Source: vendor/after-effects-scripting-guide/docs/matchnames/effects/firstparty.md
 * Invoked by docs:fetch and docs:allowlist.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourceMd = join(
  root,
  "vendor",
  "after-effects-scripting-guide",
  "docs",
  "matchnames",
  "effects",
  "firstparty.md",
);
const outTs = join(root, "src", "inventory", "first-party-effect-match-names.ts");

if (!existsSync(sourceMd)) {
  console.error(
    `Missing ${sourceMd}. Run npm run docs:fetch first (or ensure the vendor corpus is present).`,
  );
  process.exit(1);
}

const markdown = readFileSync(sourceMd, "utf8");
/** Table cells like `| \`ADBE Gaussian Blur 2\` |` */
const matchNameRe = /^\|\s*`([^`]+)`\s*\|/gm;
const names = new Set();
let m;
while ((m = matchNameRe.exec(markdown)) !== null) {
  const name = m[1].trim();
  if (name && name !== "Match Name") {
    names.add(name);
  }
}

const sorted = [...names].sort((a, b) => a.localeCompare(b));
if (sorted.length < 50) {
  console.error(
    `Expected many first-party match names; got ${sorted.length}. Is firstparty.md malformed?`,
  );
  process.exit(1);
}

const body = `/**
 * Auto-generated from vendor/.../matchnames/effects/firstparty.md
 * Do not edit by hand — run: npm run docs:allowlist
 */
export const FIRST_PARTY_EFFECT_MATCH_NAMES: readonly string[] = ${JSON.stringify(sorted, null, 2)};
`;

writeFileSync(outTs, body, "utf8");
console.error(`Wrote ${sorted.length} first-party effect match names → ${outTs}`);
