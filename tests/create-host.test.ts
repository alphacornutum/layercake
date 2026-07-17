import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { createAeHost } from "../src/host/create-host.js";
import { MacOsAeHost } from "../src/host/macos.js";
import { UnavailableAeHost } from "../src/host/unavailable.js";
import { WinAeHost } from "../src/host/windows.js";

describe("createAeHost", () => {
  const config = loadConfig({}, "/repo");

  it("selects MacOsAeHost on darwin", () => {
    expect(createAeHost(config, "darwin")).toBeInstanceOf(MacOsAeHost);
  });

  it("selects WinAeHost on win32", () => {
    expect(createAeHost(config, "win32")).toBeInstanceOf(WinAeHost);
  });

  it("selects UnavailableAeHost on other platforms", () => {
    expect(createAeHost(config, "linux")).toBeInstanceOf(UnavailableAeHost);
  });

  it("reports unavailable status on unsupported platforms", async () => {
    const host = createAeHost(config, "linux");
    const status = await host.status();
    expect(status.available).toBe(false);
    expect(status.message).toMatch(/macOS and Windows/);
  });
});
