import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.ae.test.ts", "node_modules", "dist"],
    environment: "node",
  },
});
