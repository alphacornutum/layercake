import { SHARED_INVENTORY_HELPERS } from "./shared-script.js";

/**
 * ExtendScript that builds a project passport for ae_project_summary.
 * Returns raw effect rows (matchName/displayName/instanceCount/available);
 * TypeScript applies first-party allowlist classification.
 */
const LIST_PROJECT_SUMMARY_BODY = `
if (!app.project) {
  throw new Error("No After Effects project is open. Open a project first (ae_open_project).");
}

function projectPathOf() {
  try {
    if (app.project.file) return app.project.file.fsName;
  } catch (e) {}
  return null;
}

function timeDisplayTypeOf() {
  try {
    var t = app.project.timeDisplayType;
    if (t === TimeDisplayType.FRAMES) return "FRAMES";
    if (t === TimeDisplayType.TIMECODE) return "TIMECODE";
    return String(t);
  } catch (e) {
    return "";
  }
}

function buildInstalledEffects() {
  var map = {};
  try {
    var effects = app.effects;
    if (!effects) return map;
    for (var i = 0; i < effects.length; i++) {
      var ef = effects[i];
      if (ef && ef.matchName) {
        map[String(ef.matchName)] = ef.displayName ? String(ef.displayName) : "";
      }
    }
  } catch (e) {}
  return map;
}

var installed = buildInstalledEffects();
var effectAgg = {};
var numComps = 0;
var numFootage = 0;
var numFolders = 0;
var numLayers = 0;
var missingFootage = [];
var rootId = app.project.rootFolder.id;
var items = app.project.items;

for (var i = 1; i <= items.length; i++) {
  var item = items[i];
  if (item instanceof FolderItem) {
    if (item.id !== rootId) numFolders++;
  } else if (item instanceof FootageItem) {
    numFootage++;
    if (item.footageMissing) {
      var missingPath = null;
      try {
        var main = item.mainSource;
        if (main && main.missingFootagePath) {
          missingPath = String(main.missingFootagePath);
        }
      } catch (e) {}
      missingFootage.push({
        id: item.id,
        name: item.name,
        missingFootagePath: missingPath
      });
    }
  } else if (item instanceof CompItem) {
    numComps++;
    numLayers += item.numLayers;
    for (var li = 1; li <= item.numLayers; li++) {
      var layer = item.layer(li);
      try {
        var parade = layer.property("ADBE Effect Parade");
        if (!parade || parade.numProperties < 1) continue;
        for (var ei = 1; ei <= parade.numProperties; ei++) {
          var fx = parade.property(ei);
          var mn = "";
          var dn = "";
          try {
            mn = String(fx.matchName);
          } catch (e) {
            continue;
          }
          try {
            dn = String(fx.name);
          } catch (e) {}
          if (!effectAgg[mn]) {
            var isInstalled = installed.hasOwnProperty(mn);
            var catalogName = isInstalled ? installed[mn] : "";
            effectAgg[mn] = {
              matchName: mn,
              displayName: catalogName || dn || mn,
              instanceCount: 0,
              available: isInstalled
            };
          }
          effectAgg[mn].instanceCount++;
        }
      } catch (e) {}
    }
  }
}

var effects = [];
for (var key in effectAgg) {
  if (effectAgg.hasOwnProperty(key)) {
    effects.push(effectAgg[key]);
  }
}
effects.sort(function (a, b) {
  if (a.matchName < b.matchName) return -1;
  if (a.matchName > b.matchName) return 1;
  return 0;
});

var fontsApiAvailable = false;
var missingOrSubstitutedFonts = [];
try {
  if (app.fonts && app.fonts.missingOrSubstitutedFonts) {
    fontsApiAvailable = true;
    var fonts = app.fonts.missingOrSubstitutedFonts;
    for (var fi = 0; fi < fonts.length; fi++) {
      var font = fonts[fi];
      var label = "";
      try {
        if (font.postScriptName) label = String(font.postScriptName);
        else if (font.fullName) label = String(font.fullName);
        else if (font.familyName) label = String(font.familyName);
        else label = String(font);
      } catch (e) {
        label = String(font);
      }
      if (label) missingOrSubstitutedFonts.push(label);
    }
  }
} catch (e) {
  fontsApiAvailable = false;
  missingOrSubstitutedFonts = [];
}

var bitsPerChannel = 8;
try {
  bitsPerChannel = app.project.bitsPerChannel;
} catch (e) {}

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
  missingOrSubstitutedFonts: missingOrSubstitutedFonts
});
`.trim();

export const LIST_PROJECT_SUMMARY_SCRIPT = `${SHARED_INVENTORY_HELPERS}\n\n${LIST_PROJECT_SUMMARY_BODY}`;
