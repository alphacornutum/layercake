import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  appNameFromExecutable,
  assertHostConfigured,
  ConfigError,
  loadConfig,
} from "../src/config.js";

describe("loadConfig", () => {
  it("loads defaults when env is empty", () => {
    const cfg = loadConfig({}, "/tmp/project");
    expect(cfg.executable).toBeUndefined();
    expect(cfg.appName).toBeUndefined();
    expect(cfg.scriptTimeoutMs).toBe(60_000);
    expect(cfg.inspectMaxBytes).toBe(524_288);
    expect(cfg.artifactDir).toContain(`layercake-artifacts-${process.pid}`);
  });

  it("resolves absolute and relative paths", () => {
    const cfg = loadConfig(
      {
        AE_EXECUTABLE: "Apps/AE.app",
        AE_APP_NAME: "Adobe After Effects 2025",
        AE_SCRIPT_TIMEOUT_MS: "12000",
        AE_INSPECT_MAX_BYTES: "1048576",
        AE_ARTIFACT_DIR: "/var/layercake-artifacts",
      },
      "/repo",
    );
    expect(cfg.executable).toBe("/repo/Apps/AE.app");
    expect(cfg.appName).toBe("Adobe After Effects 2025");
    expect(cfg.scriptTimeoutMs).toBe(12_000);
    expect(cfg.inspectMaxBytes).toBe(1_048_576);
    expect(cfg.artifactDir).toBe("/var/layercake-artifacts");
  });

  it("derives app name from .app path when AE_APP_NAME unset", () => {
    const cfg = loadConfig(
      {
        AE_EXECUTABLE: "/Applications/Adobe After Effects 2024/Adobe After Effects 2024.app",
      },
      "/repo",
    );
    expect(cfg.appName).toBe("Adobe After Effects 2024");
  });

  it("rejects invalid timeout", () => {
    expect(() => loadConfig({ AE_SCRIPT_TIMEOUT_MS: "0" }, "/repo")).toThrow(ConfigError);
  });

  it("rejects invalid inspect max bytes", () => {
    expect(() => loadConfig({ AE_INSPECT_MAX_BYTES: "0" }, "/repo")).toThrow(ConfigError);
    expect(() => loadConfig({ AE_INSPECT_MAX_BYTES: "1.5" }, "/repo")).toThrow(ConfigError);
  });
});

describe("appNameFromExecutable", () => {
  it("parses .app bundle name", () => {
    expect(appNameFromExecutable("/Applications/Adobe After Effects 2025.app")).toBe(
      "Adobe After Effects 2025",
    );
  });
});

describe("assertHostConfigured", () => {
  it("errors when neither app name nor executable is set on macOS", () => {
    expect(() => assertHostConfigured(loadConfig({}, "/repo"), "darwin")).toThrow(
      /AE_APP_NAME and\/or AE_EXECUTABLE/,
    );
  });

  it("accepts app name only on macOS", () => {
    const resolved = assertHostConfigured(
      loadConfig({ AE_APP_NAME: "Adobe After Effects 2025" }, "/repo"),
      "darwin",
    );
    expect(resolved.appName).toBe("Adobe After Effects 2025");
  });

  it("accepts existing executable only on Windows without AE_APP_NAME", () => {
    const dir = mkdtempSync(join(tmpdir(), "ae-cfg-"));
    const exe = join(dir, "AfterFX.exe");
    writeFileSync(exe, "");
    const resolved = assertHostConfigured(loadConfig({ AE_EXECUTABLE: exe }, dir), "win32");
    expect(resolved.executable).toBe(exe);
    expect(resolved.appName).toBeUndefined();
  });

  it("errors when AE_EXECUTABLE is missing on Windows", () => {
    expect(() => assertHostConfigured(loadConfig({}, "/repo"), "win32")).toThrow(
      /Set AE_EXECUTABLE/,
    );
  });

  it("errors when AE_EXECUTABLE does not exist on Windows", () => {
    expect(() =>
      assertHostConfigured(loadConfig({ AE_EXECUTABLE: "/missing/AfterFX.exe" }, "/repo"), "win32"),
    ).toThrow(/does not exist/);
  });
});
