import type { CompSwitchesSnapshot } from "./comp-switches.js";
import type { LayerTarget } from "./layer-target-schema.js";

export type { CompSwitchKey, CompSwitchesSnapshot } from "./comp-switches.js";
export { COMP_SWITCH_KEYS } from "./comp-switches.js";

export type LayerType =
  | "av"
  | "text"
  | "shape"
  | "camera"
  | "light"
  | "null"
  | "adjustment"
  | "guide"
  | "other";

export type FootageKind = "file" | "solid" | "placeholder";

export type SourceRefType = "footage" | "comp";

/** Compact join key from a layer to its AVItem source (Item.id namespace). */
export type InventorySourceRef = {
  id: number;
  name: string;
  type: SourceRefType;
  footageKind?: FootageKind;
  parentFolderId: number;
  folderPath: string;
};

export type InventoryLayer = {
  id: number;
  index: number;
  name: string;
  type: LayerType;
  inPoint: number;
  outPoint: number;
  duration: number;
  stretch: number;
  /** Layer start time in seconds (comp timeline). */
  startTime: number;
  /** Integer frames derived with containing-comp frameRate (nearest). */
  startFrame: number;
  inFrame: number;
  outFrame: number;
  durationFrames: number;
  motionBlur: boolean;
  label: number;
  hasEffects: boolean;
  enabled: boolean;
  hasVideo?: boolean;
  videoEnabled?: boolean;
  hasAudio?: boolean;
  audioEnabled?: boolean;
  guideLayer?: boolean;
  adjustmentLayer?: boolean;
  threeDLayer?: boolean;
  collapseTransformation?: boolean;
  frameBlending?: boolean;
  timeRemapEnabled?: boolean;
  parentLayerId?: number | null;
  trackMatteType?: string | null;
  trackMatteLayerId?: number | null;
  source?: InventorySourceRef;
};

export type InventoryComposition = {
  id: number;
  name: string;
  duration: number;
  frameRate: number;
  width: number;
  height: number;
  pixelAspect: number;
  durationFrames: number;
  displayStartFrame: number;
  workAreaStartFrame: number;
  workAreaDurationFrames: number;
  renderer: string;
  switches: CompSwitchesSnapshot;
  numLayers: number;
  layers: InventoryLayer[];
};

export type CompInventory = {
  projectName: string;
  compositions: InventoryComposition[];
  missing: {
    compIds: number[];
    compNames: string[];
  };
};

export type CompInventoryFilter = {
  compIds?: number[];
  compNames?: string[];
};

export type InventorySource = {
  id: number;
  name: string;
  label: number;
  comment: string;
  footageKind: FootageKind;
  width: number;
  height: number;
  pixelAspect: number;
  frameRate: number;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  footageMissing: boolean;
  isStill: boolean;
  useProxy: boolean;
  file: string | null;
  missingFootagePath: string | null;
  solidColor: [number, number, number] | null;
  parentFolderId: number;
  folderPath: string;
  usedInCompIds: number[];
};

export type SourceInventory = {
  projectName: string;
  sources: InventorySource[];
};

export type FolderTreeLeaf =
  | {
      id: number;
      name: string;
      type: "comp";
    }
  | {
      id: number;
      name: string;
      type: "footage";
      footageKind: FootageKind;
    };

export type FolderTreeNode = {
  id: number;
  name: string;
  type: "folder";
  children: Array<FolderTreeNode | FolderTreeLeaf>;
};

export type FolderInventory = {
  projectName: string;
  root: FolderTreeNode;
};

/** Depth tiers for `ae_get_layer`. */
export type LayerInspectDetail = "overview" | "extended" | "full";

/** Depth tiers for `ae_get_source`. */
export type SourceInspectDetail = "overview" | "full";

/** Best-effort value that could not be serialized in v1. */
export type UnserializableValue = {
  unserializable: true;
  propertyValueType: string;
};

export type InspectIdentity = {
  id: number;
  name: string;
};

export type LayerInspectCandidate = {
  id: number;
  index: number;
  name: string;
};

/** Structured lookup failure from inspect scripts (encoded in Error message). */
export type InspectLookupErrorPayload = {
  code: "not_found" | "ambiguous_comp_name" | "ambiguous_layer_name" | "ambiguous_source_name";
  message: string;
  candidates?: Array<InspectIdentity | LayerInspectCandidate>;
};

export type InspectKeyframeEase = {
  speed: number;
  influence: number;
};

export type InspectKeyframe = {
  time: number;
  value: unknown;
  inInterpolationType?: string;
  outInterpolationType?: string;
  inEase?: InspectKeyframeEase[];
  outEase?: InspectKeyframeEase[];
  inSpatialTangent?: number[];
  outSpatialTangent?: number[];
};

export type InspectPropertyNode = {
  name: string;
  matchName: string;
  propertyIndex: number;
  isGroup: boolean;
  enabled?: boolean;
  active?: boolean;
  propertyValueType?: string;
  numKeys?: number;
  hasExpression?: boolean;
  expressionEnabled?: boolean;
  expression?: string;
  /** Sample under caller's `preExpression` flag. */
  value?: unknown;
  /** Pre-expression sample (`valueAtTime(..., true)`); Transform / TextDocument dual-sample fields. */
  authoredValue?: unknown;
  /** Post-expression sample (`valueAtTime(..., false)`); Transform / TextDocument dual-sample fields. */
  evaluatedValue?: unknown;
  keyframes?: InspectKeyframe[];
  properties?: InspectPropertyNode[];
};

export type LayerInspectLayer = {
  id: number;
  index: number;
  name: string;
  type: LayerType;
  inPoint: number;
  outPoint: number;
  duration: number;
  stretch: number;
  startTime: number;
  motionBlur: boolean;
  label: number;
  hasEffects: boolean;
  enabled?: boolean;
  solo?: boolean;
  shy?: boolean;
  locked?: boolean;
  source?: InventorySourceRef;
  properties: InspectPropertyNode[];
};

export type LayerInspectResult = {
  projectName: string;
  detail: LayerInspectDetail;
  atTime: number;
  preExpression: boolean;
  matchNames: string[] | null;
  comp: {
    id: number;
    name: string;
    duration: number;
    frameRate: number;
    time: number;
  };
  layer: LayerInspectLayer;
};

export type GetLayerArgs = LayerTarget & {
  detail?: LayerInspectDetail;
  matchNames?: string[];
  atTime?: number;
  preExpression?: boolean;
};

export type FootageInterpretSummary = {
  hasAlpha?: boolean;
  alphaMode?: string;
  invertAlpha?: boolean;
  isStill?: boolean;
  loop?: number;
  nativeFrameRate?: number;
  conformFrameRate?: number;
  displayFrameRate?: number;
  fieldSeparationType?: string;
};

export type FootageInterpretFull = FootageInterpretSummary & {
  premulColor?: [number, number, number] | null;
  highQualityFieldSeparation?: boolean;
  removePulldown?: string;
  kind: FootageKind;
  file?: string | null;
  missingFootagePath?: string | null;
  solidColor?: [number, number, number] | null;
};

export type SourceInspectResult = {
  projectName: string;
  detail: SourceInspectDetail;
  source: InventorySource & {
    interpret?: FootageInterpretSummary;
    mainSource?: FootageInterpretFull;
    proxySource?: FootageInterpretFull | null;
  };
};

export type GetSourceArgs = {
  sourceId?: number;
  sourceName?: string;
  detail?: SourceInspectDetail;
};

/** Reference kind for `ae_get_item_refs`. */
export type ItemRefKind =
  | "used_in_comp"
  | "layer_source"
  | "proxy_for"
  | "has_proxy"
  | "track_matte"
  | "parent_link"
  | "expression_mention";

export type ItemRefEntry = {
  kind: ItemRefKind;
  compId?: number;
  compName?: string;
  layerId?: number;
  layerName?: string;
  itemId?: number;
  proxyItemId?: number;
  matteLayerId?: number;
  parentLayerId?: number;
  propertyPath?: string;
  confidence?: "heuristic";
};

export type ItemRefsResult = {
  item: {
    id: number;
    name: string;
    type: "folder" | "comp" | "footage" | "item";
  };
  refs: ItemRefEntry[];
  unknownRefsPossible: boolean;
  incompleteReasons: string[];
};

export type EffectOrigin = "firstParty" | "thirdParty";

export type ProjectSummaryEffect = {
  matchName: string;
  displayName: string;
  origin: EffectOrigin;
  available: boolean;
  instanceCount: number;
};

export type ProjectSummaryMissingFootage = {
  id: number;
  name: string;
  missingFootagePath: string | null;
};

/** Lean bind token from `ae_project_context` (no health walks). */
export type ProjectContext = {
  projectName: string;
  projectPath: string | null;
  dirty: boolean;
  revision: number;
  fingerprint: string;
  aeVersion: string;
  /** Present when dirty — live state may differ from the last saved file. */
  warning?: string;
};

/** Compact project passport from `ae_project_summary`. */
export type ProjectSummary = {
  projectName: string;
  projectPath: string | null;
  aeVersion: string;
  numComps: number;
  numFootage: number;
  numFolders: number;
  numLayers: number;
  bitsPerChannel: number;
  timeDisplayType: string;
  hasThirdPartyEffects: boolean;
  effects: ProjectSummaryEffect[];
  missingFootageCount: number;
  missingFootage: ProjectSummaryMissingFootage[];
  fontsApiAvailable: boolean;
  missingOrSubstitutedFonts: string[];
};
