import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { AeConfig } from "../config.js";
import { assertHostConfigured, ConfigError } from "../config.js";
import { assertOpenableProjectPath } from "./project-path.js";
import { parseScriptResultFile, validateScriptSource, wrapExtendScript } from "./script-wrapper.js";
import type { AeHost, EvalResult, HostStatus, OpenProjectResult } from "./types.js";

const execFileAsync = promisify(execFile);

/** Max wait after `launch` for the app to report as running. */
const LAUNCH_READY_TIMEOUT_MS = 30_000;

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options?: { timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

export type MacOsAeHostDeps = {
  execFile?: ExecFileFn;
  platform?: NodeJS.Platform;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseIsRunningStdout(stdout: string): boolean {
  return stdout.trim().toLowerCase() === "true";
}

export class MacOsAeHost implements AeHost {
  private readonly execFile: ExecFileFn;
  private readonly platform: NodeJS.Platform;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly config: AeConfig,
    deps: MacOsAeHostDeps = {},
  ) {
    this.execFile = deps.execFile ?? execFileAsync;
    this.platform = deps.platform ?? process.platform;
    this.sleep = deps.sleep ?? sleep;
    this.now = deps.now ?? Date.now;
  }

  async status(): Promise<HostStatus> {
    if (this.platform !== "darwin") {
      return {
        platform: this.platform,
        available: false,
        appName: this.config.appName,
        executable: this.config.executable,
        message: "After Effects host bridge is only implemented on macOS and Windows.",
      };
    }

    try {
      const { appName, executable } = assertHostConfigured(this.config, "darwin");
      return {
        platform: this.platform,
        available: true,
        appName,
        executable,
        message: "Host configuration resolved.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        platform: this.platform,
        available: false,
        appName: this.config.appName,
        executable: this.config.executable,
        message,
      };
    }
  }

  async ensureSession(): Promise<void> {
    this.requireDarwin();
    const { appName, executable } = assertHostConfigured(this.config, "darwin");
    if (!appName) {
      throw new ConfigError("Could not resolve AppleScript application name.");
    }

    const label = `${appName}${executable ? `, ${executable}` : ""}`;

    try {
      if (await this.isApplicationRunning(appName)) {
        return;
      }

      const launch = `tell application "${escapeAppleScriptString(appName)}" to launch`;
      await this.execFile("osascript", ["-e", launch], { timeout: 120_000 });

      const deadline = this.now() + LAUNCH_READY_TIMEOUT_MS;
      while (this.now() < deadline) {
        if (await this.isApplicationRunning(appName)) {
          return;
        }
        await this.sleep(250);
      }

      throw new ConfigError(
        `After Effects did not become ready after launch (${label}). Is AE_APP_NAME / AE_EXECUTABLE correct?`,
      );
    } catch (err) {
      if (err instanceof ConfigError) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : String(err);
      throw new ConfigError(`Failed to launch or attach After Effects (${label}): ${detail}`);
    }
  }

  async openProject(absolutePath: string): Promise<OpenProjectResult> {
    this.requireDarwin();
    assertOpenableProjectPath(absolutePath);

    const { appName } = assertHostConfigured(this.config, "darwin");
    if (!appName) {
      throw new ConfigError("Could not resolve AppleScript application name.");
    }
    await this.ensureSession();
    const script = `
tell application "${escapeAppleScriptString(appName)}"
  open POSIX file "${escapeAppleScriptString(absolutePath)}"
end tell
`;
    await this.execFile("osascript", ["-e", script], { timeout: 120_000 });
    return { path: absolutePath, opened: true };
  }

  async evalScript(source: string, timeoutMs: number): Promise<EvalResult> {
    this.requireDarwin();
    const trimmed = validateScriptSource(source);
    assertHostConfigured(this.config, "darwin");
    await this.ensureSession();

    const dir = await mkdtemp(join(tmpdir(), "layercake-"));
    const scriptPath = join(dir, "script.jsx");
    const outPath = join(dir, "result.json");
    try {
      const wrapped = wrapExtendScript(trimmed, outPath);
      await writeFile(scriptPath, wrapped, "utf8");
      const { appName } = assertHostConfigured(this.config, "darwin");
      if (!appName) {
        throw new ConfigError("Could not resolve AppleScript application name.");
      }
      const apple = `
tell application "${escapeAppleScriptString(appName)}"
  DoScriptFile POSIX file "${escapeAppleScriptString(scriptPath)}"
end tell
`;
      try {
        await this.execFile("osascript", ["-e", apple], { timeout: timeoutMs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/ETIMEDOUT|timed out|timeout/i.test(msg)) {
          return {
            ok: false,
            error: `ExtendScript evaluation timed out after ${timeoutMs}ms`,
          };
        }
        return { ok: false, error: msg };
      }

      if (!existsSync(outPath)) {
        return {
          ok: false,
          error:
            "Script finished but produced no result file. Ensure the script returns a value and does not show blocking dialogs.",
        };
      }
      const raw = await readFile(outPath, "utf8");
      const parsed = parseScriptResultFile(raw);
      if (parsed.ok) {
        return { ok: true, result: parsed.result ?? "" };
      }
      return {
        ok: false,
        error: parsed.error ?? "Unknown ExtendScript error",
        line: parsed.line,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async isApplicationRunning(appName: string): Promise<boolean> {
    const script = `application "${escapeAppleScriptString(appName)}" is running`;
    const { stdout } = await this.execFile("osascript", ["-e", script], { timeout: 10_000 });
    return parseIsRunningStdout(stdout);
  }

  private requireDarwin(): void {
    if (this.platform !== "darwin") {
      throw new ConfigError("After Effects host operations require macOS (darwin).");
    }
  }
}
