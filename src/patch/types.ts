export type PatchOpStatus =
  | "changed"
  | "already_satisfied"
  | "skipped_precondition"
  | "unsupported"
  | "failed";

export type TextStyleTargetResult = {
  compId: number;
  layerId: number;
  compName?: string;
  layerName?: string;
  status: PatchOpStatus;
  before?: { fonts: string[] };
  after?: { fonts: string[] };
  message?: string;
};

export type PatchOperationResult = {
  index: number;
  op: string;
  status: PatchOpStatus;
  targets: TextStyleTargetResult[];
  message?: string;
};

export type PatchRollbackReport = {
  attempted: boolean;
  completed: boolean;
};

export type PatchApplySuccess = {
  ok: true;
  results: PatchOperationResult[];
  fingerprint: string;
  dirty: boolean;
  revision: number;
};

export type PatchApplyFailure = {
  ok: false;
  error: string;
  code:
    | "stale_fingerprint"
    | "path_mismatch"
    | "broad_target_set"
    | "validation"
    | "apply_failed"
    | "no_project";
  context?: {
    projectPath: string | null;
    dirty: boolean;
    revision: number;
    fingerprint: string;
    aeVersion: string;
  };
  results?: PatchOperationResult[];
  rollback?: PatchRollbackReport;
  resolvedTargetCount?: number;
  maxTargets?: number;
};

export type PatchApplyResult = PatchApplySuccess | PatchApplyFailure;
