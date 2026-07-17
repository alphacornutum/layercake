import type { AeConfig } from "../config.js";
import { ConfigError } from "../config.js";
import type { AeHost, EvalResult, HostStatus, OpenProjectResult } from "./types.js";

const UNSUPPORTED_MESSAGE = "After Effects host bridge is only implemented on macOS and Windows.";

/** Stub host for platforms without an AE bridge (e.g. Linux). */
export class UnavailableAeHost implements AeHost {
  constructor(
    private readonly config: AeConfig,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  async status(): Promise<HostStatus> {
    return {
      platform: this.platform,
      available: false,
      appName: this.config.appName,
      executable: this.config.executable,
      message: UNSUPPORTED_MESSAGE,
    };
  }

  async ensureSession(): Promise<void> {
    throw new ConfigError(UNSUPPORTED_MESSAGE);
  }

  async openProject(_absolutePath: string): Promise<OpenProjectResult> {
    throw new ConfigError(UNSUPPORTED_MESSAGE);
  }

  async evalScript(_source: string, _timeoutMs: number): Promise<EvalResult> {
    throw new ConfigError(UNSUPPORTED_MESSAGE);
  }
}
