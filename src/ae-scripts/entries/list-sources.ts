import { folderPlacement, footageKindOf, projectNameOf } from "../shared/inventory";

function serializeSource(item: FootageItem): Record<string, unknown> {
  const placement = folderPlacement(item);
  const kind = footageKindOf(item);
  const main = item.mainSource;
  let file: string | null = null;
  let missingFootagePath: string | null = null;
  let solidColor: number[] | null = null;
  let isStill = false;

  if (kind === "file" && main) {
    try {
      if (main.file) file = main.file.fsName;
    } catch (_e) {}
    try {
      const missing = (main as any).missingFootagePath;
      if (missing !== undefined && missing !== null && missing !== "") {
        missingFootagePath = String(missing);
      }
    } catch (_e) {}
  }
  if (kind === "solid" && main) {
    try {
      const color = (main as SolidSource).color;
      solidColor = [color[0], color[1], color[2]];
    } catch (_e) {}
  }
  try {
    if (main) isStill = !!main.isStill;
  } catch (_e) {}

  const usedInCompIds: number[] = [];
  try {
    const used = item.usedIn;
    if (used) {
      for (let usedIndex = 0; usedIndex < used.length; usedIndex++) {
        usedInCompIds.push(used[usedIndex].id);
      }
    }
  } catch (_e) {}

  return {
    id: item.id,
    name: item.name,
    label: item.label,
    comment: item.comment ? String(item.comment) : "",
    footageKind: kind,
    width: item.width,
    height: item.height,
    pixelAspect: item.pixelAspect,
    frameRate: item.frameRate,
    duration: item.duration,
    hasVideo: !!item.hasVideo,
    hasAudio: !!item.hasAudio,
    footageMissing: !!item.footageMissing,
    isStill: isStill,
    useProxy: !!item.useProxy,
    file: file,
    missingFootagePath: missingFootagePath,
    solidColor: solidColor,
    parentFolderId: placement.parentFolderId,
    folderPath: placement.folderPath,
    usedInCompIds: usedInCompIds,
  };
}

export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }

  const sources: Record<string, unknown>[] = [];
  const items = app.project.items;
  for (let itemIndex = 1; itemIndex <= items.length; itemIndex++) {
    const item = items[itemIndex];
    if (item instanceof FootageItem) {
      sources.push(serializeSource(item));
    }
  }

  return JSON.stringify({
    projectName: projectNameOf(),
    sources: sources,
  });
}
