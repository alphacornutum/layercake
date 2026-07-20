/** Closed set of round-trippable composition panel / Advanced-tab switches. */
export const COMP_SWITCH_KEYS = [
  "motionBlur",
  "frameBlending",
  "draft3d",
  "hideShyLayers",
  "dropFrame",
  "preserveNestedResolution",
] as const;

export type CompSwitchKey = (typeof COMP_SWITCH_KEYS)[number];

export type CompSwitchesSnapshot = { [K in CompSwitchKey]: boolean };

/** ExtendScript array literal body: `"motionBlur", "frameBlending", …`. */
export const COMP_SWITCH_KEYS_ES3 = COMP_SWITCH_KEYS.map((k) => `"${k}"`).join(", ");
