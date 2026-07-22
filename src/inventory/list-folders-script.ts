import { loadAeScript } from "../host/load-ae-script.js";

/**
 * ExtendScript that walks app.project.rootFolder into a nested JSON tree.
 * Source: src/ae-scripts/entries/list-folders.ts (built to dist/ae-scripts/).
 */
export const LIST_FOLDERS_SCRIPT = loadAeScript("list-folders");
