#!/usr/bin/env node
/**
 * Fetch the community After Effects Scripting Guide markdown into vendor/.
 * Source: https://github.com/docsforadobe/after-effects-scripting-guide
 * Why vendor (not npm): docs/adr/0001-vendor-scripting-guide-corpus.md
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const vendorRoot = join(root, "vendor", "after-effects-scripting-guide");
const repoUrl = "https://github.com/docsforadobe/after-effects-scripting-guide.git";

mkdirSync(dirname(vendorRoot), { recursive: true });
if (existsSync(vendorRoot)) {
  rmSync(vendorRoot, { recursive: true, force: true });
}

console.error(`Cloning ${repoUrl} (docs only)…`);
execFileSync(
  "git",
  ["clone", "--depth", "1", "--filter=blob:none", "--sparse", repoUrl, vendorRoot],
  { stdio: "inherit" },
);
execFileSync(
  "git",
  ["-C", vendorRoot, "sparse-checkout", "set", "--skip-checks", "docs", "readme.md"],
  { stdio: "inherit" },
);

const notice = `# Attribution

This directory contains content from the community After Effects Scripting Guide:

https://github.com/docsforadobe/after-effects-scripting-guide

Originally derived from the Adobe After Effects CS6 Scripting Guide.
All guide content is copyright Adobe Systems Incorporated.
This project redistributes the markdown for educational / offline agent use.

See the upstream repository for contribution and licensing notes.
`;

writeFileSync(join(vendorRoot, "ATTRIBUTION.md"), notice, "utf8");
rmSync(join(vendorRoot, ".git"), { recursive: true, force: true });
console.error(`Docs ready at ${vendorRoot}`);
