import { mkdtempSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import type { ExecFileFn } from "../src/host/macos.js";
import { MacOsAeHost } from "../src/host/macos.js";

const APP = "Adobe After Effects 2026";

function hostWithMocks(execFile: ExecFileFn, extras: { now?: () => number } = {}) {
  return new MacOsAeHost(loadConfig({ AE_APP_NAME: APP }, "/repo"), {
    platform: "darwin",
    execFile,
    sleep: () => Promise.resolve(),
    now: extras.now ?? (() => Date.now()),
  });
}

function collectOsascriptSources(calls: { file: string; args: readonly string[] }[]): string[] {
  return calls.filter((c) => c.file === "osascript").map((c) => String(c.args[1] ?? ""));
}

describe("MacOsAeHost soft attach", () => {
  it("ensureSession is a no-op when the app is already running (no activate/launch)", async () => {
    const calls: { file: string; args: readonly string[] }[] = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args: [...args] });
      if (file === "osascript" && String(args[1]).includes("is running")) {
        return { stdout: "true\n", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file} ${args.join(" ")}`);
    };

    await hostWithMocks(execFile).ensureSession();
    const scripts = collectOsascriptSources(calls);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("is running");
    expect(scripts.join("\n")).not.toMatch(/activate/i);
    expect(scripts.join("\n")).not.toMatch(/\blaunch\b/i);
  });

  it("ensureSession launches when not running and waits until running", async () => {
    const calls: { file: string; args: readonly string[] }[] = [];
    let runningChecks = 0;
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args: [...args] });
      const src = String(args[1] ?? "");
      if (file === "osascript" && src.includes("is running")) {
        runningChecks += 1;
        // First check: not running; after launch: running
        return { stdout: runningChecks === 1 ? "false\n" : "true\n", stderr: "" };
      }
      if (file === "osascript" && src.includes("to launch")) {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file} ${args.join(" ")}`);
    };

    await hostWithMocks(execFile).ensureSession();
    const scripts = collectOsascriptSources(calls);
    expect(scripts.some((s) => s.includes("to launch"))).toBe(true);
    expect(scripts.join("\n")).not.toMatch(/activate/i);
    expect(runningChecks).toBeGreaterThanOrEqual(2);
  });

  it("evalScript uses DoScriptFile without activate when already running", async () => {
    const calls: { file: string; args: readonly string[] }[] = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args: [...args] });
      const src = String(args[1] ?? "");
      if (file === "osascript" && src.includes("is running")) {
        return { stdout: "true\n", stderr: "" };
      }
      if (file === "osascript" && src.includes("DoScriptFile")) {
        const match = src.match(/DoScriptFile POSIX file "([^"]+)"/);
        if (!match) {
          throw new Error(`Could not parse script path from: ${src}`);
        }
        const scriptPath = match[1]!;
        const outPath = join(dirname(scriptPath), "result.json");
        await writeFile(outPath, "OK\nhello", "utf8");
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file} ${args.join(" ")}`);
    };

    const result = await hostWithMocks(execFile).evalScript("return 'hello';", 5_000);
    expect(result).toEqual({ ok: true, result: "hello" });

    const scripts = collectOsascriptSources(calls);
    expect(scripts.some((s) => s.includes("DoScriptFile"))).toBe(true);
    expect(scripts.join("\n")).not.toMatch(/activate/i);
  });

  it("openProject opens without activate when already running", async () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ae-mac-proj-"));
    const projectPath = join(projectDir, "sample.aep");
    writeFileSync(projectPath, "");

    const calls: { file: string; args: readonly string[] }[] = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args: [...args] });
      const src = String(args[1] ?? "");
      if (file === "osascript" && src.includes("is running")) {
        return { stdout: "true\n", stderr: "" };
      }
      if (file === "osascript" && src.includes("open POSIX file")) {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file} ${args.join(" ")}`);
    };

    const result = await hostWithMocks(execFile).openProject(projectPath);
    expect(result).toEqual({ path: projectPath, opened: true });

    const scripts = collectOsascriptSources(calls);
    const openScript = scripts.find((s) => s.includes("open POSIX file"));
    expect(openScript).toBeTruthy();
    expect(openScript).toContain(projectPath);
    expect(openScript).not.toMatch(/activate/i);
    expect(scripts.join("\n")).not.toMatch(/activate/i);
  });

  it("ensureSession fails clearly when launch never becomes ready", async () => {
    let t = 0;
    const execFile: ExecFileFn = async (file, args) => {
      const src = String(args[1] ?? "");
      if (file === "osascript" && src.includes("is running")) {
        return { stdout: "false\n", stderr: "" };
      }
      if (file === "osascript" && src.includes("to launch")) {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file}`);
    };

    const host = hostWithMocks(execFile, {
      now: () => {
        t += 10_000;
        return t;
      },
    });

    await expect(host.ensureSession()).rejects.toThrow(/did not become ready after launch/);
  });
});
