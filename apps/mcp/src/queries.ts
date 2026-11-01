import { z } from 'zod';
import { answer, attempt, levelName, refusal } from './answers.js';
import { APP_ONLY, bytes, type Context, READ, SHARE, SHOWS, WRITE } from './context.js';
import { pages, Refused } from './datahub.js';
import type { Preflight } from './resources.js';

/** A Parameter of a query (DEC-UX-71), as query keeps it. */
const parameter = z
  .object({
    name: z.string(),
    kind: z.enum(['date', 'period', 'number', 'decimal', 'text', 'choice', 'several', 'yesno']),
    value: z.union([z.string(), z.boolean(), z.array(z.string())]),
    to: z.string().optional().describe('The end of a period.'),
    list: z.array(z.string()).optional().describe('The values a choice or several offers.'),
  })
  .passthrough();
const parameters = z.array(parameter).optional().describe('The Parameters of the SQL, used in it as @name.');
const id = z.string().min(1).describe('The ID of the query.');

interface Query {
  id: string;
  name: string;
  question: string;
  sql: string;
  parameters: unknown[];
  resources: { id: string; displayName: string; level?: number; deprecated?: boolean }[];
  lastRun: Run | null;
  [key: string]: unknown;
}

interface Run {
  ref: string;
  number: number;
  state: string;
  rowCount: number | null;
  processedBytes: number | null;
  [key: string]: unknown;
}

/** Queries through Claude (see docs/requirements/functional/17-claude.md, Queries through the MCP). */
export function queryTools({ server, hub, user }: Context): void {
  const enc = encodeURIComponent;
  const linked = (query: Query) => ({ ...query, page: hub.page(pages.query(query.id)) });
  /** A query as the MCP App and Claude read its result: its name and question, and its Resources with their Level (FR-CL-21). */
  const headOf = (query: Query, sql: string, values: unknown[]) => ({
    view: 'query',
    query: { id: query.id, name: query.name, question: query.question, page: hub.page(pages.query(query.id)) },
    sql,
    parameters: values,
    resources: query.resources.map((resource) => ({
      id: resource.id,
      displayName: resource.displayName,
      levelName: resource.level === undefined ? null : levelName(resource.level),
      ...(resource.deprecated ? { deprecated: true } : {}),
      page: hub.page(pages.resource(resource.id)),
    })),
  });

  server.registerTool(
    'suggest_lenses',
    {
      title: 'Find a Lens first',
      description:
        'The Lenses that use these Resources and run now: first those on exactly these Resources, then those on these and more, those that share most words with the question first. Call it before you write a query, and offer a Lens that answers the question.',
      inputSchema: {
        resources: z.array(z.string()).min(1).max(10).describe('The IDs of the Resources the question needs.'),
        question: z.string().max(500).optional().describe('The question of the User, in their words.'),
      },
      annotations: READ,
    },
    ({ resources, question }) =>
      attempt(async () => {
        const found = await hub.get<{ exact: { id: string }[]; more: { id: string }[] }>(
          'query',
          `/lenses/suggestions?resources=${resources.map(enc).join(',')}${question ? `&question=${enc(question)}` : ''}`,
        );
        const link = (lens: { id: string }) => ({ ...lens, page: hub.page(pages.lens(lens.id)) });
        return answer(
          { exact: found.exact.map(link), more: found.more.map(link) },
          found.exact.length + found.more.length === 0 ? 'No Lens uses these Resources: a query of the User is the way.' : 'Offer the Lens that answers the question before you write a query.',
        );
      }),
  );

  server.registerTool(
    'create_query',
    {
      title: 'Make a query',
      description:
        'Makes a query of the User on 1 to 10 Resources, with a name and their question; it reads only those Resources, so choose them first. Without SQL, Data Hub writes a start that filters on the partition column. To add a Resource later, make a new query with startedFrom.',
      inputSchema: {
        name: z.string().min(1).max(120).describe('A short name, such as "Partner share per week".'),
        question: z.string().max(500).optional().describe('The question of the User, in their words.'),
        resources: z.array(z.string()).min(1).max(10).describe('The IDs of the Resources it reads.'),
        sql: z.string().max(100_000).optional().describe('The SQL; name a Resource by its Key, in backticks.'),
        parameters,
        startedFrom: z.string().optional().describe('The ID of the query this one starts from, when it needs another set of Resources.'),
      },
      annotations: WRITE,
    },
    (args) =>
      attempt(async () => {
        const { query } = await hub.send<{ query: Query }>('query', 'POST', '/queries', args);
        return answer({ query: linked(query) }, 'The query is in the panel of Query of the User. Check its SQL with check_query until it can run.');
      }),
  );

  server.registerTool(
    'check_query',
    {
      title: 'Check a query',
      description:
        'Keeps the SQL and Parameters of a query and gives its Pre-flight: whether it can run, what it reads and in which range, how many partitions, what keeps it from running (a table outside its Resources, an undefined Parameter, a required partition filter, the words of BigQuery) and what it warns about. Fix what it names and check again until it can run.',
      inputSchema: { id, sql: z.string().max(100_000), parameters },
      annotations: WRITE,
    },
    ({ id: queryId, sql, parameters: given = [] }) =>
      attempt(async () => {
        const checked = await hub.send<{ preflight: Preflight; broken: unknown }>('query', 'POST', `/queries/${enc(queryId)}/preflight`, { sql, parameters: given });
        const { preflight } = checked;
        const note = !preflight.runnable
          ? 'It cannot run as it is: fix what problems names, and check again.'
          : preflight.range === 'free'
            ? `It can run: it reads ${bytes(preflight.bytes)}.`
            : `It can run, but reads ${bytes(preflight.bytes)}: ${preflight.range === 'request' ? 'above 1 GB, the Data Team accepts it first' : 'above 100 MB, the User approves it'}. A filter on the partition column reads less.`;
        return answer({ ...checked, reads: bytes(preflight.bytes) }, note);
      }),
  );

  /** Runs a query of the User, as Query runs it; Claude never approves, so above 100 MB it waits for the User (FR-CL-20, DEC-CL-07). */
  async function run(queryId: string, given: { sql?: string | undefined; parameters?: unknown[] | undefined }, approve: boolean) {
    const { query } = await hub.get<{ query: Query }>('query', `/queries/${enc(queryId)}`);
    const sql = given.sql ?? query.sql;
    const values = given.parameters ?? query.parameters;
    const head = headOf(query, sql, values);
    try {
      const ran = await hub.send<{ run: Run; page: Record<string, unknown> }>('query', 'POST', `/queries/${enc(queryId)}/runs`, { sql, parameters: values, approve });
      return { ...head, outcome: 'ran' as const, run: ran.run, page: ran.page, reads: bytes(ran.run.processedBytes) };
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      const preflight = (error.body.preflight ?? null) as Preflight | null;
      const reads = bytes(preflight?.bytes);
      if (error.code === 'approval_needed') return { ...head, outcome: 'approve' as const, preflight, reads };
      if (error.code === 'request_needed') {
        const { requests } = await hub.get<{ requests: { state: string }[] }>('catalogue', `/requests?subjectKind=query&subjectId=${enc(queryId)}`).catch(() => ({ requests: [] }));
        return { ...head, outcome: 'request' as const, preflight, reads, request: requests[0] ?? null };
      }
      if (error.status === 409 || error.status === 422) return { ...head, outcome: 'blocked' as const, preflight, reads, problem: error.message };
      throw error;
    }
  }

  const runNote = (shown: Awaited<ReturnType<typeof run>>): string => {
    const levels = shown.resources.map((resource) => `${resource.displayName}${resource.levelName ? ` (${resource.levelName})` : ''}`).join(', ');
    switch (shown.outcome) {
      case 'ran':
        return `The query ran and its result is shown to the User; its first rows are below. Answer from them, and name the Levels: ${levels}.`;
      case 'approve':
        return `The query reads ${shown.reads}, more than the 100 MB Data Hub runs freely. Only the User approves it, in the window; you cannot. A filter on the partition column reads less.`;
      case 'request':
        return `The query reads ${shown.reads}, more than 1 GB: the Data Team accepts it first. Only the User sends that Request, in the window; you cannot.${shown.request?.state === 'waiting' ? ' A Request of theirs is waiting already; do not send another.' : ''}`;
      case 'blocked':
        return `The query cannot run as it is: ${shown.problem}. Check it with check_query and fix what it names.`;
    }
  };

  server.registerTool(
    'run_query',
    {
      title: 'Run a query',
      description:
        'Runs a query of the User and shows its result in the conversation, within the ranges of Query: up to 100 MB it runs and you get the first 100 rows; above, only the User approves it, or sends a Request to the Data Team above 1 GB, in the window. Without SQL, it runs the SQL the query keeps.',
      inputSchema: { id, sql: z.string().max(100_000).optional(), parameters },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: SHOWS,
    },
    ({ id: queryId, sql, parameters: given }) =>
      attempt(async () => {
        const shown = await run(queryId, { sql, parameters: given }, false);
        return answer(shown, runNote(shown));
      }),
  );

  server.registerTool(
    'run_query_approved',
    {
      title: 'Approve and run a query',
      description: 'The button of the User: runs a query that reads more than 100 MB, as they approved it. Only the MCP App calls this.',
      inputSchema: { id, sql: z.string().max(100_000).optional(), parameters },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: APP_ONLY,
    },
    ({ id: queryId, sql, parameters: given }) =>
      attempt(async () => {
        const shown = await run(queryId, { sql, parameters: given }, true);
        return answer(shown, runNote(shown));
      }),
  );

  server.registerTool(
    'send_query_request',
    {
      title: 'Send a query to the Data Team',
      description: 'The button of the User: sends a Request to the Data Team to run a query above 1 GB. Only the MCP App calls this.',
      inputSchema: { id, sql: z.string().max(100_000), parameters, text: z.string().max(500).optional() },
      annotations: SHARE,
      _meta: APP_ONLY,
    },
    ({ id: queryId, sql, parameters: given = [], text = '' }) =>
      attempt(async () => {
        const sent = await hub.send<Record<string, unknown>>('query', 'POST', `/queries/${enc(queryId)}/requests`, { sql, parameters: given, text });
        return answer({ view: 'sent', ...sent }, 'The User sent the Request to the Data Team; its answer comes in their Message Centre.');
      }),
  );

  server.registerTool(
    'show_query',
    {
      title: 'Show a query',
      description: 'Shows a query of the User with the result of its last run in the conversation, without running it again.',
      inputSchema: { id },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: queryId }) =>
      attempt(async () => {
        const { query } = await hub.get<{ query: Query }>('query', `/queries/${enc(queryId)}`);
        const head = headOf(query, query.sql, query.parameters);
        const last = query.lastRun;
        if (!last || last.state !== 'done') return answer({ ...head, outcome: 'notRun' }, 'It has no result to show: run it with run_query.');
        try {
          const { page } = await hub.get<{ page: Record<string, unknown> }>('query', `/runs/${enc(last.ref)}/rows?page=1`);
          return answer({ ...head, outcome: 'ran', run: last, page, reads: bytes(last.processedBytes) }, 'The result of its last run is shown to the User.');
        } catch (error) {
          if (error instanceof Refused && (error.status === 410 || error.status === 404)) return answer({ ...head, outcome: 'expired' }, 'BigQuery no longer keeps its result: offer to run it again, through the Pre-flight like every run.');
          throw error;
        }
      }),
  );

  server.registerTool(
    'get_result_page',
    {
      title: 'Read another page of a result',
      description: 'Another page of 100 rows of a run, read from the same run without querying again. Only who ran it reads it.',
      inputSchema: { run: z.string().describe('The ref of the run.'), page: z.number().int().min(1).describe('The page, from 1.') },
      annotations: READ,
    },
    ({ run: ref, page }) =>
      attempt(async () => {
        try {
          return answer(await hub.get<Record<string, unknown>>('query', `/runs/${enc(ref)}/rows?page=${page}`));
        } catch (error) {
          if (error instanceof Refused && error.status === 410) return refusal('BigQuery no longer keeps this result (EC-CL-05). Offer to run the query again, through the Pre-flight like every run.');
          throw error;
        }
      }),
  );

  server.registerTool(
    'list_queries',
    {
      title: 'Find your queries',
      description:
        'The queries of the User, newest first, narrowed by a period or words, with what each ran on, its runs and whether it went to the Data Team. The Data Team can list everyone\'s with everyone: true.',
      inputSchema: {
        from: z.string().optional().describe('From this moment, such as 2026-10-26T00:00:00Z.'),
        to: z.string().optional().describe('Until this moment.'),
        words: z.string().max(200).optional().describe('Words in its name, question or Resources.'),
        limit: z.number().int().min(1).max(200).optional(),
        everyone: z.boolean().optional().describe('For the Data Team: the queries of everyone, with who ran them.'),
      },
      annotations: READ,
    },
    ({ from, to, words, limit, everyone }) =>
      attempt(async () => {
        if (everyone && !user.roles.includes('datateam')) return refusal('Only the Data Team sees the queries of others.');
        const search = new URLSearchParams();
        if (everyone) search.set('all', 'true');
        if (from) search.set('from', from);
        if (to) search.set('to', to);
        if (words) search.set('q', words);
        search.set('limit', String(limit ?? 50));
        const { queries } = await hub.get<{ queries: Query[] }>('query', `/queries?${search}`);
        return answer({ queries: queries.map(linked) });
      }),
  );

  server.registerTool(
    'get_query',
    {
      title: 'Read a query',
      description: 'A query with its SQL, Resources, Parameters, last runs, Request, whether it is Broken and the Lens made of it.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: queryId }) =>
      attempt(async () => {
        const [{ query }, { runs }] = await Promise.all([
          hub.get<{ query: Query }>('query', `/queries/${enc(queryId)}`),
          hub.get<{ runs: Run[] }>('query', `/queries/${enc(queryId)}/runs?limit=5`),
        ]);
        return answer({ query: linked(query), runs });
      }),
  );

  server.registerTool(
    'update_query',
    {
      title: 'Change a query',
      description: 'Changes the name, question, SQL or Parameters of a query of the User. Its Resources do not change: another set is a new query.',
      inputSchema: { id, name: z.string().min(1).max(120).optional(), question: z.string().max(500).optional(), sql: z.string().max(100_000).optional(), parameters },
      annotations: WRITE,
    },
    ({ id: queryId, ...changes }) =>
      attempt(async () => {
        const given = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
        if (Object.keys(given).length === 0) return refusal('Name at least one thing to change.');
        const { query } = await hub.send<{ query: Query }>('query', 'PATCH', `/queries/${enc(queryId)}`, given);
        return answer({ query: query ? linked(query) : null }, 'Changed.');
      }),
  );
}
