import { describe, expect, it, vi } from "vitest";

import type { AeHost } from "../src/host/types.js";
import { applyProjectPatch, parsePatchApplyResult } from "../src/patch/apply.js";
import { buildPatchApplyScript } from "../src/patch/apply-script.js";
import { checkBroadTargetGate } from "../src/patch/broad-gate.js";
import { PATCH_MAX_TARGETS } from "../src/patch/constants.js";
import { patchProjectInputSchema } from "../src/patch/schema.js";
import { saveProject } from "../src/patch/save.js";

describe("patchProjectInputSchema", () => {
  it("accepts set_text_style apply-only payload", () => {
    const parsed = patchProjectInputSchema.parse({
      project: { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" },
      operations: [
        {
          op: "set_text_style",
          selector: { kind: "all_text_layers" },
          style: { font: "ArialMT" },
        },
      ],
    });
    expect(parsed.operations[0]?.op).toBe("set_text_style");
    expect(parsed.allowBroadTargetSet).toBe(false);
  });

  it("rejects unknown ops and rename", () => {
    const result = patchProjectInputSchema.safeParse({
      project: { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" },
      operations: [{ op: "rename", selector: { kind: "all_text_layers" }, name: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty operations", () => {
    const result = patchProjectInputSchema.safeParse({
      project: { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" },
      operations: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkBroadTargetGate", () => {
  it("allows counts at or below the built-in max", () => {
    expect(checkBroadTargetGate(PATCH_MAX_TARGETS, false)).toBeNull();
  });

  it("refuses over-max without allowBroadTargetSet", () => {
    const refusal = checkBroadTargetGate(PATCH_MAX_TARGETS + 1, false);
    expect(refusal?.code).toBe("broad_target_set");
    expect(refusal?.resolvedTargetCount).toBe(PATCH_MAX_TARGETS + 1);
  });

  it("allows over-max when acknowledged", () => {
    expect(checkBroadTargetGate(PATCH_MAX_TARGETS + 10, true)).toBeNull();
  });
});

describe("buildPatchApplyScript", () => {
  it("includes guards, undo group, font apply, and broad gate", () => {
    const script = buildPatchApplyScript(
      JSON.stringify({
        project: { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" },
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "layers", layers: [{ compId: 1, layerId: 2 }] },
            style: { font: "ArialMT" },
            allStyleRuns: true,
            preserveUnspecified: true,
          },
        ],
        allowBroadTargetSet: false,
      }),
    );
    expect(script).toContain("stale_fingerprint");
    expect(script).toContain("path_mismatch");
    expect(script).toContain("broad_target_set");
    expect(script).toContain("beginUndoGroup");
    expect(script).toContain("already_satisfied");
    expect(script).toContain("characterRange");
    expect(script).toContain("Source Text");
    expect(script).toContain("resolveSelector");
    expect(script).not.toContain("planToken");
    expect(script).not.toContain("replaceFont");
  });
});

describe("parsePatchApplyResult", () => {
  it("shapes success, stale, idempotent, and rollback failures", () => {
    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: true,
          results: [
            {
              index: 0,
              op: "set_text_style",
              status: "already_satisfied",
              targets: [{ compId: 1, layerId: 2, status: "already_satisfied" }],
            },
          ],
          fingerprint: "rev:2|dirty:1|path:/tmp/Demo.aep",
          dirty: true,
          revision: 2,
        }),
      ),
    ).toMatchObject({ ok: true, revision: 2 });

    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: false,
          error: "Stale",
          code: "stale_fingerprint",
          context: {
            projectPath: "/tmp/Demo.aep",
            dirty: false,
            revision: 9,
            fingerprint: "rev:9|dirty:0|path:/tmp/Demo.aep",
            aeVersion: "25.0",
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "stale_fingerprint" });

    expect(
      parsePatchApplyResult(
        JSON.stringify({
          ok: false,
          error: "boom",
          code: "apply_failed",
          results: [{ index: 0, op: "set_text_style", status: "failed", targets: [] }],
          rollback: { attempted: true, completed: true },
        }),
      ),
    ).toMatchObject({
      ok: false,
      rollback: { attempted: true, completed: true },
    });
  });
});

describe("applyProjectPatch", () => {
  it("returns validation errors without calling the host", async () => {
    const evalScript = vi.fn();
    const host = { evalScript } as unknown as AeHost;
    const result = await applyProjectPatch(host, { operations: [] }, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
    expect(evalScript).not.toHaveBeenCalled();
  });

  it("surfaces stale fingerprint from host JSON", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          ok: false,
          error: "Stale fingerprint",
          code: "stale_fingerprint",
          context: {
            projectPath: "/tmp/Demo.aep",
            dirty: false,
            revision: 3,
            fingerprint: "rev:3|dirty:0|path:/tmp/Demo.aep",
            aeVersion: "25.0",
          },
        }),
      }),
    } as unknown as AeHost;
    const result = await applyProjectPatch(
      host,
      {
        project: { path: "/tmp/Demo.aep", fingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep" },
        operations: [
          {
            op: "set_text_style",
            selector: { kind: "all_text_layers" },
            style: { font: "ArialMT" },
          },
        ],
      },
      1000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_fingerprint");
  });
});

describe("saveProject", () => {
  it("refuses overwrite when destination exists", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "lc-save-"));
    const dest = join(dir, "copy.aep");
    writeFileSync(dest, "existing");

    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 1,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;

    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: dest,
      },
      { artifactDir: dir, timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("overwrite_refused");
  });

  it("refuses stale fingerprint", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 5,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: "/tmp/out.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_fingerprint");
  });

  it("refuses create_backup when the project is dirty", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: true,
          revision: 4,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "create_backup",
        expectedFingerprint: "rev:4|dirty:1|path:/tmp/Demo.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.error).toMatch(/clean, saved project/i);
    }
  });

  it("requires absolute path for save_copy", async () => {
    const host = {
      evalScript: async () => ({
        ok: true as const,
        result: JSON.stringify({
          projectName: "Demo.aep",
          projectPath: "/tmp/Demo.aep",
          dirty: false,
          revision: 1,
          aeVersion: "25.0",
        }),
      }),
    } as unknown as AeHost;
    const result = await saveProject(
      host,
      {
        mode: "save_copy",
        expectedFingerprint: "rev:1|dirty:0|path:/tmp/Demo.aep",
        path: "relative.aep",
      },
      { artifactDir: "/tmp", timeoutMs: 1000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
  });
});
