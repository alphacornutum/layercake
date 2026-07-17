import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AeConfig } from "./config.js";
import { ConfigError } from "./config.js";
import { DOCS_ATTRIBUTION, DOCS_URI_PREFIX } from "./docs/attribution.js";
import type { DocsCorpus } from "./docs/corpus.js";
import { DocsError } from "./docs/corpus.js";
import { getDoc, searchDocs } from "./docs/search.js";
import type { AeHost } from "./host/types.js";
import { validateScriptSource } from "./host/script-wrapper.js";
import { getLayer } from "./inventory/get-layer.js";
import { getSource } from "./inventory/get-source.js";
import { InspectSizeError } from "./inventory/inspect-limit.js";
import { listComps } from "./inventory/list-comps.js";
import { listFolders } from "./inventory/list-folders.js";
import { listProjectSummary } from "./inventory/list-project-summary.js";
import { listSources } from "./inventory/list-sources.js";
import {
  PRODUCT_SKILL_ENTRY_URI,
  PRODUCT_SKILL_NAME,
  SKILL_INDEX_URI,
  type ProductSkill,
  buildSkillIndex,
  getSkillFile,
} from "./skills/load.js";

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

function errorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function createServer(
  config: AeConfig,
  host: AeHost,
  corpus: DocsCorpus | null,
  productSkill: ProductSkill | null = null,
): McpServer {
  const serverOptions = productSkill
    ? {
        instructions:
          `For After Effects workflow guidance (host check → inventory → docs → id-based eval), ` +
          `read the MCP resource ${PRODUCT_SKILL_ENTRY_URI}.`,
        // SEP-2640 Skills Extension — SDK ServerCapabilities.extensions supports this key.
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/skills": {},
          },
        },
      }
    : undefined;

  const server = new McpServer(
    {
      name: "layercake",
      version: "0.1.0",
    },
    serverOptions,
  );

  server.registerTool(
    "ae_host_status",
    {
      title: "After Effects host status",
      description:
        "Report resolved After Effects host configuration and whether a session can be used. Call this first when AE seems unavailable.",
      inputSchema: z.object({}),
    },
    async () => {
      const status = await host.status();
      return textResult(JSON.stringify(status, null, 2), !status.available);
    },
  );

  server.registerTool(
    "ae_open_project",
    {
      title: "Open After Effects project",
      description:
        "Open a local .aep (or .aet) project in the configured After Effects app. Path must be absolute (not relative). Warning: this affects the live AE GUI session.",
      inputSchema: z.object({
        path: z.string().describe("Absolute filesystem path to a .aep / .aet project file"),
      }),
    },
    async ({ path }) => {
      try {
        const result = await host.openProject(path);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_eval_script",
    {
      title: "Evaluate ExtendScript",
      description:
        "Evaluate ExtendScript in the active After Effects session and return the result. " +
        "Prefer ae_list_* / ae_get_* first for inventory; use this for one-off or mutating work. " +
        "Look up comps/layers/items by stable id (not ephemeral index/name). Scripts can mutate the open project. " +
        "Prefer returning a value from the script body. Empty scripts are rejected. " +
        "JSON.stringify / JSON.parse are available (extendscript-json polyfill).",
      inputSchema: z.object({
        script: z.string().describe("ExtendScript source to evaluate"),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional timeout in milliseconds (defaults to AE_SCRIPT_TIMEOUT_MS)"),
      }),
    },
    async ({ script, timeoutMs }) => {
      try {
        validateScriptSource(script);
      } catch (err) {
        return textResult(errorText(err), true);
      }
      const timeout = timeoutMs ?? config.scriptTimeoutMs;
      try {
        const result = await host.evalScript(script, timeout);
        if (!result.ok) {
          const line = result.line !== undefined ? ` (line ${result.line})` : "";
          return textResult(`${result.error}${line}`, true);
        }
        return textResult(result.result);
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_list_comps",
    {
      title: "List compositions and layers",
      description:
        "Read-only inventory of compositions and their layers as JSON — prefer this before ae_eval_script. " +
        "Omit filters to list all comps; optional compIds and/or compNames (union) narrow the result. " +
        "Each layer includes a stable id (AE Layer.id, persists across reorder/rename/save; AE 22+) — prefer id over ephemeral index for follow-up scripts. " +
        "Layers with an AVLayer.source include a compact source object whose id is the source Item.id (join key to ae_list_sources / comps; distinct from Layer.id). " +
        "label is the timeline UI label color index (0=None, 1–16). " +
        "Timeline fold/twirl state is not available via scripting and is not reported. " +
        "Unmatched filter entries appear under missing.",
      inputSchema: z.object({
        compIds: z
          .array(z.number().int())
          .optional()
          .describe("Optional composition Item.id values to include"),
        compNames: z
          .array(z.string())
          .optional()
          .describe("Optional exact composition names to include (case-sensitive)"),
      }),
    },
    async ({ compIds, compNames }) => {
      try {
        const inventory = await listComps(host, { compIds, compNames }, config.scriptTimeoutMs);
        return textResult(JSON.stringify(inventory, null, 2));
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_list_sources",
    {
      title: "List project footage sources",
      description:
        "Read-only inventory of every FootageItem in the open project as JSON — prefer this before ae_eval_script for footage. " +
        "Each source includes a stable Item.id (same namespace as composition ids; distinct from Layer.id), " +
        "footageKind (file/solid/placeholder), media metadata, folder placement, and usedInCompIds. " +
        "Compositions are not listed here — use ae_list_comps. Join layer.source.id from ae_list_comps to these ids.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const inventory = await listSources(host, config.scriptTimeoutMs);
        return textResult(JSON.stringify(inventory, null, 2));
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_list_folders",
    {
      title: "List project folder tree",
      description:
        "Read-only nested JSON tree of the Project panel folder hierarchy (app.project.rootFolder) — prefer this before ae_eval_script for folder layout. " +
        "Folder nodes include children; footage/comp leaves are compact summaries with Item.id. " +
        'Empty root name is normalized to "Root". Item.id is distinct from Layer.id.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const inventory = await listFolders(host, config.scriptTimeoutMs);
        return textResult(JSON.stringify(inventory, null, 2));
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_project_summary",
    {
      title: "Summarize open project",
      description:
        "Read-only project passport as JSON — call after open when you need orientation or health/portability context. " +
        "Returns identity (name, path, AE version), counts (comps/footage/folders/layers), cheap settings (bitsPerChannel, timeDisplayType), " +
        "effect dependencies unique by matchName with origin (firstParty|thirdParty via Scripting Guide allowlist), available (installed in app.effects), " +
        "hasThirdPartyEffects, missing footage rollup, and missing/substituted fonts (soft-fails if Fonts API unavailable). " +
        "Does not replace ae_list_comps / ae_list_sources for structure or media detail.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const summary = await listProjectSummary(host, config.scriptTimeoutMs);
        return textResult(JSON.stringify(summary, null, 2));
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_get_layer",
    {
      title: "Inspect one composition layer",
      description:
        "Read-only deep dump of one layer's property tree as JSON. " +
        "Provide exactly one of compId|compName and exactly one of layerId|layerName (case-sensitive exact names; ambiguous names fail with candidate id lists). " +
        'detail defaults to "overview": skeleton fields plus numKeys/hasExpression/expressionEnabled — no expression bodies, keyframe arrays, or sampled values. ' +
        'Use detail "extended" or "full" (and/or matchNames) to retrieve full expression text, sampled values at atTime (default composition CTI), and keyframe timelines. ' +
        "preExpression defaults to true (authored/keyframed values); pass false for post-expression on-screen values. " +
        "Unsupported value types are flagged { unserializable: true, propertyValueType }. " +
        "Success JSON larger than AE_INSPECT_MAX_BYTES (default 512 KiB) is a hard error — narrow with leaner detail / matchNames. " +
        "Layer.id ≠ Item.id; join layer.source.id to ae_list_sources / comps.",
      inputSchema: z
        .object({
          compId: z.number().int().optional().describe("Composition Item.id"),
          compName: z.string().optional().describe("Exact composition name (case-sensitive)"),
          layerId: z.number().int().optional().describe("Layer.id within the composition"),
          layerName: z.string().optional().describe("Exact layer name (case-sensitive)"),
          detail: z
            .enum(["overview", "extended", "full"])
            .optional()
            .describe('Depth tier (default "overview")'),
          matchNames: z
            .array(z.string())
            .optional()
            .describe("Optional PropertyBase.matchName filters (exact; includes descendants)"),
          atTime: z
            .number()
            .optional()
            .describe("Sample time in composition seconds (default: composition CTI)"),
          preExpression: z
            .boolean()
            .optional()
            .describe("valueAtTime preExpression flag (default true)"),
        })
        .refine((v) => (v.compId !== undefined) !== (v.compName !== undefined), {
          message: "Provide exactly one of compId or compName",
        })
        .refine((v) => (v.layerId !== undefined) !== (v.layerName !== undefined), {
          message: "Provide exactly one of layerId or layerName",
        }),
    },
    async (args) => {
      try {
        const result = await getLayer(host, args, config.scriptTimeoutMs, config.inspectMaxBytes);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        if (err instanceof ConfigError || err instanceof InspectSizeError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_get_source",
    {
      title: "Inspect one footage source",
      description:
        "Read-only deep dump of one FootageItem as JSON (does not change ae_list_sources). " +
        "Provide exactly one of sourceId|sourceName (case-sensitive exact names; ambiguous names fail with candidate id lists). " +
        'detail defaults to "overview": list-style media fields plus a compact interpret summary. ' +
        'Use detail "full" for complete mainSource (+ proxySource when present) Interpret Footage settings ' +
        "(alpha, fields, pulldown, frame rates, loop, file/solid/placeholder). " +
        "Success JSON larger than AE_INSPECT_MAX_BYTES (default 512 KiB) is a hard error — narrow with leaner detail. " +
        "Item.id namespace (same as comps); not Layer.id.",
      inputSchema: z
        .object({
          sourceId: z.number().int().optional().describe("FootageItem Item.id"),
          sourceName: z.string().optional().describe("Exact FootageItem name (case-sensitive)"),
          detail: z
            .enum(["overview", "full"])
            .optional()
            .describe('Depth tier (default "overview")'),
        })
        .refine((v) => (v.sourceId !== undefined) !== (v.sourceName !== undefined), {
          message: "Provide exactly one of sourceId or sourceName",
        }),
    },
    async (args) => {
      try {
        const result = await getSource(host, args, config.scriptTimeoutMs, config.inspectMaxBytes);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        if (err instanceof ConfigError || err instanceof InspectSizeError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_docs_search",
    {
      title: "Search After Effects scripting docs",
      description:
        "Search the local After Effects Scripting Guide corpus. Returns ranked hits with title, excerpt, and ae://docs/... URIs.",
      inputSchema: z.object({
        query: z.string().describe("Keyword or natural-language query"),
        limit: z.number().int().positive().max(50).optional().describe("Max hits (default 8)"),
      }),
    },
    async ({ query, limit }) => {
      if (!corpus) {
        return textResult(
          `Docs corpus unavailable at ${config.docsPath}. Run npm run docs:fetch or set AE_DOCS_PATH.`,
          true,
        );
      }
      const hits = searchDocs(corpus, query, limit ?? 8);
      return textResult(
        JSON.stringify(
          {
            query,
            hits,
            attribution: DOCS_ATTRIBUTION,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "ae_docs_get",
    {
      title: "Get After Effects scripting doc",
      description:
        "Retrieve a documentation section by ae://docs/... URI or relative path from search hits. Primary fetch path for agents.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("Documentation URI (ae://docs/...) or relative path id from search"),
      }),
    },
    async ({ id }) => {
      if (!corpus) {
        return textResult(
          `Docs corpus unavailable at ${config.docsPath}. Run npm run docs:fetch or set AE_DOCS_PATH.`,
          true,
        );
      }
      try {
        const doc = getDoc(corpus, id);
        return textResult(doc.text);
      } catch (err) {
        if (err instanceof DocsError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  if (corpus) {
    server.registerResource(
      "ae-docs-index",
      `${DOCS_URI_PREFIX}`,
      {
        title: "After Effects scripting docs index",
        description: "List of available documentation section URIs",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                attribution: DOCS_ATTRIBUTION,
                documents: corpus.documents.map((d) => ({
                  uri: d.uri,
                  id: d.id,
                  title: d.title,
                })),
              },
              null,
              2,
            ),
          },
        ],
      }),
    );

    server.registerResource(
      "ae-docs",
      new ResourceTemplate("ae://docs/{+path}", {
        list: async () => ({
          resources: corpus.documents.map((d) => ({
            uri: d.uri,
            name: d.title,
            description: d.excerpt,
            mimeType: "text/markdown",
          })),
        }),
      }),
      {
        title: "After Effects scripting documentation",
        description: "Markdown sections from docsforadobe/after-effects-scripting-guide",
        mimeType: "text/markdown",
      },
      async (uri) => {
        try {
          const doc = getDoc(corpus, uri.href);
          return {
            contents: [
              {
                uri: doc.uri,
                mimeType: "text/markdown",
                text: doc.text,
              },
            ],
          };
        } catch (err) {
          throw new Error(errorText(err));
        }
      },
    );
  }

  if (productSkill) {
    const skillIndex = buildSkillIndex(productSkill);

    server.registerResource(
      "skill-index",
      SKILL_INDEX_URI,
      {
        title: "MCP skills index",
        description: "SEP-2640 skill discovery index for LayerCake product skills",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(skillIndex, null, 2),
          },
        ],
      }),
    );

    server.registerResource(
      "product-skill",
      new ResourceTemplate(`skill://${PRODUCT_SKILL_NAME}/{+path}`, {
        list: async () => ({
          resources: productSkill.files.map((f) => ({
            uri: f.uri,
            name: f.relativePath === "SKILL.md" ? productSkill.name : f.relativePath,
            description: f.relativePath === "SKILL.md" ? productSkill.description : f.relativePath,
            mimeType: f.mimeType,
          })),
        }),
      }),
      {
        title: "drive-after-effects skill",
        description: productSkill.description,
        mimeType: "text/markdown",
      },
      async (uri) => {
        const file = getSkillFile(productSkill, uri.href);
        if (!file) {
          throw new Error(`Skill resource not found: ${uri.href}`);
        }
        return {
          contents: [
            {
              uri: file.uri,
              mimeType: file.mimeType,
              text: file.text,
            },
          ],
        };
      },
    );
  }

  return server;
}
