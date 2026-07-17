import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * ExtendScript that walks app.project.rootFolder into a nested JSON tree.
 */
const LIST_FOLDERS_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function serializeFolderNode(folder, isRoot) {
  var name = folder.name;
  if (isRoot && (!name || name === "")) {
    name = "Root";
  }
  var children = [];
  for (var i = 1; i <= folder.numItems; i++) {
    var child = folder.item(i);
    if (child instanceof FolderItem) {
      children.push(serializeFolderNode(child, false));
    } else if (child instanceof CompItem) {
      children.push({
        id: child.id,
        name: child.name,
        type: "comp"
      });
    } else if (child instanceof FootageItem) {
      children.push({
        id: child.id,
        name: child.name,
        type: "footage",
        footageKind: footageKindOf(child)
      });
    }
  }
  return {
    id: folder.id,
    name: name,
    type: "folder",
    children: children
  };
}

return JSON.stringify({
  projectName: projectNameOf(),
  root: serializeFolderNode(app.project.rootFolder, true)
});
`.trim();

export const LIST_FOLDERS_SCRIPT = `${SHARED_INVENTORY_HELPERS}\n\n${LIST_FOLDERS_BODY}`;
