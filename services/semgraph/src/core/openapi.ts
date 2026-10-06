import { LOCALE } from '../charts/contract.ts';
import { EMPTY_IS_NOT_ZERO, SERVICE_SUMMARY, WAREHOUSE_STEP } from './guide.ts';
import type { Registry } from './registry.ts';

/** Where the document and its viewer live (REQ-084). */
export const OPENAPI_PATH = '/openapi.json';
export const DOCS_PATH = '/docs';

const ANALYSIS = 'https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106324';

/**
 * REQ-084: the API described in OpenAPI 3.1, for people (Swagger UI) and for programs and agents that call
 * the service. Nothing is written twice: the request of every semgraph is its own contract (schema.json,
 * JSON Schema 2020-12, which OpenAPI 3.1 takes as it is) and its examples are the files next to it.
 */
export function openApiDocument(registry: Registry): Record<string, unknown> {
  const semgraphs = [...registry.semgraphs.values()];
  const requestName = (id: string) => `${id}Request`;
  const exampleName = (id: string, name: string) => `${id}.${name}`;

  const requests = Object.fromEntries(
    semgraphs.map(({ id, schema }) => {
      // $schema and $id belong to a standalone schema; inside the document they would change how refs resolve.
      const { $schema: _schema, $id: _id, ...rest } = schema as Record<string, unknown>;
      return [requestName(id), rest];
    }),
  );
  const examples = Object.fromEntries(
    semgraphs.flatMap(({ id, examples }) =>
      [...examples].map(([name, value]) => {
        const title = (value as { title?: unknown }).title;
        return [exampleName(id, name), { summary: `${id}: ${typeof title === 'string' ? title : name}`, value }];
      }),
    ),
  );
  const exampleRefs = Object.fromEntries(Object.keys(examples).map((key) => [key, { $ref: `#/components/examples/${key}` }]));
  const ids = semgraphs.map(({ id }) => id);

  const json = (schema: string) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } });
  const report = (description: string) => ({ description, content: json('Report') });
  const svg = {
    description: 'The chart (outcome ok or deviation). A deviation is drawn with a red alert, and named in Semgraph-Deviations.',
    headers: {
      'Semgraph-Language-Version': { description: 'The version of the chart language the chart follows.', schema: { type: 'string' } },
      'Semgraph-Tokens-Version': { description: 'The version of the design tokens.', schema: { type: 'string' } },
      'Semgraph-Deviations': { description: 'The codes of the tolerated deviations, comma separated; absent when there are none.', schema: { type: 'string' } },
    },
    content: { 'image/svg+xml': { schema: { type: 'string' } } },
  };
  const locale = { name: 'locale', in: 'query', required: false, description: 'Language of the titles and messages; unknown locales fall back to English.', schema: LOCALE };
  const body = {
    required: true,
    description: 'The request of one semgraph, chosen by its `semgraph` field. Its contract is in the schema of that semgraph.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/RenderRequest' }, examples: exampleRefs } },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'semgraph',
      version: registry.version,
      summary: 'Charts by meaning, following the Immoscoop chart language.',
      description: [
        SERVICE_SUMMARY,
        '',
        '**How to use it**',
        '',
        '1. Choose a semgraph: `GET /semgraphs` lists every semgraph with the question it answers; `GET /semgraphs/{id}` adds when not to use it, its attributes, its contract and its examples.',
        `2. ${WAREHOUSE_STEP}`,
        '3. `POST /validate` checks a request and answers with a report, always with status 200. `POST /render` answers with the SVG (200), or with the report: 422 when the chart is refused, 400 when the request is not valid. Every issue says what is wrong and what to do instead.',
        '',
        EMPTY_IS_NOT_ZERO,
        '',
        `Chart language ${registry.tokens.languageVersion}, tokens ${registry.tokens.version}. Every example can be seen drawn on \`/gallery\`.`,
      ].join('\n'),
    },
    // Relative: the document describes the server it is served from.
    servers: [{ url: '/' }],
    // The service has no login of its own: access is up to the platform in front of it.
    security: [],
    externalDocs: { description: 'The analysis of the chart server', url: ANALYSIS },
    tags: [
      { name: 'charts', description: 'Check and draw a chart.' },
      { name: 'semgraphs', description: 'The semgraphs on offer, their contracts and their examples.' },
      { name: 'service', description: 'Health, pages and this document.' },
    ],
    paths: {
      '/render': {
        post: {
          tags: ['charts'],
          operationId: 'render',
          summary: 'Draw a chart as SVG',
          requestBody: body,
          responses: {
            200: svg,
            400: report('The request is not valid (outcome invalid): a schema error, an unknown semgraph, unreadable JSON.'),
            413: report('The body is larger than 1 MB.'),
            415: report('The body is not JSON.'),
            422: report('The chart is refused (outcome refused): it would mislead. The issues say why and what to use instead.'),
          },
        },
      },
      '/validate': {
        post: {
          tags: ['charts'],
          operationId: 'validate',
          summary: 'Check a request without drawing it',
          requestBody: body,
          responses: {
            200: report('The report: outcome ok, deviation, refused or invalid, with every issue in the requested language.'),
            400: report('The body is not readable JSON.'),
            413: report('The body is larger than 1 MB.'),
            415: report('The body is not JSON.'),
          },
        },
      },
      '/semgraphs': {
        get: {
          tags: ['semgraphs'],
          operationId: 'listSemgraphs',
          summary: 'Every semgraph on offer, with its examples, and the planned ones (REQ-083)',
          parameters: [locale],
          responses: { 200: { description: 'The overview.', content: json('Overview') } },
        },
      },
      '/semgraphs/{id}': {
        get: {
          tags: ['semgraphs'],
          operationId: 'getSemgraph',
          summary: 'One semgraph: what it answers, when not to use it, its contract and examples',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { enum: ids } }, locale],
          responses: {
            200: { description: 'The semgraph.', content: json('Semgraph') },
            404: report('Unknown, or only planned.'),
          },
        },
      },
      '/semgraphs/{id}/examples/{name}': {
        get: {
          tags: ['semgraphs'],
          operationId: 'renderExample',
          summary: 'Draw one of the examples of a semgraph',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { enum: ids } },
            { name: 'name', in: 'path', required: true, description: 'The name of the example, as `GET /semgraphs/{id}` lists it.', schema: { type: 'string' } },
          ],
          responses: {
            200: svg,
            404: report('No such semgraph or example.'),
            422: report('The example shows a refusal.'),
          },
        },
      },
      '/healthz': {
        get: {
          tags: ['service'],
          operationId: 'health',
          summary: 'Health and versions',
          responses: { 200: { description: 'The service is up.', content: json('Health') } },
        },
      },
      '/gallery': {
        get: {
          tags: ['service'],
          operationId: 'gallery',
          summary: 'A page with every semgraph and all of its examples, drawn (REQ-083)',
          parameters: [locale],
          responses: { 200: { description: 'The page.', content: { 'text/html': { schema: { type: 'string' } } } } },
        },
      },
      [OPENAPI_PATH]: {
        get: {
          tags: ['service'],
          operationId: 'openApi',
          summary: 'This document (REQ-084); Swagger UI shows it on /docs',
          responses: { 200: { description: 'OpenAPI 3.1.', content: { 'application/json': { schema: { type: 'object' } } } } },
        },
      },
    },
    components: {
      schemas: {
        RenderRequest: {
          description: 'The request of one of the semgraphs, chosen by `semgraph`.',
          oneOf: ids.map((id) => ({ $ref: `#/components/schemas/${requestName(id)}` })),
          discriminator: { propertyName: 'semgraph', mapping: Object.fromEntries(ids.map((id) => [id, `#/components/schemas/${requestName(id)}`])) },
        },
        ...requests,
        Report: {
          type: 'object',
          required: ['outcome', 'locale', 'issues'],
          properties: {
            outcome: { description: 'ok: drawn. deviation: drawn outside the chart language, with a red alert. refused: not drawn, it would mislead. invalid: the request is not valid.', enum: ['ok', 'deviation', 'refused', 'invalid', 'error'] },
            semgraph: { type: 'string' },
            locale: { type: 'string' },
            issues: { type: 'array', items: { $ref: '#/components/schemas/Issue' } },
          },
        },
        Issue: {
          type: 'object',
          required: ['level', 'code', 'message'],
          properties: {
            level: { description: 'inputError (400), refusal (422), deviation (drawn, with a red alert), caution (drawn, with a red alert, inside the chart language), info.', enum: ['inputError', 'refusal', 'deviation', 'caution', 'info', 'error'] },
            code: { description: 'A stable code, e.g. insufficientData.', type: 'string' },
            field: { description: 'JSON pointer into the request, e.g. /points/3/mean.', type: 'string' },
            message: { description: 'What is wrong, in the requested language.', type: 'string' },
            alternative: { description: 'What to do instead.', type: 'string' },
            learnMore: { type: 'string' },
          },
        },
        Health: {
          type: 'object',
          required: ['status', 'version', 'languageVersion', 'tokensVersion'],
          properties: { status: { const: 'ok' }, version: { type: 'string' }, languageVersion: { type: 'string' }, tokensVersion: { type: 'string' } },
        },
        ExampleLink: {
          type: 'object',
          required: ['name', 'title', 'href'],
          properties: { name: { type: 'string' }, title: { type: 'string' }, href: { description: 'Where the example is drawn.', type: 'string' } },
        },
        Links: {
          type: 'object',
          properties: { figma: { type: 'string' }, learning: { description: 'The reading card.', type: 'string' } },
        },
        Overview: {
          type: 'object',
          required: ['locale', 'semgraphs', 'planned'],
          properties: {
            locale: { type: 'string' },
            semgraphs: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'title', 'answers', 'href', 'examples'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  answers: { description: 'The question the semgraph answers.', type: 'string' },
                  href: { type: 'string' },
                  links: { $ref: '#/components/schemas/Links' },
                  examples: { type: 'array', items: { $ref: '#/components/schemas/ExampleLink' } },
                },
              },
            },
            planned: { description: 'In the catalogue, not available yet.', type: 'array', items: { type: 'string' } },
            gallery: { type: 'string' },
            openapi: { type: 'string' },
            docs: { type: 'string' },
          },
        },
        Semgraph: {
          type: 'object',
          required: ['id', 'title', 'answers', 'schema'],
          properties: {
            id: { type: 'string' },
            locale: { type: 'string' },
            title: { type: 'string' },
            answers: { type: 'string' },
            exampleQuestions: { type: 'array', items: { type: 'string' } },
            attributes: { description: 'Its attributes in the vocabulary of the choice aid.', type: 'object' },
            doNotUseWhen: {
              description: 'When another semgraph fits better.',
              type: 'array',
              items: { type: 'object', properties: { intent: { type: 'string' }, use: { type: 'string' } } },
            },
            data: { type: 'object', properties: { minimumPoints: { type: 'integer' } } },
            links: { $ref: '#/components/schemas/Links' },
            examples: { type: 'array', items: { $ref: '#/components/schemas/ExampleLink' } },
            schema: { description: 'The contract of its request, JSON Schema 2020-12; the same as its schema in this document.', type: 'object' },
          },
        },
      },
      examples,
    },
  };
}
