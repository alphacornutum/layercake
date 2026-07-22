import { footageKindOf, projectNameOf } from "../shared/inventory";

type FolderChild =
  | {
      id: number;
      name: string;
      type: "folder";
      children: FolderChild[];
    }
  | {
      id: number;
      name: string;
      type: "comp";
    }
  | {
      id: number;
      name: string;
      type: "footage";
      footageKind: string;
    };

function serializeFolderNode(folder: FolderItem, isRoot: boolean): FolderChild {
  let name = folder.name;
  if (isRoot && (!name || name === "")) {
    name = "Root";
  }
  const children: FolderChild[] = [];
  for (let i = 1; i <= folder.numItems; i++) {
    const child = folder.item(i);
    if (child instanceof FolderItem) {
      children.push(serializeFolderNode(child, false));
    } else if (child instanceof CompItem) {
      children.push({
        id: child.id,
        name: child.name,
        type: "comp",
      });
    } else if (child instanceof FootageItem) {
      children.push({
        id: child.id,
        name: child.name,
        type: "footage",
        footageKind: footageKindOf(child),
      });
    }
  }
  return {
    id: folder.id,
    name: name,
    type: "folder",
    children: children,
  };
}

/** Inventory entry: nested project folder tree. */
export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }

  return JSON.stringify({
    projectName: projectNameOf(),
    root: serializeFolderNode(app.project.rootFolder, true),
  });
}
