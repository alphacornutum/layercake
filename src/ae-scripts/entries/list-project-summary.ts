import { projectNameOf } from "../shared/inventory";

function projectPathOf(): string | null {
  try {
    if (app.project.file) return app.project.file.fsName;
  } catch (_e) {}
  return null;
}

function timeDisplayTypeOf(): string {
  try {
    const type = app.project.timeDisplayType;
    if (type === TimeDisplayType.FRAMES) return "FRAMES";
    if (type === TimeDisplayType.TIMECODE) return "TIMECODE";
    return String(type);
  } catch (_e) {
    return "";
  }
}

function buildInstalledEffects(): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    const effects = app.effects;
    if (!effects) return map;
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex++) {
      const effect = effects[effectIndex];
      if (effect && effect.matchName) {
        map[String(effect.matchName)] = effect.displayName ? String(effect.displayName) : "";
      }
    }
  } catch (_e) {}
  return map;
}

export function main(): string {
  if (!app.project) {
    throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
  }

  const installed = buildInstalledEffects();
  const effectAgg: Record<string, Record<string, unknown>> = {};
  let numComps = 0;
  let numFootage = 0;
  let numFolders = 0;
  let numLayers = 0;
  const missingFootage: Record<string, unknown>[] = [];
  const rootId = app.project.rootFolder.id;
  const items = app.project.items;

  for (let itemIndex = 1; itemIndex <= items.length; itemIndex++) {
    const item = items[itemIndex];
    if (item instanceof FolderItem) {
      if (item.id !== rootId) numFolders++;
    } else if (item instanceof FootageItem) {
      numFootage++;
      if (item.footageMissing) {
        let missingPath: string | null = null;
        try {
          const main = item.mainSource;
          if (main && (main as any).missingFootagePath) {
            missingPath = String((main as any).missingFootagePath);
          }
        } catch (_e) {}
        missingFootage.push({
          id: item.id,
          name: item.name,
          missingFootagePath: missingPath,
        });
      }
    } else if (item instanceof CompItem) {
      numComps++;
      numLayers += item.numLayers;
      for (let layerIndex = 1; layerIndex <= item.numLayers; layerIndex++) {
        const layer = item.layer(layerIndex);
        try {
          const parade = layer.property("ADBE Effect Parade") as any;
          if (!parade || parade.numProperties < 1) continue;
          for (let effectIndex = 1; effectIndex <= parade.numProperties; effectIndex++) {
            const effect = parade.property(effectIndex);
            let matchName = "";
            let displayName = "";
            try {
              matchName = String(effect.matchName);
            } catch (_e) {
              continue;
            }
            try {
              displayName = String(effect.name);
            } catch (_e) {}
            if (!effectAgg[matchName]) {
              const isInstalled = Object.prototype.hasOwnProperty.call(installed, matchName);
              const catalogName = isInstalled ? installed[matchName] : "";
              effectAgg[matchName] = {
                matchName: matchName,
                displayName: catalogName || displayName || matchName,
                instanceCount: 0,
                available: isInstalled,
              };
            }
            effectAgg[matchName].instanceCount = Number(effectAgg[matchName].instanceCount) + 1;
          }
        } catch (_e) {}
      }
    }
  }

  const effects: Record<string, unknown>[] = [];
  for (const key in effectAgg) {
    if (Object.prototype.hasOwnProperty.call(effectAgg, key)) {
      effects.push(effectAgg[key]);
    }
  }
  effects.sort((left, right) => {
    const leftMatchName = String(left.matchName);
    const rightMatchName = String(right.matchName);
    if (leftMatchName < rightMatchName) return -1;
    if (leftMatchName > rightMatchName) return 1;
    return 0;
  });

  let fontsApiAvailable = false;
  let missingOrSubstitutedFonts: string[] = [];
  try {
    if (app.fonts && app.fonts.missingOrSubstitutedFonts) {
      fontsApiAvailable = true;
      const fonts = app.fonts.missingOrSubstitutedFonts;
      for (let fontIndex = 0; fontIndex < fonts.length; fontIndex++) {
        const font = fonts[fontIndex] as {
          postScriptName?: string;
          fullName?: string;
          familyName?: string;
        };
        let label = "";
        try {
          if (font.postScriptName) label = String(font.postScriptName);
          else if (font.fullName) label = String(font.fullName);
          else if (font.familyName) label = String(font.familyName);
          else label = String(font);
        } catch (_e) {
          label = String(font);
        }
        if (label) missingOrSubstitutedFonts.push(label);
      }
    }
  } catch (_e) {
    fontsApiAvailable = false;
    missingOrSubstitutedFonts = [];
  }

  let bitsPerChannel = 8;
  try {
    bitsPerChannel = app.project.bitsPerChannel;
  } catch (_e) {}

  return JSON.stringify({
    projectName: projectNameOf(),
    projectPath: projectPathOf(),
    aeVersion: String(app.version),
    numComps: numComps,
    numFootage: numFootage,
    numFolders: numFolders,
    numLayers: numLayers,
    bitsPerChannel: bitsPerChannel,
    timeDisplayType: timeDisplayTypeOf(),
    effects: effects,
    missingFootageCount: missingFootage.length,
    missingFootage: missingFootage,
    fontsApiAvailable: fontsApiAvailable,
    missingOrSubstitutedFonts: missingOrSubstitutedFonts,
  });
}
