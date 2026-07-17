import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config.js";
import type { ExecFileFn } from "../src/host/windows.js";
import { removeTempDir, WinAeHost } from "../src/host/windows.js";

function fakeAfterFx(): string {
  const dir = mkdtempSync(join(tmpdir(), "ae-win-"));
  const exe = join(dir, "AfterFX.exe");
  writeFileSync(exe, "");
  return exe;
}

function hostWithMocks(exe: string, execFile: ExecFileFn) {
  return new WinAeHost(loadConfig({ AE_EXECUTABLE: exe }, dirname(exe)), {
    platform: "win32",
    execFile,
    spawnDetached: () => undefined,
    // Yield to I/O so mocked execFile can write the result file while we poll.
    sleep: () => new Promise((resolve) => setImmediate(resolve)),
    now: () => Date.now(),
  });
}

describe("WinAeHost", () => {
  it("invokes AfterFX.exe -r with the temp script path", async () => {
    const exe = fakeAfterFx();
    const calls: { file: string; args: readonly string[] }[] = [];

    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args: [...args] });
      if (file === "tasklist") {
        return { stdout: "AfterFX.exe", stderr: "" };
      }
      if (file === exe && args[0] === "-r") {
        const scriptPath = args[1]!;
        const outPath = join(dirname(scriptPath), "result.json");
        await writeFile(outPath, "OK\nhello", "utf8");
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file} ${args.join(" ")}`);
    };

    const host = hostWithMocks(exe, execFile);
    const result = await host.evalScript("return 'hello';", 5_000);
    expect(result).toEqual({ ok: true, result: "hello" });

    const run = calls.find((c) => c.file === exe && c.args[0] === "-r");
    expect(run).toBeTruthy();
    expect(run!.args[0]).toBe("-r");
    expect(run!.args[1]).toMatch(/script\.jsx$/);
  });

  it("opens a project via app.open ExtendScript through -r", async () => {
    const exe = fakeAfterFx();
    const projectDir = mkdtempSync(join(tmpdir(), "ae-proj-"));
    const projectPath = join(projectDir, "sample.aep");
    writeFileSync(projectPath, "");

    let openedScript = "";
    const execFile: ExecFileFn = async (file, args) => {
      if (file === "tasklist") {
        return { stdout: "AfterFX.exe", stderr: "" };
      }
      if (file === exe && args[0] === "-r") {
        const scriptPath = args[1]!;
        openedScript = await readFile(scriptPath, "utf8");
        const outPath = join(dirname(scriptPath), "result.json");
        await writeFile(outPath, "OK\nopened", "utf8");
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected execFile: ${file}`);
    };

    const host = hostWithMocks(exe, execFile);
    const result = await host.openProject(projectPath);
    expect(result).toEqual({ path: projectPath, opened: true });
    expect(openedScript).toContain("app.open");
    expect(openedScript).toContain(projectPath.replace(/\\/g, "/"));
  });

  it("returns a timeout error when -r times out without a result file", async () => {
    const exe = fakeAfterFx();
    const execFile: ExecFileFn = async (file, args, options) => {
      if (file === "tasklist") {
        return { stdout: "AfterFX.exe", stderr: "" };
      }
      if (file === exe && args[0] === "-r") {
        const err = new Error(`spawn ETIMEDOUT (timeout ${options?.timeout})`);
        throw err;
      }
      throw new Error(`Unexpected execFile: ${file}`);
    };

    const host = hostWithMocks(exe, execFile);
    const result = await host.evalScript("return 1;", 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/timed out after 100ms/);
    }
  });

  it("rejects empty scripts without invoking After Effects", async () => {
    const exe = fakeAfterFx();
    const execFile = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const host = hostWithMocks(exe, execFile);

    await expect(host.evalScript("   ", 5_000)).rejects.toThrow(/empty/i);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("reports available status when AE_EXECUTABLE is configured", async () => {
    const exe = fakeAfterFx();
    const host = hostWithMocks(exe, async () => ({ stdout: "", stderr: "" }));
    const status = await host.status();
    expect(status.available).toBe(true);
    expect(status.platform).toBe("win32");
    expect(status.executable).toBe(exe);
  });
});

describe("removeTempDir", () => {
  it("retries EBUSY/EPERM/ENOTEMPTY with the documented backoff then succeeds", async () => {
    const delays: number[] = [];
    const sleep = async (ms: number) => {
      delays.push(ms);
    };
    const busy = Object.assign(new Error("busy"), { code: "EBUSY" });
    const perm = Object.assign(new Error("perm"), { code: "EPERM" });
    const notEmpty = Object.assign(new Error("notempty"), { code: "ENOTEMPTY" });
    const rm = vi
      .fn()
      .mockRejectedValueOnce(busy)
      .mockRejectedValueOnce(perm)
      .mockRejectedValueOnce(notEmpty)
      .mockResolvedValue(undefined);

    await expect(removeTempDir("/tmp/layercake-x", { rm, sleep })).resolves.toBeUndefined();
    expect(rm).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([50, 100, 250]); // first attempt is immediate (0ms)
  });

  it("swallows the error after all retries without throwing", async () => {
    const sleep = async () => undefined;
    const busy = Object.assign(new Error("busy"), { code: "EBUSY" });
    const rm = vi.fn().mockRejectedValue(busy);

    await expect(removeTempDir("/tmp/layercake-x", { rm, sleep })).resolves.toBeUndefined();
    expect(rm).toHaveBeenCalledTimes(5);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn(async () => undefined);
    const err = Object.assign(new Error("noent"), { code: "ENOENT" });
    const rm = vi.fn().mockRejectedValue(err);

    await expect(removeTempDir("/tmp/layercake-x", { rm, sleep })).resolves.toBeUndefined();
    expect(rm).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
