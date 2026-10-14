import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertHostConfigured, loadConfig } from "../src/config.js";
import { createAeHost } from "../src/host/create-host.js";
import { closeProject } from "../src/host/session.js";
import { pathsMatch } from "../src/inventory/fingerprint.js";
import { listProjectContext } from "../src/inventory/list-project-context.js";

const config = loadConfig();
const fixtureAep = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/hello-world.aep");
const hostPlatformSupported = process.platform === "darwin" || process.platform === "win32";

export default function closeFixtureProjectAfterTests() {
  return async () => {
    if (!hostPlatformSupported) return;

    try {
      assertHostConfigured(config);
    } catch {
      return;
    }

    const host = createAeHost(config);
    const context = await listProjectContext(host, config.scriptTimeoutMs);
    if (!pathsMatch(context.projectPath, fixtureAep)) return;

    await closeProject(host, {
      policy: "discard",
      expectedFingerprint: context.fingerprint,
      timeoutMs: config.scriptTimeoutMs,
    });
  };
}
