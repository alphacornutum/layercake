import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export type AeConfig = {
  executable: string | undefined;
  appName: string | undefined;
  docsPath: string;
  scriptTimeoutMs: number;
  /** UTF-8 byte ceiling for ae_get_layer / ae_get_source success JSON. */
  inspectMaxBytes: number;
  /** Absolute dir for backups and LayerCake-generated artifacts. */
  artifactDir: string;
};

export type ResolvedHostConfig = {
  appName: string | undefined;
  executable: string | undefined;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_INSPECT_MAX_BYTES = 524_288;

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ConfigError(
      `AE_SCRIPT_TIMEOUT_MS must be a positive number (got ${JSON.stringify(raw)})`,
    );
  }
  return Math.floor(n);
}

function parseInspectMaxBytes(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_INSPECT_MAX_BYTES;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ConfigError(
      `AE_INSPECT_MAX_BYTES must be a positive integer (got ${JSON.stringify(raw)})`,
    );
  }
  return n;
}

/**
 * Derive AppleScript app name from a macOS .app bundle path when possible.
 */
export function appNameFromExecutable(executable: string): string | undefined {
  const match = executable.match(/([^/]+)\.app(?:\/|$)/i);
  if (!match) {
    return undefined;
  }
  return match[1];
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AeConfig {
  const executableRaw = env.AE_EXECUTABLE?.trim() || undefined;
  const appNameRaw = env.AE_APP_NAME?.trim() || undefined;
  const executable = executableRaw
    ? isAbsolute(executableRaw)
      ? executableRaw
      : resolve(cwd, executableRaw)
    : undefined;

  let appName = appNameRaw;
  if (!appName && executable) {
    appName = appNameFromExecutable(executable);
  }

  const docsRaw = env.AE_DOCS_PATH?.trim();
  const docsPath = docsRaw
    ? isAbsolute(docsRaw)
      ? docsRaw
      : resolve(cwd, docsRaw)
    : resolve(cwd, "vendor/after-effects-scripting-guide/docs");

  const artifactRaw = env.AE_ARTIFACT_DIR?.trim();
  let artifactDir: string;
  if (artifactRaw) {
    artifactDir = isAbsolute(artifactRaw) ? artifactRaw : resolve(cwd, artifactRaw);
  } else {
    artifactDir = join(tmpdir(), `layercake-artifacts-${process.pid}`);
  }

  return {
    executable,
    appName,
    docsPath,
    scriptTimeoutMs: parseTimeout(env.AE_SCRIPT_TIMEOUT_MS),
    inspectMaxBytes: parseInspectMaxBytes(env.AE_INSPECT_MAX_BYTES),
    artifactDir,
  };
}

/**
 * Resolve platform-appropriate host configuration.
 * macOS: AppleScript app name (AE_APP_NAME or derived from .app); AE_EXECUTABLE optional.
 * Windows: existing AE_EXECUTABLE required; AE_APP_NAME not required.
 */
export function assertHostConfigured(
  config: AeConfig,
  platform: NodeJS.Platform = process.platform,
): ResolvedHostConfig {
  if (platform === "win32") {
    if (!config.executable) {
      throw new ConfigError(
        "After Effects host is not configured. Set AE_EXECUTABLE to the path of AfterFX.exe.",
      );
    }
    if (!existsSync(config.executable)) {
      throw new ConfigError(`AE_EXECUTABLE does not exist: ${config.executable}`);
    }
    return { appName: config.appName, executable: config.executable };
  }

  if (!config.appName && !config.executable) {
    throw new ConfigError(
      "After Effects host is not configured. Set AE_APP_NAME and/or AE_EXECUTABLE.",
    );
  }
  const appName = config.appName ?? appNameFromExecutable(config.executable!);
  if (!appName) {
    throw new ConfigError(
      'Could not resolve AppleScript application name. Set AE_APP_NAME (e.g. "Adobe After Effects 2025").',
    );
  }
  if (config.executable && !existsSync(config.executable)) {
    throw new ConfigError(`AE_EXECUTABLE does not exist: ${config.executable}`);
  }
  return { appName, executable: config.executable };
}
