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

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export class MacOsAeHost implements AeHost {
  constructor(private readonly config: AeConfig) {}

  async status(): Promise<HostStatus> {
    if (process.platform !== "darwin") {
      return {
        platform: process.platform,
        available: false,
        appName: this.config.appName,
        executable: this.config.executable,
        message: "After Effects host bridge is only implemented on macOS and Windows.",
      };
    }

    try {
      const { appName, executable } = assertHostConfigured(this.config, "darwin");
      return {
        platform: process.platform,
        available: true,
        appName,
        executable,
        message: "Host configuration resolved.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        platform: process.platform,
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
    const script = `tell application "${escapeAppleScriptString(appName)}" to activate`;
    try {
      await execFileAsync("osascript", ["-e", script], { timeout: 120_000 });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ConfigError(
        `Failed to launch or attach After Effects (${appName}${executable ? `, ${executable}` : ""}): ${detail}`,
      );
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
  activate
  open POSIX file "${escapeAppleScriptString(absolutePath)}"
end tell
`;
    await execFileAsync("osascript", ["-e", script], { timeout: 120_000 });
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
        await execFileAsync("osascript", ["-e", apple], { timeout: timeoutMs });
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

  private requireDarwin(): void {
    if (process.platform !== "darwin") {
      throw new ConfigError("After Effects host operations require macOS (darwin).");
    }
  }
}
