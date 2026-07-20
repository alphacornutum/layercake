import type { CompSwitchesSnapshot } from "../inventory/comp-switches.js";

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

/** `rename_project_item` target evidence. */
export type RenameProjectItemTargetResult = PanelItemTargetBase & {
  before?: { name: string };
  after?: { name: string };
};

/** `set_layer_index` target evidence. */
export type SetLayerIndexTargetResult = LayerTargetBase & {
  before?: { index: number };
  after?: { index: number };
};

/** `create_solid` target evidence. */
export type CreateSolidTargetResult = PanelItemTargetBase & {
  created?: {
    id: number;
    name: string;
    width: number;
    height: number;
    pixelAspect: number;
    color: [number, number, number];
    parentFolderId: number;
  };
};

/** `replace_layer_source` target evidence. */
export type ReplaceLayerSourceTargetResult = LayerTargetBase & {
  layerIdPreserved?: boolean;
  newLayerId?: number;
  before?: { sourceItemId: number | null };
  after?: { sourceItemId: number | null };
};

export type LayerTimingFrames = {
  startFrame?: number;
  inFrame?: number;
  outFrame?: number;
  /** Derived exclusive-end span: outFrame - inFrame. */
  durationFrames?: number;
  /** Raw AE layer seconds (diagnose off-grid edges). */
  startTime?: number;
  inPoint?: number;
  outPoint?: number;
  stretch?: number;
};

/** Full switch-snapshot keys readable on a layer (omit when host cannot read). */
export type LayerSwitchesSnapshot = {
  enabled?: boolean;
  audioEnabled?: boolean;
  solo?: boolean;
  shy?: boolean;
  locked?: boolean;
  guideLayer?: boolean;
  adjustmentLayer?: boolean;
  threeDLayer?: boolean;
  collapseTransformation?: boolean;
  frameBlending?: boolean;
  motionBlur?: boolean;
  timeRemapEnabled?: boolean;
};

/** Compact keyframe drift entry for `set_layer_timing` failure evidence. */
export type KeyframeDriftEntry = {
  matchNames: string[];
  beforeTime: number | null;
  afterTime: number | null;
};

/** `set_layer_timing` target evidence. */
export type SetLayerTimingTargetResult = LayerTargetBase & {
  before?: LayerTimingFrames;
  after?: LayerTimingFrames;
  /** True when key times/values match pre-write snapshot (or layer had no keys). */
  keyframesPreserved?: boolean;
  /** Present when preservation failed; capped list of drifted keys. */
  keyframeDrift?: KeyframeDriftEntry[];
  keyframeDriftTruncated?: boolean;
};

/** `set_layer_switches` target evidence (full switch snapshot before/after). */
export type SetLayerSwitchesTargetResult = LayerTargetBase & {
  before?: LayerSwitchesSnapshot;
  after?: LayerSwitchesSnapshot;
};

/** Full composition settings snapshot (inventory / patch evidence). */
export type CompSettingsSnapshot = {
  width: number;
  height: number;
  pixelAspect: number;
  frameRate: number;
  durationFrames: number;
  displayStartFrame: number;
  workAreaStartFrame: number;
  workAreaDurationFrames: number;
  renderer: string;
  switches: CompSwitchesSnapshot;
};

/** `set_comp_settings` target evidence (full settings snapshot before/after). */
export type SetCompSettingsTargetResult = {
  compId: number;
  compName: string;
  status: PatchOpStatus;
  message?: string;
  before?: CompSettingsSnapshot;
  after?: CompSettingsSnapshot;
};

/** `set_property_expression` target evidence. */
export type SetPropertyExpressionTargetResult = LayerTargetBase & {
  selector?: { matchNames?: string[]; propertyPath?: string };
  resolvedMatchNames?: string[];
  before?: { expression: string; expressionEnabled: boolean };
  after?: { expression: string; expressionEnabled: boolean };
};

/** Authored/pre-expression 2D Transform allowlist snapshot. */
export type LayerTransformSnapshot = {
  anchorPoint?: number[];
  position?: number[];
  scale?: number[];
  rotation?: number;
  opacity?: number;
};

/** `set_layer_transform` target evidence (full transform snapshot before/after). */
export type SetLayerTransformTargetResult = LayerTargetBase & {
  before?: LayerTransformSnapshot;
  after?: LayerTransformSnapshot;
};

/** `reset_layer_surface` target evidence. */
export type ResetLayerSurfaceTargetResult = LayerTargetBase & {
  cleared?: {
    keyframes?: boolean;
    effects?: boolean;
    masks?: boolean;
    layerStyles?: boolean;
    markers?: boolean;
    trackMatte?: boolean;
    parent?: boolean;
    expressions?: boolean;
  };
  /** Present when `resetTransforms` was requested (authored transform snapshot). */
  before?: { transforms: LayerTransformSnapshot };
  after?: {
    effectCount?: number;
    maskCount?: number;
    markerCount?: number;
    hasParent?: boolean;
    hasTrackMatte?: boolean;
    /** Present when `resetTransforms` was requested (authored transform snapshot). */
    transforms?: LayerTransformSnapshot;
  };
};

/** `delete_layer` target evidence. */
export type DeleteLayerTargetResult = LayerTargetBase & {
  deleted?: boolean;
};

/** `safe_delete_project_item` target evidence. */
export type SafeDeleteProjectItemTargetResult = PanelItemTargetBase & {
  preDeleteRefs?: {
    refs: unknown[];
    unknownRefsPossible: boolean;
    incompleteReasons: string[];
  };
  newlyMissingFootageIds?: number[];
};

export type PanelTargetResult =
  | CreateFolderTargetResult
  | MoveProjectItemTargetResult
  | DeleteProjectItemTargetResult
  | RenameProjectItemTargetResult
  | CreateSolidTargetResult
  | SafeDeleteProjectItemTargetResult;

export type PatchTargetResult =
  | TextStyleTargetResult
  | RenameLayerTargetResult
  | PanelTargetResult
  | SetLayerIndexTargetResult
  | ReplaceLayerSourceTargetResult
  | SetLayerTimingTargetResult
  | SetLayerSwitchesTargetResult
  | SetCompSettingsTargetResult
  | SetPropertyExpressionTargetResult
  | SetLayerTransformTargetResult
  | ResetLayerSurfaceTargetResult
  | DeleteLayerTargetResult;

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
