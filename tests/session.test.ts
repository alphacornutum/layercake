import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  assertClosePolicy,
  closeProject,
  isVacantSession,
  openProjectGuarded,
  SessionError,
} from "../src/host/session.js";
import type { AeHost, EvalResult } from "../src/host/types.js";
import { buildFingerprint } from "../src/inventory/fingerprint.js";
import type { ProjectContext } from "../src/inventory/types.js";

const fixtureAep = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/hello-world.aep");
const hasFixture = existsSync(fixtureAep);

function context(
  partial: Partial<ProjectContext> & Pick<ProjectContext, "projectPath" | "dirty" | "revision">,
): ProjectContext {
  const { projectPath, dirty, revision } = partial;
  return {
    projectName: partial.projectName ?? "Demo.aep",
    projectPath,
    dirty,
    revision,
    fingerprint: buildFingerprint(revision, dirty, projectPath),
    aeVersion: partial.aeVersion ?? "25.0",
    ...(dirty ? { warning: "unsaved" } : {}),
  };
}

function mockHost(opts: {
  contextJson?: string;
  open?: AeHost["openProject"];
  evalResults?: EvalResult[];
}): AeHost {
  const evalResults = opts.evalResults ? [...opts.evalResults] : [];
  return {
    status: async () => ({
      platform: "darwin",
      available: true,
      appName: "AE",
      executable: undefined,
      message: "ok",
    }),
    ensureSession: async () => {},
    openProject: opts.open ?? (async (path: string) => ({ path, opened: true as const })),
    evalScript: async () => {
      if (evalResults.length > 0) {
        return evalResults.shift()!;
      }
      if (opts.contextJson) {
        return { ok: true, result: opts.contextJson };
      }
      return { ok: false, error: "no eval result" };
    },
  };
}

describe("isVacantSession", () => {
  it("treats clean untitled as vacant", () => {
    expect(isVacantSession(context({ projectPath: null, dirty: false, revision: 0 }))).toBe(true);
  });

  it("treats dirty or saved projects as occupied", () => {
    expect(isVacantSession(context({ projectPath: null, dirty: true, revision: 1 }))).toBe(false);
    expect(isVacantSession(context({ projectPath: "/tmp/a.aep", dirty: false, revision: 1 }))).toBe(
      false,
    );
  });
});

describe("assertClosePolicy", () => {
  it("accepts discard and save only", () => {
    expect(assertClosePolicy("discard")).toBe("discard");
    expect(assertClosePolicy("save")).toBe("save");
    expect(() => assertClosePolicy("prompt")).toThrow(SessionError);
  });
});

describe.skipIf(!hasFixture)("openProjectGuarded", () => {
  it("no-ops when the same path is already open", async () => {
    const open = vi.fn(async (path: string) => ({ path, opened: true as const }));
    const host = mockHost({
      contextJson: JSON.stringify({
        projectName: "hello-world.aep",
        projectPath: fixtureAep,
        dirty: true,
        revision: 4,
        aeVersion: "25.0",
      }),
      open: open as AeHost["openProject"],
    });
    const result = await openProjectGuarded(host, fixtureAep, 1000);
    expect(result.alreadyOpen).toBe(true);
    expect(result.opened).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it("refuses a different open path (clean or dirty)", async () => {
    const open = vi.fn(async () => {
      throw new Error("should not open");
    });
    const host = mockHost({
      contextJson: JSON.stringify({
        projectName: "other.aep",
        projectPath: "/tmp/other.aep",
        dirty: false,
        revision: 2,
        aeVersion: "25.0",
      }),
      open: open as AeHost["openProject"],
    });
    await expect(openProjectGuarded(host, fixtureAep, 1000)).rejects.toMatchObject({
      code: "project_already_open",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("opens over a vacant clean untitled session", async () => {
    const open = vi.fn(async (path: string) => ({ path, opened: true as const }));
    const host = mockHost({
      contextJson: JSON.stringify({
        projectName: "Untitled Project",
        projectPath: null,
        dirty: false,
        revision: 0,
        aeVersion: "25.0",
      }),
      open: open as AeHost["openProject"],
    });
    await openProjectGuarded(host, fixtureAep, 1000);
    expect(open).toHaveBeenCalledWith(fixtureAep);
  });
});

describe("closeProject", () => {
  it("refuses stale fingerprint", async () => {
    const host = mockHost({
      contextJson: JSON.stringify({
        projectName: "Demo.aep",
        projectPath: "/tmp/Demo.aep",
        dirty: true,
        revision: 9,
        aeVersion: "25.0",
      }),
    });
    await expect(
      closeProject(host, {
        policy: "discard",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: "stale_fingerprint" });
  });

  it("refuses save policy when project has no path", async () => {
    const host = mockHost({
      contextJson: JSON.stringify({
        projectName: "Untitled",
        projectPath: null,
        dirty: true,
        revision: 2,
        aeVersion: "25.0",
      }),
    });
    await expect(closeProject(host, { policy: "save", timeoutMs: 1000 })).rejects.toMatchObject({
      code: "unsaved_cannot_save_close",
    });
  });

  it("evaluates DO_NOT_SAVE_CHANGES for discard", async () => {
    const ctx = {
      projectName: "Demo.aep",
      projectPath: "/tmp/Demo.aep",
      dirty: true,
      revision: 3,
      aeVersion: "25.0",
    };
    const host = mockHost({
      evalResults: [
        { ok: true, result: JSON.stringify(ctx) },
        { ok: true, result: JSON.stringify({ closed: true }) },
      ],
    });
    const result = await closeProject(host, { policy: "discard", timeoutMs: 1000 });
    expect(result).toEqual({ closed: true, policy: "discard" });
  });
});
