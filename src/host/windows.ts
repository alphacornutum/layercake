import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import type { AeConfig } from "../config.js";
import { assertHostConfigured, ConfigError } from "../config.js";
import { assertOpenableProjectPath } from "./project-path.js";
import { parseScriptResultFile, validateScriptSource, wrapExtendScript } from "./script-wrapper.js";
import type { AeHost, EvalResult, HostStatus, OpenProjectResult } from "./types.js";

const execFileAsync = promisify(execFile);

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options?: { timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

export type SpawnDetachedFn = (file: string, args?: readonly string[]) => void;

export type WinAeHostDeps = {
  execFile?: ExecFileFn;
  spawnDetached?: SpawnDetachedFn;
  platform?: NodeJS.Platform;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

function defaultSpawnDetached(file: string, args: readonly string[] = []): void {
  const child = spawn(file, [...args], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff before each rm attempt — AfterFX can keep handles briefly after `-r` returns. */
const REMOVE_TEMP_DIR_BACKOFF_MS = [0, 50, 100, 250, 500] as const;

const RETRYABLE_RM_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

export type RemoveTempDirDeps = {
  rm?: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Best-effort recursive temp-dir removal. Retries briefly on Windows lock errors;
 * never throws — leftover dirs are preferable to failing a successful eval.
 */
export async function removeTempDir(dir: string, deps: RemoveTempDirDeps = {}): Promise<void> {
  const rmFn = deps.rm ?? rm;
  const sleepFn = deps.sleep ?? sleep;

  for (let i = 0; i < REMOVE_TEMP_DIR_BACKOFF_MS.length; i++) {
    const delay = REMOVE_TEMP_DIR_BACKOFF_MS[i]!;
    if (delay > 0) {
      await sleepFn(delay);
    }
    try {
      await rmFn(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : undefined;
      const retryable = code !== undefined && RETRYABLE_RM_CODES.has(code);
      const isLast = i === REMOVE_TEMP_DIR_BACKOFF_MS.length - 1;
      if (!retryable || isLast) {
        return;
      }
    }
  }
}

/** Escape a string for use inside an ExtendScript double-quoted literal. */
function escapeExtendScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Normalize path separators for ExtendScript File() on Windows. */
function toExtendScriptPath(absolutePath: string): string {
  return absolutePath.replace(/\\/g, "/");
}

export class WinAeHost implements AeHost {
  private runChain: Promise<unknown> = Promise.resolve();
  private readonly execFile: ExecFileFn;
  private readonly spawnDetached: SpawnDetachedFn;
  private readonly platform: NodeJS.Platform;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly config: AeConfig,
    deps: WinAeHostDeps = {},
  ) {
    this.execFile = deps.execFile ?? execFileAsync;
    this.spawnDetached = deps.spawnDetached ?? defaultSpawnDetached;
    this.platform = deps.platform ?? process.platform;
    this.sleep = deps.sleep ?? sleep;
    this.now = deps.now ?? Date.now;
  }

  async status(): Promise<HostStatus> {
    if (this.platform !== "win32") {
      return {
        platform: this.platform,
        available: false,
        appName: this.config.appName,
        executable: this.config.executable,
        message: "After Effects host bridge is only implemented on macOS and Windows.",
      };
    }

    try {
      const { appName, executable } = assertHostConfigured(this.config, "win32");
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
    this.requireWin32();
    const { executable } = assertHostConfigured(this.config, "win32");
    if (!executable) {
      throw new ConfigError("AE_EXECUTABLE is required on Windows.");
    }

    if (await this.isAfterEffectsRunning(executable)) {
      return;
    }

    try {
      this.spawnDetached(executable);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ConfigError(`Failed to launch After Effects (${executable}): ${detail}`);
    }

    const deadline = this.now() + 30_000;
    while (this.now() < deadline) {
      if (await this.isAfterEffectsRunning(executable)) {
        return;
      }
      await this.sleep(250);
    }

    throw new ConfigError(
      `After Effects did not become ready after launch (${executable}). Is AE_EXECUTABLE correct?`,
    );
  }

  async openProject(absolutePath: string): Promise<OpenProjectResult> {
    this.requireWin32();
    assertOpenableProjectPath(absolutePath);
    assertHostConfigured(this.config, "win32");
    await this.ensureSession();

    const aePath = toExtendScriptPath(absolutePath);
    const script = `
var f = new File("${escapeExtendScriptString(aePath)}");
var doc = app.open(f);
if (!doc) {
  throw new Error("Failed to open project: ${escapeExtendScriptString(aePath)}");
}
return "opened";
`;
    const result = await this.evalScript(script, this.config.scriptTimeoutMs);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return { path: absolutePath, opened: true };
  }

  async evalScript(source: string, timeoutMs: number): Promise<EvalResult> {
    this.requireWin32();
    const trimmed = validateScriptSource(source);
    return this.withLock(() => this.evalScriptUnlocked(trimmed, timeoutMs));
  }

  private async evalScriptUnlocked(trimmed: string, timeoutMs: number): Promise<EvalResult> {
    const { executable } = assertHostConfigured(this.config, "win32");
    if (!executable) {
      throw new ConfigError("AE_EXECUTABLE is required on Windows.");
    }
    await this.ensureSession();

    const dir = await mkdtemp(join(tmpdir(), "layercake-"));
    const scriptPath = join(dir, "script.jsx");
    const outPath = join(dir, "result.json");
    try {
      const wrapped = wrapExtendScript(trimmed, outPath);
      await writeFile(scriptPath, wrapped, "utf8");

      let execError: string | undefined;
      let execFinished = false;
      const execDone = this.execFile(executable, ["-r", scriptPath], { timeout: timeoutMs })
        .then(() => {
          execFinished = true;
        })
        .catch((err: unknown) => {
          execFinished = true;
          const msg = err instanceof Error ? err.message : String(err);
          if (/ETIMEDOUT|timed out|timeout/i.test(msg)) {
            execError = `ExtendScript evaluation timed out after ${timeoutMs}ms`;
          } else {
            execError = msg;
          }
        });

      // Poll for the result file: AfterFX -r may return before ExtendScript finishes.
      const deadline = this.now() + timeoutMs;
      while (!existsSync(outPath) && this.now() < deadline) {
        if (execFinished && execError) {
          break;
        }
        await this.sleep(50);
      }

      await execDone;

      if (!existsSync(outPath)) {
        if (execError) {
          return { ok: false, error: execError };
        }
        return {
          ok: false,
          error:
            "Script finished but produced no result file. Ensure Allow Scripts To Write Files And Access Network is enabled, the script returns a value, and it does not show blocking dialogs.",
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
      await removeTempDir(dir, { sleep: this.sleep });
    }
  }

  /** Serialize Windows `-r` runs so concurrent evals do not interleave. */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.runChain;
    let release!: () => void;
    this.runChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async isAfterEffectsRunning(executable: string): Promise<boolean> {
    const imageName = basename(executable);
    try {
      const { stdout } = await this.execFile(
        "tasklist",
        ["/FI", `IMAGENAME eq ${imageName}`, "/NH"],
        { timeout: 10_000 },
      );
      return new RegExp(imageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(stdout);
    } catch {
      return false;
    }
  }

  private requireWin32(): void {
    if (this.platform !== "win32") {
      throw new ConfigError("After Effects Windows host operations require win32.");
    }
  }
}
