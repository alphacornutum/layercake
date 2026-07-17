import type { AeHost } from "../host/types.js";
import { buildPatchApplyScript } from "./apply-script.js";
import { patchProjectInputSchema, type PatchProjectInput } from "./schema.js";
import type {
  PatchApplyFailure,
  PatchApplyResult,
  PatchApplySuccess,
  PatchOperationResult,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePatchApplyResult(json: string): PatchApplyResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return {
      ok: false,
      error: "Invalid patch result: not valid JSON",
      code: "apply_failed",
    };
  }
  if (!isRecord(data)) {
    return {
      ok: false,
      error: "Invalid patch result: root must be an object",
      code: "apply_failed",
    };
  }

  if (data.ok === true) {
    const success: PatchApplySuccess = {
      ok: true,
      results: Array.isArray(data.results) ? (data.results as PatchOperationResult[]) : [],
      fingerprint: String(data.fingerprint ?? ""),
      dirty: Boolean(data.dirty),
      revision: Number(data.revision),
    };
    return success;
  }

  const failure: PatchApplyFailure = {
    ok: false,
    error: String(data.error ?? "Patch apply failed"),
    code: (data.code as PatchApplyFailure["code"]) ?? "apply_failed",
  };
  if (isRecord(data.context)) {
    failure.context = {
      projectPath:
        data.context.projectPath === null || data.context.projectPath === undefined
          ? null
          : String(data.context.projectPath),
      dirty: Boolean(data.context.dirty),
      revision: Number(data.context.revision),
      fingerprint: String(data.context.fingerprint ?? ""),
      aeVersion: String(data.context.aeVersion ?? ""),
    };
  }
  if (Array.isArray(data.results)) {
    failure.results = data.results as PatchOperationResult[];
  }
  if (isRecord(data.rollback)) {
    failure.rollback = {
      attempted: Boolean(data.rollback.attempted),
      completed: Boolean(data.rollback.completed),
    };
  }
  if (typeof data.resolvedTargetCount === "number") {
    failure.resolvedTargetCount = data.resolvedTargetCount;
  }
  if (typeof data.maxTargets === "number") {
    failure.maxTargets = data.maxTargets;
  }
  return failure;
}

export async function applyProjectPatch(
  host: AeHost,
  input: unknown,
  timeoutMs: number,
): Promise<PatchApplyResult> {
  const parsed = patchProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid patch input: ${parsed.error.message}`,
      code: "validation",
    };
  }
  const body: PatchProjectInput = parsed.data;
  const script = buildPatchApplyScript(JSON.stringify(body));
  const result = await host.evalScript(script, timeoutMs);
  if (!result.ok) {
    const line = result.line !== undefined ? ` (line ${result.line})` : "";
    return {
      ok: false,
      error: `${result.error}${line}`,
      code: "apply_failed",
    };
  }
  return parsePatchApplyResult(result.result);
}
