import { PATCH_MAX_TARGETS } from "./constants.js";

export type BroadGateRefusal = {
  code: "broad_target_set";
  resolvedTargetCount: number;
  maxTargets: number;
  message: string;
};

/** Fail closed when resolved targets exceed the built-in max without acknowledgment. */
export function checkBroadTargetGate(
  resolvedTargetCount: number,
  allowBroadTargetSet: boolean,
  maxTargets: number = PATCH_MAX_TARGETS,
): BroadGateRefusal | null {
  if (resolvedTargetCount > maxTargets && !allowBroadTargetSet) {
    return {
      code: "broad_target_set",
      resolvedTargetCount,
      maxTargets,
      message:
        `Resolved target count (${resolvedTargetCount}) exceeds built-in maximum (${maxTargets}). ` +
        "Pass allowBroadTargetSet: true to proceed.",
    };
  }
  return null;
}
