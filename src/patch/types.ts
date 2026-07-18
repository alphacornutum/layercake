export type PatchOpStatus =
  | "changed"
  | "already_satisfied"
  | "skipped_precondition"
  | "unsupported"
  | "failed";

/** Text-style target evidence (`set_text_style`). */
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

/** Project-panel target evidence (`create_folder` / `move_project_item` / `delete_project_item`). */
export type PanelTargetResult = {
  itemId: number;
  itemName?: string;
  itemType?: string;
  status: PatchOpStatus;
  before?: { parentFolderId?: number; parentFolderName?: string };
  after?: { parentFolderId?: number; parentFolderName?: string };
  /** Present on successful `create_folder` targets. */
  created?: { id: number; name: string; parentFolderId: number };
  /** Present on `delete_project_item` before removal. */
  nestedItemCount?: number;
  usedInCompIds?: number[];
  usedInCompCount?: number;
  message?: string;
};

export type PatchTargetResult = TextStyleTargetResult | PanelTargetResult;

export type PatchOperationResult = {
  index: number;
  op: string;
  status: PatchOpStatus;
  targets: PatchTargetResult[];
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
