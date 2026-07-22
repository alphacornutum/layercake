/**
 * Shared ExtendScript helpers for TextDocument → style projection and style writes.
 * Used by patch apply and layer inspect so field vocabulary cannot drift.
 */
export const SHARED_TEXT_DOCUMENT_HELPERS = `
var TEXT_STYLE_CHAR_KEYS = {
  font: true,
  fontSize: true,
  fillColor: true,
  applyFill: true,
  strokeColor: true,
  applyStroke: true,
  strokeWidth: true,
  tracking: true,
  baselineShift: true,
  fauxBold: true,
  fauxItalic: true,
  allCaps: true,
  smallCaps: true,
  horizontalScale: true,
  verticalScale: true,
  leading: true
};

var TEXT_STYLE_DOC_KEYS = {
  autoLeading: true,
  justification: true,
  text: true,
  boxTextSize: true,
  boxTextPos: true
};

// Document-level write order (paragraph / content / box). leading is special-cased.
var TEXT_STYLE_DOC_ORDER = ["text", "autoLeading", "justification", "boxTextSize", "boxTextPos"];

function colorToRgbArray(c) {
  if (!c || c.length === undefined) return null;
  return [c[0], c[1], c[2]];
}

function vec2ToArray(v) {
  if (!v || v.length === undefined) return null;
  return [v[0], v[1]];
}

function justificationToString(j) {
  try {
    if (j === ParagraphJustification.LEFT_JUSTIFY) return "LEFT_JUSTIFY";
    if (j === ParagraphJustification.RIGHT_JUSTIFY) return "RIGHT_JUSTIFY";
    if (j === ParagraphJustification.CENTER_JUSTIFY) return "CENTER_JUSTIFY";
    if (j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT) return "FULL_JUSTIFY_LASTLINE_LEFT";
    if (j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) return "FULL_JUSTIFY_LASTLINE_RIGHT";
    if (j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) return "FULL_JUSTIFY_LASTLINE_CENTER";
    if (j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL) return "FULL_JUSTIFY_LASTLINE_FULL";
    if (j === ParagraphJustification.MULTIPLE_JUSTIFICATIONS) return "MULTIPLE_JUSTIFICATIONS";
  } catch (e) {}
  return undefined;
}

function justificationFromString(s) {
  if (s === "LEFT_JUSTIFY") return ParagraphJustification.LEFT_JUSTIFY;
  if (s === "RIGHT_JUSTIFY") return ParagraphJustification.RIGHT_JUSTIFY;
  if (s === "CENTER_JUSTIFY") return ParagraphJustification.CENTER_JUSTIFY;
  if (s === "FULL_JUSTIFY_LASTLINE_LEFT") return ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT;
  if (s === "FULL_JUSTIFY_LASTLINE_RIGHT") return ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT;
  if (s === "FULL_JUSTIFY_LASTLINE_CENTER") return ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER;
  if (s === "FULL_JUSTIFY_LASTLINE_FULL") return ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL;
  return null;
}

/**
 * Public caps shape is boolean allCaps/smallCaps. AE 24+ writes via fontCapsOption;
 * FONT_ALL_SMALL_CAPS does not set both raw booleans true — LayerCake projects it as (true,true).
 */
function capsBooleansFromDoc(doc) {
  try {
    if (typeof FontCapsOption !== "undefined" && doc.fontCapsOption !== undefined) {
      var opt = doc.fontCapsOption;
      if (opt === FontCapsOption.FONT_ALL_SMALL_CAPS) return { allCaps: true, smallCaps: true };
      if (opt === FontCapsOption.FONT_ALL_CAPS) return { allCaps: true, smallCaps: false };
      if (opt === FontCapsOption.FONT_SMALL_CAPS) return { allCaps: false, smallCaps: true };
      if (opt === FontCapsOption.FONT_NORMAL_CAPS) return { allCaps: false, smallCaps: false };
    }
  } catch (eOpt) {}
  var allCaps = false;
  var smallCaps = false;
  try { allCaps = !!doc.allCaps; } catch (eA) {}
  try { smallCaps = !!doc.smallCaps; } catch (eS) {}
  return { allCaps: allCaps, smallCaps: smallCaps };
}

function readScalarAttr(target, key) {
  try {
    if (key === "allCaps" || key === "smallCaps") {
      return capsBooleansFromDoc(target)[key];
    }
    var v = target[key];
    if (v === undefined) return undefined;
    if (key === "fillColor" || key === "strokeColor") return colorToRgbArray(v);
    if (key === "boxTextSize" || key === "boxTextPos") return vec2ToArray(v);
    if (key === "justification") return justificationToString(v);
    if (key === "font" || key === "text") return String(v);
    if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
    return undefined;
  } catch (e) {
    return undefined;
  }
}

function collectStyleKeys(out) {
  var k;
  for (k in TEXT_STYLE_CHAR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(TEXT_STYLE_CHAR_KEYS, k)) out.push(k);
  }
  for (k in TEXT_STYLE_DOC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(TEXT_STYLE_DOC_KEYS, k)) out.push(k);
  }
}

/** Flatten projectTextDocument into a patch evidence style snapshot. */
function styleSnapshotFromProjection(proj) {
  if (!proj || !proj.style) return null;
  var snap = proj.style;
  if (proj.boxText !== undefined) snap.boxText = proj.boxText;
  if (proj.pointText !== undefined) snap.pointText = proj.pointText;
  return snap;
}

/** Project TextDocument into { kind, style, boxText?, pointText? }. Omits unreadable keys. */
function projectTextDocument(doc) {
  if (!doc) return null;
  var style = {};
  var keys = [];
  collectStyleKeys(keys);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === "boxTextSize" || k === "boxTextPos") {
      try {
        if (!doc.boxText) continue;
      } catch (eBox) {
        continue;
      }
    }
    var val = readScalarAttr(doc, k);
    if (val !== undefined) style[k] = val;
  }
  var out = { kind: "textDocument", style: style };
  try { out.boxText = !!doc.boxText; } catch (e1) {}
  try { out.pointText = !!doc.pointText; } catch (e2) {}
  return out;
}

function colorsEqual(a, b, eps) {
  if (!a || !b || a.length !== 3 || b.length !== 3) return false;
  var e = eps !== undefined ? eps : 1e-4;
  return Math.abs(a[0] - b[0]) <= e && Math.abs(a[1] - b[1]) <= e && Math.abs(a[2] - b[2]) <= e;
}

function vec2Equal(a, b, eps) {
  if (!a || !b || a.length !== 2 || b.length !== 2) return false;
  var e = eps !== undefined ? eps : 1e-4;
  return Math.abs(a[0] - b[0]) <= e && Math.abs(a[1] - b[1]) <= e;
}

function styleValuesEqual(key, desired, actual) {
  if (actual === undefined) return false;
  if (key === "fillColor" || key === "strokeColor") return colorsEqual(desired, actual);
  if (key === "boxTextSize" || key === "boxTextPos") return vec2Equal(desired, actual);
  if (typeof desired === "number" && typeof actual === "number") {
    return Math.abs(desired - actual) <= 1e-4;
  }
  return desired === actual;
}

function suppliedStyleMatches(styleSnap, supplied) {
  if (!styleSnap || !supplied) return false;
  for (var key in supplied) {
    if (!Object.prototype.hasOwnProperty.call(supplied, key)) continue;
    if (supplied[key] === undefined) continue;
    if (!styleValuesEqual(key, supplied[key], styleSnap[key])) return false;
  }
  return true;
}

/**
 * Apply supplied style keys onto doc. Returns null on success, or an error string.
 * Does not call setValue — caller writes the document back to the property.
 */
function applyStyleToDoc(doc, style, allStyleRuns) {
  if (!doc || !style) return "Missing TextDocument or style";
  if (style.leading !== undefined && style.autoLeading === true) {
    return "Cannot set leading with autoLeading: true (fixed leading requires autoLeading false)";
  }
  var needBox = style.boxTextSize !== undefined || style.boxTextPos !== undefined;
  if (needBox) {
    try {
      if (!doc.boxText) return "boxTextSize/boxTextPos require a box text layer";
    } catch (e) {
      return "Could not read boxText for box geometry write";
    }
  }
  if (style.justification !== undefined) {
    if (style.justification === "MULTIPLE_JUSTIFICATIONS") {
      return "Cannot set justification to MULTIPLE_JUSTIFICATIONS";
    }
    if (justificationFromString(style.justification) === null) {
      return "Unknown justification: " + String(style.justification);
    }
  }

  // Sample caps before DOC_ORDER — assigning text can reset fontCapsOption on AE.
  var preservedCaps = null;
  if (style.allCaps !== undefined || style.smallCaps !== undefined) {
    preservedCaps = capsBooleansFromDoc(doc);
  }

  var di;
  for (di = 0; di < TEXT_STYLE_DOC_ORDER.length; di++) {
    var dk = TEXT_STYLE_DOC_ORDER[di];
    if (style[dk] === undefined) continue;
    try {
      if (dk === "justification") {
        doc.justification = justificationFromString(style.justification);
      } else if (dk === "boxTextSize") {
        doc.boxTextSize = style.boxTextSize;
      } else if (dk === "boxTextPos") {
        doc.boxTextPos = style.boxTextPos;
      } else {
        doc[dk] = style[dk];
      }
    } catch (ew) {
      return "Failed to set " + dk + ": " + String(ew);
    }
  }

  // Cache one full-range CharacterRange for allStyleRuns char writes.
  var cachedCharRange = null;
  var charRangeResolved = false;
  function charWriteTarget(key) {
    if (!allStyleRuns || !TEXT_STYLE_CHAR_KEYS[key]) return doc;
    if (charRangeResolved) return cachedCharRange || doc;
    charRangeResolved = true;
    try {
      if (typeof doc.characterRange === "function" && doc.text && doc.text.length > 0) {
        cachedCharRange = doc.characterRange(0, doc.text.length);
      }
    } catch (e) {}
    return cachedCharRange || doc;
  }

  // Fixed leading: AE docs claim setting leading also sets autoLeading to true, and
  // leading then reads as 0. Re-assert autoLeading false after the leading write.
  if (style.leading !== undefined) {
    try {
      doc.autoLeading = false;
      var leadTarget = charWriteTarget("leading");
      leadTarget.leading = style.leading;
      doc.autoLeading = false;
      leadTarget.leading = style.leading;
    } catch (el) {
      return "Failed to set leading: " + String(el);
    }
  }

  // Caps: read-only booleans since AE 24 — merge omit=preserve from preservedCaps, write enum.
  if (preservedCaps) {
    try {
      if (typeof FontCapsOption === "undefined") {
        return "fontCapsOption requires After Effects 24+ (LayerCake supports AE 26+)";
      }
      var nextAll = style.allCaps !== undefined ? !!style.allCaps : preservedCaps.allCaps;
      var nextSmall = style.smallCaps !== undefined ? !!style.smallCaps : preservedCaps.smallCaps;
      var capsOpt;
      if (nextAll && nextSmall) capsOpt = FontCapsOption.FONT_ALL_SMALL_CAPS;
      else if (nextAll) capsOpt = FontCapsOption.FONT_ALL_CAPS;
      else if (nextSmall) capsOpt = FontCapsOption.FONT_SMALL_CAPS;
      else capsOpt = FontCapsOption.FONT_NORMAL_CAPS;
      charWriteTarget("allCaps").fontCapsOption = capsOpt;
    } catch (ecaps) {
      return "Failed to set font caps: " + String(ecaps);
    }
  }

  for (var ck in TEXT_STYLE_CHAR_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(TEXT_STYLE_CHAR_KEYS, ck)) continue;
    if (ck === "leading" || ck === "allCaps" || ck === "smallCaps") continue;
    if (style[ck] === undefined) continue;
    try {
      var target = charWriteTarget(ck);
      target[ck] = style[ck];
    } catch (ec) {
      return "Failed to set " + ck + ": " + String(ec);
    }
  }
  return null;
}
`.trim();
