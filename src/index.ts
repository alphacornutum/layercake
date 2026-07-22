#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { loadDocsCorpus } from "./docs/corpus.js";
import { resolveDocsCorpusPath } from "./docs/paths.js";
import { createAeHost } from "./host/create-host.js";
import { createServer } from "./server.js";
import { loadProductSkill } from "./skills/load.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const host = createAeHost(config);
  const docsPath = resolveDocsCorpusPath();

  let corpus = null;
  try {
    corpus = await loadDocsCorpus(docsPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[layercake] Docs corpus not loaded: ${message}`);
  }

  const productSkill = await loadProductSkill();
  if (!productSkill) {
    console.error(
      "[layercake] Product skill not loaded (skills/drive-after-effects missing or invalid)",
    );
  }

  const server = createServer(config, host, corpus, productSkill);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[layercake] MCP server running on stdio (docs=${corpus ? "ready" : "unavailable"}, skill=${productSkill ? "ready" : "unavailable"})`,
  );
}

main().catch((err) => {
  console.error("[layercake] Fatal:", err);
  process.exit(1);
});
