/** Shared inventory helpers -- inlined into each AE entry bundle. */

/// <reference path="../../../node_modules/types-for-adobe/AfterEffects/24.6/index.d.ts" />

export function projectNameOf(): string {
  let projectName = "";
  try {
    // Project.name exists at runtime; Types-for-Adobe 24.6 omits it -- guide/host win.
    const project = app.project as Project & { name?: string };
    projectName = project.file ? File.decode(project.file.name) : project.name || "";
  } catch (_e) {
    const project = app.project as Project & { name?: string };
    projectName = project.name || "";
  }
  return projectName;
}

export function itemById(itemId: number): Item | null {
  if (app.project.rootFolder && app.project.rootFolder.id === itemId) {
    return app.project.rootFolder;
  }
  const items = app.project.items;
  for (let i = 1; i <= items.length; i++) {
    if (items[i].id === itemId) return items[i];
  }
  return null;
}

export function isRootFolder(item: Item | null | undefined): boolean {
  return !!(item && item.id === app.project.rootFolder.id);
}

export function itemTypeName(item: Item): string {
  if (item instanceof FolderItem) return "folder";
  if (item instanceof CompItem) return "comp";
  if (item instanceof FootageItem) return "footage";
  return "item";
}

export function footageKindOf(footageItem: FootageItem): string {
  const src = footageItem.mainSource;
  if (src instanceof SolidSource) return "solid";
  if (src instanceof PlaceholderSource) return "placeholder";
  if (src instanceof FileSource) return "file";
  return "file";
}

export function folderPlacement(item: Item): {
  parentFolderId: number;
  folderPath: string;
} {
  const root = app.project.rootFolder;
  const parent = item.parentFolder;
  const parentFolderId = parent ? parent.id : root.id;
  const parts: string[] = [];
  let folder: FolderItem | null = parent;
  while (folder && folder.id !== root.id) {
    parts.unshift(folder.name);
    const next = folder.parentFolder;
    if (!next || next.id === folder.id) break;
    folder = next;
  }
  return {
    parentFolderId: parentFolderId,
    folderPath: parts.join("/"),
  };
}

export function parentFolderInfo(item: Item): { id: number; name: string } {
  try {
    if (item.parentFolder) {
      return { id: item.parentFolder.id, name: String(item.parentFolder.name || "") };
    }
  } catch (_e) {}
  return {
    id: app.project.rootFolder.id,
    name: String(app.project.rootFolder.name || "Root"),
  };
}

export function serializeSourceRef(avItem: AVItem | null | undefined): object | null {
  if (!avItem) return null;
  const placement = folderPlacement(avItem);
  const ref: Record<string, unknown> = {
    id: avItem.id,
    name: avItem.name,
    type: avItem instanceof CompItem ? "comp" : "footage",
    parentFolderId: placement.parentFolderId,
    folderPath: placement.folderPath,
  };
  if (ref.type === "footage") {
    ref.footageKind = footageKindOf(avItem as FootageItem);
  }
  return ref;
}

export function timeToFrame(time: number, frameRate: number): number {
  if (!frameRate || frameRate <= 0) return 0;
  return Math.round(Number(time) * Number(frameRate));
}

export function frameToTime(frame: number, frameRate: number): number {
  if (!frameRate || frameRate <= 0) return 0;
  return Number(frame) / Number(frameRate);
}

export function isOnGridFrame(time: number, frame: number, frameRate: number): boolean {
  if (!frameRate || frameRate <= 0) return false;
  const delta = Math.abs(Number(time) * Number(frameRate) - Number(frame));
  return delta < 1e-6;
}

export function layerTimingFrames(
  layer: Layer,
  frameRate: number,
): {
  startTime: number;
  inPoint: number;
  outPoint: number;
  startFrame: number;
  inFrame: number;
  outFrame: number;
  durationFrames: number;
  stretch: number;
} {
  const startTime = layer.startTime;
  const inPoint = layer.inPoint;
  const outPoint = layer.outPoint;
  const inFrame = timeToFrame(inPoint, frameRate);
  const outFrame = timeToFrame(outPoint, frameRate);
  return {
    startTime: startTime,
    inPoint: inPoint,
    outPoint: outPoint,
    startFrame: timeToFrame(startTime, frameRate),
    inFrame: inFrame,
    outFrame: outFrame,
    durationFrames: outFrame - inFrame,
    stretch: layer.stretch,
  };
}

export function transformMatchName(key: string): string | null {
  if (key === "anchorPoint") return "ADBE Anchor Point";
  if (key === "position") return "ADBE Position";
  if (key === "scale") return "ADBE Scale";
  if (key === "rotation") return "ADBE Rotate Z";
  if (key === "opacity") return "ADBE Opacity";
  return null;
}

export function isCoreTransformMatchName(matchName: string): boolean {
  return (
    matchName === "ADBE Anchor Point" ||
    matchName === "ADBE Position" ||
    matchName === "ADBE Scale" ||
    matchName === "ADBE Rotate Z" ||
    matchName === "ADBE Opacity"
  );
}

/** Keep in sync with src/inventory/comp-switches.ts COMP_SWITCH_KEYS. */
export const COMP_SWITCH_KEYS = [
  "motionBlur",
  "frameBlending",
  "draft3d",
  "hideShyLayers",
  "dropFrame",
  "preserveNestedResolution",
] as const;

export function compSwitchKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < COMP_SWITCH_KEYS.length; i++) {
    keys.push(COMP_SWITCH_KEYS[i]);
  }
  return keys;
}

export function readCompSwitches(comp: CompItem): { [key: string]: boolean } {
  const switches: { [key: string]: boolean } = {
    motionBlur: false,
    frameBlending: false,
    draft3d: false,
    hideShyLayers: false,
    dropFrame: false,
    preserveNestedResolution: false,
  };
  try {
    switches.motionBlur = !!comp.motionBlur;
  } catch (_e) {}
  try {
    switches.frameBlending = !!comp.frameBlending;
  } catch (_e) {}
  try {
    switches.draft3d = !!comp.draft3d;
  } catch (_e) {}
  try {
    switches.hideShyLayers = !!comp.hideShyLayers;
  } catch (_e) {}
  try {
    switches.dropFrame = !!comp.dropFrame;
  } catch (_e) {}
  try {
    switches.preserveNestedResolution = !!comp.preserveNestedResolution;
  } catch (_e) {}
  return switches;
}

export function readDisplayStartFrame(comp: CompItem, frameRate: number): number {
  try {
    return Number(comp.displayStartFrame);
  } catch (_e) {
    try {
      return timeToFrame(comp.displayStartTime, frameRate);
    } catch (_e2) {
      return 0;
    }
  }
}
