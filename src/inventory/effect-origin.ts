import type { EffectOrigin } from "./types.js";
import { FIRST_PARTY_EFFECT_MATCH_NAMES } from "./first-party-effect-match-names.js";

let cachedAllowlist: Set<string> | null = null;

export function getFirstPartyEffectAllowlist(): ReadonlySet<string> {
  if (!cachedAllowlist) {
    cachedAllowlist = new Set(FIRST_PARTY_EFFECT_MATCH_NAMES);
  }
  return cachedAllowlist;
}

/** Classify a used effect matchName using the ADBE prefix and vendored fallback allowlist. */
export function classifyEffectOrigin(matchName: string): EffectOrigin {
  return matchName.startsWith("ADBE") || getFirstPartyEffectAllowlist().has(matchName)
    ? "firstParty"
    : "thirdParty";
}

export type { EffectOrigin };
