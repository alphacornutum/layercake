export type PatchOpStatus =
  | "changed"
  | "already_satisfied"
  | "skipped_precondition"
  | "unsupported"
  | "failed";

type LayerTargetBase = {
  compId: number;
  layerId: number;
  compName?: string;
  layerName?: string;
  status: PatchOpStatus;
  message?: string;
};

/** Text-style target evidence (`set_text_style`). `fonts` = authored / pre-expression. */
export type TextStyleTargetResult = LayerTargetBase & {
  before?: { fonts: string[]; evaluatedFonts?: string[] };
  after?: { fonts: string[]; evaluatedFonts?: string[] };
};

/** `rename_layer` target evidence (verified before/after names). */
export type RenameLayerTargetResult = LayerTargetBase & {
  before?: { name: string };
  after?: { name: string };
};

export type PanelFolderPlacement = {
  parentFolderId?: number;
  parentFolderName?: string;
};

type PanelItemTargetBase = {
  itemId: number;
  itemName?: string;
  itemType?: string;
  status: PatchOpStatus;
  message?: string;
};

/** `create_folder` target evidence. */
export type CreateFolderTargetResult = PanelItemTargetBase & {
  created?: { id: number; name: string; parentFolderId: number };
  after?: PanelFolderPlacement;
};

/** `move_project_item` target evidence. */
export type MoveProjectItemTargetResult = PanelItemTargetBase & {
  before?: PanelFolderPlacement;
  after?: PanelFolderPlacement;
};

/** `delete_project_item` target evidence (impact captured before remove). */
export type DeleteProjectItemTargetResult = PanelItemTargetBase & {
  nestedItemCount: number;
  usedInCompIds: number[];
  usedInCompCount: number;
};

export type PanelTargetResult =
  | CreateFolderTargetResult
  | MoveProjectItemTargetResult
  | DeleteProjectItemTargetResult;

export type PatchTargetResult = TextStyleTargetResult | RenameLayerTargetResult | PanelTargetResult;

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
