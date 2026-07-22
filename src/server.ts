import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AeConfig } from "./config.js";
import { ConfigError } from "./config.js";
import { DOCS_ATTRIBUTION, DOCS_URI_PREFIX } from "./docs/attribution.js";
import type { DocsCorpus } from "./docs/corpus.js";
import { resolveDocsCorpusPath } from "./docs/paths.js";
import { DocsError } from "./docs/corpus.js";
import { getDoc, searchDocs } from "./docs/search.js";
import { closeProject, openProjectGuarded, SessionError } from "./host/session.js";
import type { AeHost } from "./host/types.js";
import { validateScriptSource } from "./host/script-wrapper.js";
import { getItemRefs } from "./inventory/get-item-refs.js";
import { getLayer } from "./inventory/get-layer.js";
import { getSource } from "./inventory/get-source.js";
import { InspectSizeError } from "./inventory/inspect-limit.js";
import { COMP_SWITCH_KEYS } from "./inventory/comp-switches.js";
import { getLayerInputSchema } from "./inventory/layer-target-schema.js";
import { listComps } from "./inventory/list-comps.js";
import { listFolders } from "./inventory/list-folders.js";
import { listProjectContext } from "./inventory/list-project-context.js";
import { listProjectSummary } from "./inventory/list-project-summary.js";
import { listSources } from "./inventory/list-sources.js";
import { applyProjectPatch } from "./patch/apply.js";
import { patchProjectInputSchema } from "./patch/schema.js";
import { saveProject } from "./patch/save.js";
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
        "Open a local .aep (or .aet) project in the configured After Effects app. Path must be absolute (not relative). " +
        "If another project is already open at a different path, this refuses (dirty or clean) — call ae_close_project first. " +
        "Same path already open is a no-op success. Warning: this affects the live AE GUI session.",
      inputSchema: z.object({
        path: z.string().describe("Absolute filesystem path to a .aep / .aet project file"),
      }),
    },
    async ({ path }) => {
      try {
        const result = await openProjectGuarded(host, path, config.scriptTimeoutMs);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        if (err instanceof SessionError && err.context) {
          return textResult(
            JSON.stringify(
              {
                error: err.message,
                code: err.code,
                context: err.context,
              },
              null,
              2,
            ),
            true,
          );
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_close_project",
    {
      title: "Close After Effects project",
      description:
        "Close the open project with an explicit non-interactive policy: " +
        '"discard" (DO_NOT_SAVE_CHANGES) or "save" (SAVE_CHANGES). ' +
        "Never prompts. Optional expectedFingerprint refuses close when the live project changed. " +
        "Call this before ae_open_project when another project is already open.",
      inputSchema: z.object({
        policy: z
          .enum(["discard", "save"])
          .describe('Close policy: "discard" unsaved changes, or "save" then close'),
        expectedFingerprint: z
          .string()
          .optional()
          .describe("Optional fingerprint from ae_project_context; refuses if stale"),
      }),
    },
    async ({ policy, expectedFingerprint }) => {
      try {
        const result = await closeProject(host, {
          policy,
          expectedFingerprint,
          timeoutMs: config.scriptTimeoutMs,
        });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        if (err instanceof SessionError && err.context) {
          return textResult(
            JSON.stringify(
              {
                error: err.message,
                code: err.code,
                context: err.context,
              },
              null,
              2,
            ),
            true,
          );
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_patch_project",
    {
      title: "Apply typed project patch",
      description:
        "Apply-only typed mutations against the open project (no preview/plan tokens, no implicit save). " +
        "Requires project.path + project.fingerprint guards from ae_project_context. " +
        "Ops: set_text_style (partial TextDocument style bag — font, size, leading/autoLeading, fill/stroke, " +
        "justification, text, box geometry, …; omit key = preserve; authored + evaluatedStyle evidence); " +
        "rename_layer; rename_project_item; set_layer_index; create_solid (always-create; optional name); " +
        "create_text (target.compId|compName + layout point|box + text; box requires boxTextSize; " +
        "optional name/style; no in-place point↔box convert — recreate + delete_layer); " +
        "replace_layer_source; set_layer_timing (integer frames only); set_layer_switches " +
        "(partial switches bag; full switch snapshot evidence; timeRemapEnabled lives here); " +
        "set_comp_settings (target.compId|compName + partial settings bag; integer-frame evidence; " +
        "place before set_layer_timing in mixed batches); " +
        "set_property_expression (exactly one of matchNames|propertyPath; prefer matchNames from ae_get_layer); " +
        "set_layer_transform (partial transform bag; authored value evidence; fingerprint guards for stale apply); " +
        "reset_layer_surface (resetTransforms verifies AE defaults with value evidence; clearExpressions separate); " +
        "delete_layer; create_folder / move_project_item / delete_project_item " +
        "(permissive AE remove; create_folder name optional); safe_delete_project_item (refuse in-use / unknownRefsPossible; empty folders only). " +
        "Layer targets accept id or unique name like ae_get_layer — ambiguous names refuse with candidates. " +
        "Comp-only ops (set_comp_settings, create_text) use target.compId|compName the same way. " +
        "Create ops may omit name (host/AE default; see ADR 0006); evidence returns the final name. " +
        "Panel item ops use Item.id (real rootFolder.id from ae_list_folders, never a magic 0). " +
        "Successful targets include post-condition-verified before/after evidence. " +
        "Prefer typed ops over ae_eval_script for these control-plane flows. " +
        "Call ae_save_project create_backup before risky broad patches; persist with save_copy after.",
      inputSchema: patchProjectInputSchema,
    },
    async (input) => {
      try {
        const result = await applyProjectPatch(host, input, config.scriptTimeoutMs);
        return textResult(JSON.stringify(result, null, 2), !result.ok);
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
        return textResult(errorText(err), true);
      }
    },
  );

  server.registerTool(
    "ae_save_project",
    {
      title: "Save project copy or backup",
      description:
        "Explicit persistence for the open project. Modes: save_copy (absolute destination; AE Save As, " +
        "active path switches) and create_backup (filesystem copy of the .aep only under AE_ARTIFACT_DIR " +
        "or caller path; session stays on the original path; requires a clean saved project). " +
        "create_backup does not collect linked footage/media — not Collect Files; opening the backup " +
        "elsewhere may miss relative file footage. " +
        "Requires expectedFingerprint. Refuses overwrite unless allowOverwrite. " +
        "Does not support in-place save_current. Patch/context/inventory never save implicitly.",
      inputSchema: z.object({
        mode: z.enum(["save_copy", "create_backup"]).describe("Persistence mode"),
        expectedFingerprint: z.string().describe("Fingerprint from ae_project_context"),
        path: z
          .string()
          .optional()
          .describe("Absolute destination (required for save_copy; optional backup override)"),
        allowOverwrite: z.boolean().optional().describe("Allow writing over an existing file"),
        projectPath: z
          .string()
          .optional()
          .describe("Optional absolute path guard matching the open project"),
      }),
    },
    async ({ mode, expectedFingerprint, path, allowOverwrite, projectPath }) => {
      try {
        const result = await saveProject(
          host,
          { mode, expectedFingerprint, path, allowOverwrite, projectPath },
          { artifactDir: config.artifactDir, timeoutMs: config.scriptTimeoutMs },
        );
        return textResult(JSON.stringify(result, null, 2), !result.ok);
      } catch (err) {
        if (err instanceof ConfigError) {
          return textResult(errorText(err), true);
        }
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
        "Prefer ae_list_* / ae_get_* first for inventory; use ae_patch_project for typed edits. " +
        "Look up comps/layers/items by stable id (not ephemeral index/name). Scripts can mutate the open project. " +
        "Prefer returning a value from the script body. Empty scripts are rejected. " +
        "JSON.stringify / JSON.parse are available (extendscript-json polyfill). " +
        "Bypasses patch fingerprint guards — use with care.",
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
        "Each composition includes settings for planning set_comp_settings: width/height/pixelAspect/frameRate, " +
        "integer durationFrames/displayStartFrame/workAreaStartFrame/workAreaDurationFrames, renderer, and " +
        "switches (" +
        COMP_SWITCH_KEYS.join("/") +
        "); " +
        "seconds duration is kept for compatibility. " +
        "Each layer includes a stable id (AE Layer.id, persists across reorder/rename/save; AE 24.6+) — prefer id over ephemeral index for follow-up scripts. " +
        "Layers with an AVLayer.source include a compact source object whose id is the source Item.id (join key to ae_list_sources / comps; distinct from Layer.id); " +
        'solids report source.footageKind "solid". ' +
        "Control-plane fields: startTime + integer startFrame/inFrame/outFrame/durationFrames (nearest frame via containing-comp frameRate; seconds inPoint/outPoint/duration kept), " +
        "enabled and applicable switches (video/audio, guide/adjustment/3D/collapse/frameBlending/timeRemap), optional parentLayerId and trackMatteType/trackMatteLayerId. " +
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
    "ae_project_context",
    {
      title: "Bind open project context",
      description:
        "Cheap read-only bind token for the open project: path, dirty, revision, fingerprint, AE version. " +
        "Prefer this for frequent fingerprint polling before/after patch or save. " +
        "Use ae_project_summary instead for heavier health/portability orientation (effects, missing footage/fonts). " +
        "Does not walk comps or audit dependencies.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const context = await listProjectContext(host, config.scriptTimeoutMs);
        return textResult(JSON.stringify(context, null, 2));
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
        "Prefer ae_project_context for cheap fingerprint binding; this tool is the heavier health/portability passport. " +
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
    "ae_get_item_refs",
    {
      title: "Inspect inbound item references",
      description:
        "Read-only inbound-reference facts for one project item (Item.id) — usedIn comps, layer sources, " +
        "proxy/parent/matte links discovered by scan, plus best-effort expression mentions. " +
        "Returns refs[] and unknownRefsPossible (true means the scan may be incomplete). " +
        "Facts for cleanup planning only — no deletionCandidate policy bit. " +
        "When unknownRefsPossible is true, agents and safe_delete_project_item MUST refuse deletion. " +
        "Template reachability policy (main/config) is out of scope. Prefer this before safe_delete_project_item.",
      inputSchema: z.object({
        itemId: z.number().int().describe("Stable Project panel Item.id to inspect"),
      }),
    },
    async ({ itemId }) => {
      try {
        const result = await getItemRefs(host, itemId, config.scriptTimeoutMs);
        return textResult(JSON.stringify(result, null, 2));
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
        "preExpression defaults to true (authored/keyframed values); pass false for post-expression on-screen values — the value field always follows that flag. " +
        "On extended/full, Transform and SourceText (TEXT_DOCUMENT) properties with keys or expressions also include authoredValue (pre-expression) and evaluatedValue (post-expression). " +
        "Wrapper purity / normalization MUST use authoredValue (or value with preExpression true), not evaluatedValue alone. " +
        'TEXT_DOCUMENT values are projected as { kind: "textDocument", style: {…}, boxText?, pointText? } (same style keys as set_text_style). ' +
        "Other unsupported value types are flagged { unserializable: true, propertyValueType }. " +
        "Success JSON larger than AE_INSPECT_MAX_BYTES (default 512 KiB) is a hard error — narrow with leaner detail / matchNames. " +
        "Layer.id ≠ Item.id; join layer.source.id to ae_list_sources / comps.",
      inputSchema: getLayerInputSchema,
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
          `Docs corpus unavailable at ${resolveDocsCorpusPath()}. Run npm run docs:fetch.`,
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
          `Docs corpus unavailable at ${resolveDocsCorpusPath()}. Run npm run docs:fetch.`,
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
