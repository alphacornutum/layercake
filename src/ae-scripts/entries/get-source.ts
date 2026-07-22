import { folderPlacement, footageKindOf, projectNameOf } from "../shared/inventory";
import { resolveFootage } from "../shared/resolve";
import { inspectFail, serializeInterpretFull, serializeInterpretSummary } from "../shared/inspect";

declare const __args: any;

function serializeSourceRow(item: FootageItem): any {
  const placement = folderPlacement(item);
  const kind = footageKindOf(item);
  const main: any = item.mainSource;
  let file: string | null = null;
  let missingFootagePath: string | null = null;
  let solidColor: number[] | null = null;
  let isStill = false;
  if (kind === "file" && main) {
    try {
      if (main.file) file = main.file.fsName;
    } catch (_e) {}
    try {
      if (main.missingFootagePath) missingFootagePath = String(main.missingFootagePath);
    } catch (_e) {}
  }
  if (kind === "solid" && main)
    try {
      solidColor = [main.color[0], main.color[1], main.color[2]];
    } catch (_e) {}
  try {
    if (main) isStill = !!main.isStill;
  } catch (_e) {}
  const usedInCompIds: number[] = [];
  try {
    for (let i = 0; i < item.usedIn.length; i++) usedInCompIds.push(item.usedIn[i].id);
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
    isStill,
    useProxy: !!(item as any).useProxy,
    file,
    missingFootagePath,
    solidColor,
    parentFolderId: placement.parentFolderId,
    folderPath: placement.folderPath,
    usedInCompIds,
  };
}
export function main(): string {
  if (!app.project)
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  const item = resolveFootage(__args.sourceId, __args.sourceName, inspectFail);
  const detail = __args.detail || "overview";
  const source: any = serializeSourceRow(item);
  if (detail === "overview") source.interpret = serializeInterpretSummary(item.mainSource);
  else {
    source.mainSource = serializeInterpretFull(item.mainSource, source.footageKind);
    source.proxySource = null;
    try {
      if ((item as any).useProxy && (item as any).proxySource)
        source.proxySource = serializeInterpretFull((item as any).proxySource, null);
    } catch (_e) {}
  }
  return JSON.stringify({ projectName: projectNameOf(), detail, source });
}
