import { gzipSync } from 'node:zlib';
import { McpServer, fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { describe, overview, translatorFor, unknownSemgraph } from '../core/catalog.ts';
import { EMPTY_IS_NOT_ZERO, SERVICE_SUMMARY, WAREHOUSE_STEP } from '../core/guide.ts';
import { logOutcome, type Log } from '../core/log.ts';
import { runPipeline, type PipelineResult, type Report } from '../core/pipeline.ts';
import type { Registry } from '../core/registry.ts';
import { CHART_APP_URI, claudeUiDomain } from './chart-app.ts';

/** Keys in the _meta of a render result: for the app only, not for the model (REQ-092). */
export const SVG_META = 'semgraph/svg';
export const REPORT_META = 'semgraph/report';

export interface McpServerOptions {
  registry: Registry;
  now: () => Date;
  log: Log;
  /** The page of the app (chartAppHtml), built once at start-up. */
  appHtml: string;
  /** The URL of /mcp as users enter it in Claude; Claude serves the app from an origin derived from it. */
  serverUrl?: string;
  /** stdio only: keep the SVG as a file, since Claude Code shows no app. Returns where it went. */
  saveSvg?: (request: Record<string, unknown>, svg: string) => Promise<string>;
}

/**
 * REQ-090: the MCP server, one per request (stateless) on HTTP, or one per process on stdio. Every tool calls
 * the same core as the REST API: the overview, the description of a semgraph, and the pipeline.
 */
export function createMcpServer(options: McpServerOptions): McpServer {
  const { registry, now, log } = options;
  const ids = [...registry.semgraphs.keys()].join(', ');
  const server = new McpServer({ name: 'semgraph', title: 'semgraph', version: registry.version }, { instructions: instructions(registry) });
  const readOnly = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

  const locale = { type: 'string', description: 'Language of the titles and messages, e.g. nl-BE or en; unknown locales fall back to English.' };
  const request = {
    type: 'object',
    description: `The request of one semgraph, chosen by its semgraph field; its contract is the schema that describe_semgraph returns. Available: ${ids}.`,
    required: ['semgraph'],
    properties: { semgraph: { type: 'string', description: `One of: ${ids}.` } },
    additionalProperties: true,
  };
  const requestSchema = fromJsonSchema<{ request: Record<string, unknown> }>({
    type: 'object',
    additionalProperties: false,
    required: ['request'],
    properties: { request },
  });

  server.registerTool(
    'list_semgraphs',
    {
      title: 'List the semgraphs',
      description: 'Every semgraph on offer, with the question it answers and its examples, and the ones that are planned. Start here to choose a chart by meaning.',
      inputSchema: fromJsonSchema<{ locale?: string }>({ type: 'object', additionalProperties: false, properties: { locale } }),
      annotations: readOnly,
    },
    async (args: { locale?: string }) => json(overview(registry, translatorFor(registry, args.locale))),
  );

  server.registerTool(
    'describe_semgraph',
    {
      title: 'Describe a semgraph',
      description: 'One semgraph: the question it answers, example questions, when not to use it (and what to use instead), its attributes, its contract (JSON Schema) and a full example request to start from.',
      inputSchema: fromJsonSchema<{ id: string; locale?: string }>({
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: { id: { type: 'string', description: `The semgraph, one of: ${ids}.` }, locale },
      }),
      annotations: readOnly,
    },
    async (args: { id: string; locale?: string }) => {
      const t = translatorFor(registry, args.locale);
      const loaded = registry.semgraphs.get(args.id);
      if (!loaded) return { ...json({ outcome: 'invalid', locale: t.locale, issues: [unknownSemgraph(registry, args.id, t)] }), isError: true };
      const [first] = loaded.examples.values();
      return json({ ...describe(loaded, t), exampleRequest: first });
    },
  );

  server.registerTool(
    'validate_semgraph',
    {
      title: 'Check a chart request',
      description: 'Checks a request against its contract and the chart language without drawing it. The report has the outcome (ok, deviation, refused or invalid) and every issue with what to do instead.',
      inputSchema: requestSchema,
      annotations: readOnly,
    },
    async (args: { request: Record<string, unknown> }) => {
      const result = await runPipeline(registry, args.request, { now: now(), draw: false });
      logOutcome(log, 'mcp.validate', result);
      return json(reportOf(registry, result));
    },
  );

  registerAppTool(
    server,
    'render_semgraph',
    {
      title: 'Draw a chart',
      description:
        'Draws the chart and shows it to the user in the conversation, exactly as the service drew it. You receive the report, not the picture: do not draw the chart again yourself. A refused or invalid request is not drawn; its report says what is wrong and what to do instead.',
      inputSchema: requestSchema,
      annotations: readOnly,
      _meta: { ui: { resourceUri: CHART_APP_URI } },
    },
    async (args: { request: Record<string, unknown> }): Promise<CallToolResult> => {
      const result = await runPipeline(registry, args.request, { now: now() });
      logOutcome(log, 'mcp.render', result);
      const report = reportOf(registry, result);
      if (result.svg === undefined) {
        const why =
          report.outcome === 'refused'
            ? 'The chart was not drawn: it would mislead. Every issue says what to do instead.'
            : 'The request is not valid: fix it and call render_semgraph again.';
        return { content: [text(`${why}\n${JSON.stringify(report)}`)], _meta: { [REPORT_META]: report }, isError: report.outcome === 'invalid' };
      }
      const where = options.saveSvg
        ? `The chart is saved as ${await options.saveSvg(args.request, result.svg)}.`
        : 'The chart is shown to the user in the conversation; you do not see it. Do not draw it again.';
      return {
        content: [text(`${where}\n${JSON.stringify(report)}`)],
        // REQ-092: the SVG reaches the app, not the model; gzipped, since the largest charts are 150 KB.
        _meta: { [SVG_META]: gzipSync(result.svg).toString('base64'), [REPORT_META]: report },
      };
    },
  );

  const ui = {
    prefersBorder: false,
    ...(options.serverUrl ? { domain: claudeUiDomain(options.serverUrl) } : {}),
  };
  registerAppResource(
    server,
    'chart',
    CHART_APP_URI,
    { title: 'Chart', description: 'Shows a chart of render_semgraph in the conversation.', _meta: { ui } },
    async () => ({ contents: [{ uri: CHART_APP_URI, mimeType: RESOURCE_MIME_TYPE, text: options.appHtml, _meta: { ui } }] }),
  );

  return server;
}

/** The report as the REST API gives it, with the deviations and versions that /render puts in its headers. */
function reportOf(registry: Registry, result: PipelineResult): Report & { deviations: string[]; languageVersion: string; tokensVersion: string } {
  return { ...result.report, deviations: result.deviations, languageVersion: registry.tokens.languageVersion, tokensVersion: registry.tokens.version };
}

function instructions(registry: Registry): string {
  return [
    SERVICE_SUMMARY,
    '',
    '**How to make a chart**',
    '',
    '1. Choose a semgraph by meaning, never by form: list_semgraphs gives every semgraph with the question it answers; describe_semgraph adds when not to use it, its attributes, its contract and a full example request.',
    `2. ${WAREHOUSE_STEP}`,
    '3. render_semgraph draws the chart and shows it to the user in the conversation. You receive the report, not the picture: do not draw the chart again, and do not describe what you cannot see. When the chart is refused or invalid, the report says what is wrong and what to do instead; follow it. validate_semgraph checks a request without drawing.',
    '4. Fill `meta` (REQ-093), so the chart carries its context when it is shared: `question` with the question of the user, `query` with the query that fetched the data, as it ran, `askedBy` with the name of the user when you know it, and `compiledOn` with the day of today (YYYY-MM-DD). Leave out what you do not know.',
    '5. Leave `size` out, unless the chart is meant for a slide (`large`) or a small card (`card`).',
    '',
    EMPTY_IS_NOT_ZERO,
    '',
    `Chart language ${registry.tokens.languageVersion}, tokens ${registry.tokens.version}.`,
  ].join('\n');
}

const text = (value: string) => ({ type: 'text' as const, text: value });
const json = (value: unknown): CallToolResult => ({ content: [text(JSON.stringify(value))] });
