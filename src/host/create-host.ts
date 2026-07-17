import type { AeConfig } from "../config.js";
import { MacOsAeHost } from "./macos.js";
import type { AeHost } from "./types.js";
import { UnavailableAeHost } from "./unavailable.js";
import { WinAeHost } from "./windows.js";

/**
 * Select the platform host bridge: macOS AppleScript, Windows CLI, or unavailable stub.
 */
export function createAeHost(
  config: AeConfig,
  platform: NodeJS.Platform = process.platform,
): AeHost {
  switch (platform) {
    case "darwin":
      return new MacOsAeHost(config);
    case "win32":
      return new WinAeHost(config);
    default:
      return new UnavailableAeHost(config, platform);
  }
}
