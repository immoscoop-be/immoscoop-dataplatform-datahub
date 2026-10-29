import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import type { Config } from './lib/config.js';

const CONFIG: Config = {
  identityUrl: 'https://identity.test',
  catalogueUrl: 'https://catalogue.test',
  registryUrl: 'https://registry.test',
  queryUrl: 'https://query.test',
  semgraphUrl: 'https://semgraph.test',
};

const ME = { sub: '1', email: 'max@thenextimmoscoop.be', name: 'Max Verstraete', groups: [] as string[], roles: [] as string[] };

/** A Question on Credit leads, unread for its Owner Unit (MSG-CNV-01). */
const QUESTION = {
  id: 'm1',
  type: 'MSG-CNV-01',
  kind: 'question',
  subject: { kind: 'collection', id: 'c1', name: 'Credit leads', collection: null, exists: true },
  writer: { id: '7', name: 'Ruth Aerts', as: null },
  params: { text: 'Will KBC follow-up be published this month?', writer: 'Ruth Aerts' },
  state: 'open',
  createdAt: '2026-10-28T10:00:00Z',
  lastAt: '2026-10-28T10:00:00Z',
  unread: true,
};

/** What Data Hub told the Owner of Weekly lead volume: a description changed in dbt (MSG-RES-02). */
const DESCRIBED = {
  id: 'm2',
  type: 'MSG-RES-02',
  kind: 'dataHub',
  subject: { kind: 'resource', id: 'r2', name: 'Weekly lead volume', collection: { id: 'c1', name: 'Credit leads' }, exists: true },
  writer: null,
  params: {
    run: '2026-10-25',
    count: '1',
    changes: JSON.stringify([{ on: 'field', field: 'lead_count', before: 'Number of leads', after: 'Number of leads, without tests', hasBusiness: 'no' }]),
  },
  state: null,
  createdAt: '2026-10-27T06:40:00Z',
  lastAt: '2026-10-27T06:40:00Z',
};

/** A Request to run a query above 1 GB, waiting for the Data Team (MSG-QRY-01). */
const REQUEST = {
  id: 'm3',
  type: 'MSG-QRY-01',
  kind: 'request',
  subject: { kind: 'query', id: 'q9', name: 'Partner leads since 2019', collection: null, exists: true },
  writer: { id: '8', name: 'Karel Leys', as: null },
  params: { subject: 'Partner leads since 2019', writer: 'Karel Leys', reads: '4800000000', threshold: '1000000000', text: 'For the five-year review.' },
  state: 'waiting',
  createdAt: '2026-10-28T12:00:00Z',
  lastAt: '2026-10-28T12:00:00Z',
};

interface Saved {
  method: string;
  path: string;
  body?: unknown;
}

/** A Resource that waits for a Collection, as catalogue gives it. */
const SAVED_SEARCHES = {
  id: 'r1',
  key: 'immoscoop-dataplatform-398214.dbt_prod_stacks.saved_searches',
  displayName: 'Saved searches',
  name: 'saved_searches',
  resourceType: 'model',
  projectId: '9367',
  projectName: 'immoscoop_dataplatform_sql',
  nodeId: 'model.immoscoop_dataplatform_sql.saved_searches',
  description: 'One row per saved search.',
  exposures: ['datahub_savedSearches'],
  collectionId: null,
  level: 1,
  registeredAt: '2026-10-21T08:00:00Z',
  withdrawn: false,
  fields: [
    { name: 'search_id', position: 1, dataType: 'STRING', description: '', businessDescription: '' },
    { name: 'filters', position: 2, dataType: 'STRING', description: '', businessDescription: '' },
  ],
  leftOut: [],
  details: { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, origins: {}, release: null, mappings: [] },
  card: { businessDescription: '', intendedUse: '', pitfalls: '', knownGaps: [], reliableSince: null, keyFields: [], parameters: [] },
  published: false,
  deprecated: false,
  publication: null,
  deprecation: null,
  changes: [],
  descriptionChanges: [],
};

const DATA = { id: 'g1', email: 'data@thenextimmoscoop.be', name: 'Data' };
const SALES = { id: 'g2', email: 'sales@thenextimmoscoop.be', name: 'Sales' };

/** A Collection of the group Data, with one Resource in it that is not published yet. */
const CREDIT = {
  id: 'c1',
  name: 'Credit leads',
  description: 'The credit leads Immoscoop sends to KBC.',
  icon: 'coins',
  ownerUnit: DATA,
  visibility: 'public',
  createdAt: '2026-09-03T08:00:00Z',
  createdBy: 'An Claes',
  canManage: true,
  resources: [{ id: 'r2', key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume', displayName: 'Weekly lead volume', level: 2, published: false, deprecated: false, withdrawn: false }],
  lastChange: { logId: 'COL-006', params: { resource: 'Weekly lead volume', actor: 'Dirk Vos' }, at: '2026-10-27T08:00:00Z' },
};

/** A public Collection of another group. */
const LISTINGS = {
  ...CREDIT,
  id: 'c2',
  name: 'Listings',
  description: 'Every listing on the site.',
  icon: 'buildings',
  ownerUnit: SALES,
  canManage: false,
  resources: [],
  lastChange: null,
};

const WEEKLY = {
  ...SAVED_SEARCHES,
  id: 'r2',
  key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume',
  displayName: 'Weekly lead volume',
  name: 'weekly_lead_volume',
  collectionId: 'c1',
  level: 2,
  lastChange: { logId: 'COL-030', params: { collection: 'Credit leads', actor: 'Dirk Vos' }, at: '2026-10-27T08:00:00Z' },
};

/** Weekly lead volume as its page reads it, with what its Owner keeps about it. */
const WEEKLY_DETAIL = {
  ...WEEKLY,
  description: 'One row per week and lead source.',
  fields: [
    { name: 'week_start', position: 1, dataType: 'DATE', description: 'Monday of the week', businessDescription: '' },
    { name: 'lead_source', position: 2, dataType: 'STRING', description: 'Where the lead came from', businessDescription: 'The website, the app or a partner.' },
  ],
  details: { ...SAVED_SEARCHES.details, partition: { field: 'week_start', unit: 'day' }, clusterBy: ['lead_source'], origins: { partition: 'dbt', clusterBy: 'dbt' } },
};

/** The lineage around Weekly lead volume: two models upstream, one downstream (DEC-AR-06). */
const node = (name: string, layer: string, distance: number) => ({
  uniqueId: `model.p.${name}`,
  name,
  resourceType: 'model',
  layer,
  projectId: '9367',
  projectName: 'dbt-prod',
  distance,
});
const WEEKLY_LINEAGE = {
  nodeId: 'model.p.weekly',
  upstream: {
    nodes: [node('weekly', 'marts', 0), node('int_leads', 'intermediate', 1), node('stg_leads', 'staging', 2)],
    edges: [
      { parentId: 'model.p.int_leads', childId: 'model.p.weekly' },
      { parentId: 'model.p.stg_leads', childId: 'model.p.int_leads' },
    ],
    truncated: false,
  },
  downstream: { nodes: [node('weekly', 'marts', 0), node('lead_share', 'marts', 1)], edges: [{ parentId: 'model.p.weekly', childId: 'model.p.lead_share' }], truncated: false },
  resources: [{ nodeId: 'model.p.weekly', id: 'r2', displayName: 'Weekly lead volume', level: 2 }],
};

/** The server of the web app, identity and catalogue, as the page meets them: with or without a session. */
const QUERY = {
  id: 'q1',
  kind: 'query',
  lens: null as unknown,
  name: 'Leads per source name',
  question: 'Which sources bring our leads, week by week?',
  sql: 'select week_start, lead_source\nfrom `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`\nwhere week_start >= date_sub(current_date(), interval 28 day)\n',
  ownerName: 'Max Verstraete',
  mine: true,
  createdAt: '2026-10-29T08:00:00Z',
  lastRunAt: null as string | null,
  resources: [
    {
      visible: true,
      id: 'r2',
      key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume',
      displayName: 'Weekly lead volume',
      collectionId: 'c1',
      level: 2,
      deprecated: false,
      partition: { field: 'week_start', unit: 'day' },
      clusterBy: ['lead_source'],
      partitionFilter: 'none',
      fields: [{ name: 'week_start', dataType: 'DATE', description: 'Monday of the week', businessDescription: '' }],
    },
  ],
  lastRun: null as unknown,
  parameters: [] as unknown[],
  runs: 0,
  request: null as unknown,
  startedFrom: null,
};

const RUN = {
  ref: 'q-20261029-4c2e1a',
  number: 1,
  sql: QUERY.sql,
  parameters: [] as unknown[],
  state: 'done',
  error: null,
  userName: 'Max Verstraete',
  estimatedBytes: 80_000_000,
  approved: false,
  processedBytes: 79_000_000,
  billedBytes: 80_000_000,
  partitions: 4,
  rowCount: 210,
  columns: [
    { name: 'week_start', type: 'DATE' },
    { name: 'leads', type: 'INT64' },
  ],
  startedAt: '2026-10-29T08:12:00Z',
  finishedAt: '2026-10-29T08:12:03Z',
};

const PAGE = { number: 1, size: 100, totalRows: 210, columns: RUN.columns, rows: [['2026-10-19', '413'], ['2026-10-12', null]] };

/** A Lens of Max in Credit leads, made from the query Leads per source name (DEC-LE-03). */
const LENS = {
  id: 'l1',
  name: 'Leads per source, week by week',
  question: 'Which sources bring our leads?',
  shows: 'How many leads each source brings, week by week.',
  tags: ['leads', 'source'],
  collectionId: 'c1',
  level: 2,
  state: 'published',
  resources: [{ id: 'r2', displayName: 'Weekly lead volume', collectionId: 'c1', level: 2 }],
  authorName: 'Max Verstraete',
  mine: true,
  createdAt: '2026-10-29T08:00:00Z',
  publishedAt: '2026-10-29T08:00:00Z',
  steps: ['Takes the weekly lead volume from From.', 'Keeps one lead channel.'],
  parameters: [
    { name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', label: 'From' },
    { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'], label: 'Lead channel' },
  ],
  canManage: true,
  version: 1,
  range: 'free',
  reads: 80_000_000,
  fromQuery: { id: 'q1', name: 'Leads per source name' },
  request: null as unknown,
  broken: null as unknown,
  stoppedAt: null as string | null,
  stoppedReads: null as number | null,
  versions: [{ version: 1, madeByName: 'Max Verstraete', madeAt: '2026-10-29T08:00:00Z', fromQuery: 'Leads per source name' }],
  log: [] as unknown[],
};

/**
 * The Pre-flight query gives: an @name that is not a Parameter, 4.8 GB or 840 MB for SQL that says so, a
 * table outside, or 80 MB.
 */
function preflightOf(sql: string, parameters: { name: string }[] = []) {
  const base = { partitions: 4, problems: [] as unknown[], warnings: [] as unknown[], thresholds: { approve: 100_000_000, request: 1_000_000_000 }, unused: [] as string[] };
  const at = sql.indexOf('@leadChannel');
  if (at >= 0 && !parameters.some((parameter) => parameter.name === 'leadChannel')) {
    return { ...base, runnable: false, bytes: null, range: null, partitions: null, problems: [{ kind: 'undefinedParameter', name: 'leadChannel', start: at, end: at + 12, suggestedKind: 'choice' }] };
  }
  if (sql.includes('-- every year')) return { ...base, runnable: true, bytes: 4_800_000_000, range: 'request' };
  if (sql.includes('partner_contracts')) {
    const start = sql.indexOf('`immoscoop-dataplatform-398214.dbt_prod_stacks.partner_contracts`');
    return { ...base, runnable: false, bytes: null, range: null, partitions: null, problems: [{ kind: 'outside', name: 'immoscoop-dataplatform-398214.dbt_prod_stacks.partner_contracts', start, end: start + 66 }] };
  }
  if (!sql.includes('where')) {
    return { ...base, runnable: true, bytes: 900_000_000, range: 'approve', warnings: [{ kind: 'noPartitionFilter', resource: { id: 'r2', displayName: 'Weekly lead volume' }, column: 'week_start', fix: `${sql} where week_start >= '2026-10-01'`, bytesWithFilter: 82_000_000 }] };
  }
  return sql.includes('-- all weeks') ? { ...base, runnable: true, bytes: 840_000_000, range: 'approve' } : { ...base, runnable: true, bytes: 80_000_000, range: 'free' };
}

function serve({
  signedIn = true,
  settings = {} as Record<string, unknown>,
  roles = [] as string[],
  groups = [] as string[],
  weekly = {} as Record<string, unknown>,
  queries = [] as Record<string, unknown>[],
  lenses = [] as Record<string, unknown>[],
  conversations = [] as Record<string, unknown>[],
  learned = [] as Record<string, unknown>[],
} = {}): Saved[] {
  const calls: Saved[] = [];
  // The Messages as catalogue keeps them, changed by what the page asks.
  const talk = conversations.map((message) => ({ replies: [], replyCount: 0, unread: false, mine: false, ...message })) as Record<string, unknown>[];
  // Weekly lead volume as catalogue keeps it, changed by what the page asks.
  let resource: Record<string, unknown> = { ...WEEKLY_DETAIL, ...weekly };
  const PUBLICATION = { publishedAt: '2026-10-28T09:00:00Z', publishedBy: 'Max Verstraete', confirmedAt: '2026-10-28T09:00:00Z', confirmedBy: 'Max Verstraete' };
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = input.replace(CONFIG.identityUrl, '').replace(CONFIG.catalogueUrl, '').replace(CONFIG.registryUrl, '').replace(CONFIG.queryUrl, '');
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (path === '/auth/token') {
      return signedIn ? json({ access_token: 'token', expires_in: 3600 }) : json({ error: 'no_session' }, 401);
    }
    calls.push({ method, path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) });
    if (path === '/me') {
      return json({ ...ME, roles, groups });
    }
    const dataTeam = roles.includes('datateam');
    if (path === '/collections' && method === 'GET') {
      return json({ collections: [CREDIT, LISTINGS] });
    }
    if (path === '/collections' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; ownerUnit: string };
      return json({ ...CREDIT, ...body, id: 'c-new', ownerUnit: DATA, resources: [], lastChange: null }, 201);
    }
    if (path === '/collections/c1') {
      return method === 'PATCH' ? json({ ...CREDIT, ...JSON.parse(init.body as string) }) : json(CREDIT);
    }
    if (path === '/collections/c2') {
      return json(LISTINGS);
    }
    if (path === '/collections/c2/resources') {
      return json({ resources: [] });
    }
    if (path === '/collections/c-new') {
      return json({ ...CREDIT, id: 'c-new', name: 'Search behaviour', resources: [], lastChange: null });
    }
    if (path === '/collections/c1/resources') {
      return json({ resources: method === 'POST' ? [WEEKLY, { ...SAVED_SEARCHES, collectionId: 'c1', lastChange: null }] : [WEEKLY] });
    }
    if (path === '/collections/c-new/resources') {
      return json({ resources: [] });
    }
    if (/^\/collections\/(c1|c2|c-new)\/log$/.test(path)) {
      return json({ entries: [{ logId: 'COL-001', params: { actor: 'An Claes', name: 'Credit leads' }, at: '2026-09-03T08:00:00Z' }] });
    }
    if (path === '/domain-model') {
      return json({
        domain: 'immoscoop',
        version: '0.1.0',
        release: '0.0.70',
        relationTypes: [{ name: 'occurredWithin', cardinality: 'one', description: '' }],
        identities: ['visitor.visitorId', 'search.searchId'],
      });
    }
    if (path === `/nodes/${encodeURIComponent(SAVED_SEARCHES.nodeId)}/proposal`) {
      return json({
        nodeId: SAVED_SEARCHES.nodeId,
        builtOn: { name: 'saved_searches', entity: null, action: null, colleciones: false },
        storage: { partition: null, clusterBy: [], requirePartitionFilter: false, from: null },
        grain: { fields: ['search_id'], origin: 'test' },
        modelType: null,
        mappings: [{ field: 'search_id', kind: 'is', relationType: null, identity: 'search.searchId', origin: 'name' }],
        domainModel: { release: '0.0.70' },
      });
    }
    if (path === '/groups') {
      return dataTeam ? json({ groups: [DATA, SALES] }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources?collection=none') {
      return dataTeam ? json({ resources: [SAVED_SEARCHES] }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources/r1' && dataTeam) {
      return json({ resource: SAVED_SEARCHES });
    }
    if (path === '/resources/r2') {
      const changes = method === 'PATCH' ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      resource = { ...resource, card: { ...(resource.card as object), ...changes } };
      return json({ resource });
    }
    if (path === '/resources/r2/publication' && method === 'POST') {
      resource = { ...resource, published: true, level: 3, publication: PUBLICATION };
      return json({ resource });
    }
    if (path === '/resources/r2/changes/seen' && method === 'POST') {
      resource = { ...resource, changes: [] };
      return json({ resource });
    }
    if (path === '/resources/r2/deprecation') {
      const body = method === 'PUT' ? (JSON.parse(init.body as string) as { reason: string }) : undefined;
      resource = body
        ? { ...resource, deprecated: true, deprecation: { at: '2026-10-28T09:00:00Z', by: 'Max Verstraete', reason: body.reason, insteadOf: null } }
        : { ...resource, deprecated: false, deprecation: null };
      return json({ resource });
    }
    if (path === '/resources/r2/details' && method === 'PUT') {
      return dataTeam ? json({ resource: WEEKLY_DETAIL }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources/r2/fields' && method === 'PUT') {
      return json({ resource: WEEKLY_DETAIL });
    }
    if (path === '/resources/r2/log') {
      return json({ entries: [] });
    }
    if (path === '/resources/r2/related') {
      return json({ related: [] });
    }
    if (path === '/resources/r2/lineage') {
      return json(WEEKLY_LINEAGE);
    }
    if (path === '/resources/r1/related' && dataTeam) {
      return json({ related: [] });
    }
    if (path === '/resources/r1/log' && dataTeam) {
      return json({
        entries: [
          { logId: 'RES-002', params: { level: '1', reason: 'fields-undescribed' }, at: '2026-10-21T08:00:00Z' },
          { logId: 'RES-001', params: { exposure: 'datahub_savedSearches', key: SAVED_SEARCHES.key, run: '7' }, at: '2026-10-21T08:00:00Z' },
        ],
      });
    }
    // query, as it tells the size of a Resource, previews it and lists the queries on it (FR-SR-38, FR-SR-39, FR-SR-44).
    if (path === '/resources/r2/storage') {
      return json({ storage: { key: WEEKLY_DETAIL.key, bytes: 6_200_000_000, rows: 41_000, partitions: 312, modifiedAt: '2026-10-28T06:00:00Z', beneath: false } });
    }
    if (path === '/resources/r2/preview/choices') {
      const { window } = JSON.parse(init.body as string) as { window: number };
      return json({
        window: { field: 'week_start', unit: 'day', from: window === 1 ? '2026-10-19' : '2026-09-28', window },
        choices: [{ field: 'lead_source', dataType: 'STRING', role: 'cluster', kind: 'choice', values: ['app', 'website'] }],
      });
    }
    if (path === '/resources/r2/preview/preflight') {
      return json({ preflight: { ...preflightOf('select * from weekly where week_start >= @week'), bytes: 12_000_000 }, queryId: 'q-preview', request: null });
    }
    if (path === '/resources/r2/preview/runs') {
      return json({ run: { ...RUN, ref: 'q-20261029-preview' }, page: PAGE }, 201);
    }
    if (path === '/resources/r2/queries') {
      if (!dataTeam && !groups.includes('g1')) return json({ error: 'not_found' }, 404);
      return json({
        summary: { queries: 2, lenses: 0, colleagues: 2 },
        queries: [
          { id: 'q1', name: 'Leads per source name', kind: 'query', ownerName: 'Max Verstraete', mine: true, runs: 3, lastRunAt: '2026-10-29T08:00:00Z', lastRead: 79_000_000, lastEstimate: 80_000_000, lastState: 'done' },
          { id: 'q-preview-k', name: 'Preview · Weekly lead volume', kind: 'preview', ownerName: 'Karel Peeters', mine: false, runs: 1, lastRunAt: '2026-10-28T08:00:00Z', lastRead: null, lastEstimate: 12_000_000, lastState: 'failed' },
        ],
      });
    }
    // query, as it keeps the Lenses: made from a query, seen and run as the User may (TR-LE-01).
    if (path === '/lenses' && method === 'GET') {
      return json({ lenses: lenses.map(({ steps: _steps, parameters: _parameters, ...item }) => item) });
    }
    if (path === '/lenses' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; collectionId: string; steps: string[] };
      const made = { ...LENS, id: 'l-made', name: body.name, collectionId: body.collectionId, steps: body.steps };
      lenses.push(made);
      return json({ lens: made }, 201);
    }
    // The search of the start screen of Collections (DEC-UX-127): nothing for a question about brokers.
    if (path.startsWith('/search?') || path.startsWith('/lenses/search?')) {
      const asked = new URLSearchParams(path.split('?')[1]).get('question') ?? '';
      const none = asked.includes('brokers');
      if (path.startsWith('/lenses/search?')) {
        return json({ lenses: none ? [] : lenses.map(({ steps: _steps, parameters: _parameters, ...item }) => ({ ...item, shared: 2, marked: null, sharedTags: ['leads'] })) });
      }
      return json(
        none
          ? { collections: [], resources: [] }
          : {
              collections: [{ id: 'c1', name: [{ text: 'Credit ', shared: false }, { text: 'leads', shared: true }], description: [{ text: 'What happens to the leads.', shared: false }], icon: 'coins', resources: 1, shared: 1 }],
              resources: [
                {
                  id: 'r2',
                  displayName: [{ text: 'Weekly ', shared: false }, { text: 'lead', shared: true }, { text: ' volume', shared: false }],
                  description: [{ text: 'The leads of every week.', shared: false }],
                  collectionId: 'c1',
                  collectionName: 'Credit leads',
                  level: 2,
                  shared: 1,
                },
              ],
            },
      );
    }
    // The Lenses on the Resources of a query, those on exactly these first; a shared word is one of its name (FR-SR-47).
    if (path.startsWith('/lenses/suggestions?')) {
      const search = new URLSearchParams(path.split('?')[1]);
      const on = (search.get('resources') ?? '').split(',');
      const words = (search.get('question') ?? '').toLowerCase().split(/\W+/).filter((word) => word.length > 3);
      const offered = lenses
        .filter((item) => item.state === 'published' && !item.broken && on.every((id) => (item.resources as { id: string }[]).some((resource) => resource.id === id)))
        .map(({ steps: _steps, parameters: _parameters, ...item }) => {
          const name = item.name as string;
          const hits = words.filter((word) => name.toLowerCase().includes(word));
          const at = hits[0] ? name.toLowerCase().indexOf(hits[0]) : -1;
          const marked = at < 0 ? null : { name: [{ text: name.slice(0, at), shared: false }, { text: name.slice(at, at + (hits[0] as string).length), shared: true }, { text: name.slice(at + (hits[0] as string).length), shared: false }].filter((piece) => piece.text), question: [], shows: [] };
          return { ...item, shared: hits.length, marked, sharedTags: [] as string[], exact: (item.resources as unknown[]).length === on.length };
        });
      return json({ exact: offered.filter((item) => item.exact), more: offered.filter((item) => !item.exact) });
    }
    const lens = lenses.find((candidate) => path.startsWith(`/lenses/${candidate.id as string}`));
    if (lens && path === `/lenses/${lens.id as string}` && method === 'PATCH') {
      const { labels: _labels, ...changes } = JSON.parse(init.body as string) as Record<string, unknown>;
      Object.assign(lens, changes);
      return json({ lens });
    }
    if (lens && path === `/lenses/${lens.id as string}`) {
      return json({ lens });
    }
    // "Open in Query": its query for its author (DEC-LE-18).
    if (lens && path.endsWith('/query')) {
      return json({ queryId: 'q1' });
    }
    if (lens && path.endsWith('/version')) {
      Object.assign(lens, { version: (lens.version as number) + 1 });
      return json({ lens, preflight: preflightOf('where') });
    }
    // A run with its defaults that now reads more than 1 GB stops the Lens (DEC-LE-11).
    if (lens && path.endsWith('/preflight') && lens.grows) {
      Object.assign(lens, { state: 'stopped', range: 'request', stoppedAt: '2026-10-29T09:00:00Z', stoppedReads: 1_400_000_000 });
      return json({ error: 'stopped', stoppedReads: 1_400_000_000 }, 409);
    }
    if (lens && path.endsWith('/preflight')) {
      const { values } = JSON.parse(init.body as string) as { values: Record<string, unknown> };
      // Every week since 2019 reads more than 100 MB.
      return json({ preflight: values.dateFrom === '2019-01-01' ? { ...preflightOf('where'), bytes: 840_000_000, range: 'approve' } : preflightOf('where') });
    }
    if (lens && path.endsWith('/runs')) {
      return json({ run: { ...RUN, ref: 'q-20261029-1e2a3b', parameters: LENS.parameters }, page: PAGE }, 201);
    }
    // query, as it keeps the queries of the User and checks and runs their SQL (TR-SR-15 to TR-SR-17).
    if (path === '/queries' && method === 'GET') {
      return json({
        queries: queries.map(({ id, name, kind, ownerName, resources: on, lastRunAt, createdAt, request }) => ({ id, name, kind: kind ?? 'query', ownerName, resources: on, lastRunAt, createdAt, runs: lastRunAt ? 1 : 0, request: request ?? null })),
      });
    }
    if (path === '/queries' && method === 'POST') {
      const { name, question } = JSON.parse(init.body as string) as { name: string; question: string };
      const made = { ...QUERY, name, question, id: 'q-made', lastRun: null, lastRunAt: null };
      queries.unshift(made);
      return json({ query: made }, 201);
    }
    const query = queries.find((candidate) => path.startsWith(`/queries/${candidate.id as string}`));
    if (query && path === `/queries/${query.id as string}` && method === 'PATCH') {
      Object.assign(query, JSON.parse(init.body as string));
      return json({ query });
    }
    if (query && path === `/queries/${query.id as string}`) {
      return json({ query });
    }
    if (query && path.endsWith('/preflight')) {
      const body = JSON.parse(init.body as string) as { sql: string; parameters: { name: string }[] };
      return json({ preflight: preflightOf(body.sql, body.parameters) });
    }
    if (query && path.startsWith(`/queries/${query.id as string}/runs?`)) {
      return json({ runs: (query.history as unknown[] | undefined) ?? (query.lastRun ? [query.lastRun] : []) });
    }
    if (query && path.endsWith('/requests')) {
      const body = JSON.parse(init.body as string) as { text: string };
      query.request = { state: 'waiting', sentAt: new Date().toISOString(), reads: 4_800_000_000, text: body.text };
      return json({ request: query.request, preflight: preflightOf(query.sql as string) }, 201);
    }
    if (query && path.endsWith('/runs')) {
      const body = JSON.parse(init.body as string) as { sql: string; approve: boolean };
      const checked = preflightOf(body.sql);
      if (checked.range === 'approve' && !body.approve) {
        return json({ error: 'approval_needed', message: 'Approve it.', preflight: checked }, 409);
      }
      return json({ run: { ...RUN, approved: body.approve }, page: PAGE }, 201);
    }
    if (path === '/runs/q-20261027-0b1d2e/rows?page=1') {
      return json({ error: 'expired' }, 410);
    }
    if (path === `/runs/${RUN.ref}/rows?page=1`) {
      return json({ page: PAGE });
    }
    if (path === `/runs/${RUN.ref}/rows?page=2`) {
      return json({ page: { ...PAGE, number: 2, rows: [['2026-08-03', '7']] } });
    }
    if (path === '/me/settings') {
      return json({ settings });
    }
    // catalogue, as it keeps what the User did with the Learning Cards (FR-LR-32); the Chart Server, as it draws See it.
    if (path === '/learning/progress') {
      return json({ progress: learned });
    }
    const progressOn = /^\/learning\/progress\/([^/]+)(\/understood)?$/.exec(path);
    if (progressOn) {
      const card = decodeURIComponent(progressOn[1]!);
      const before = learned.find((entry) => entry.card === card);
      const step = progressOn[2] ? (before?.step ?? 'why') : (JSON.parse(init.body as string) as { step: string }).step;
      const understoodAt = progressOn[2] ? (method === 'PUT' ? '2026-10-29T10:00:00Z' : null) : (before?.understoodAt ?? null);
      const entry = { card, seenAt: before?.seenAt ?? '2026-10-29T10:00:00Z', lastAt: '2026-10-29T10:00:00Z', step, understoodAt };
      if (before) learned.splice(learned.indexOf(before), 1, entry);
      else learned.push(entry);
      return json({ progress: entry });
    }
    if (path === `${CONFIG.semgraphUrl}/render`) {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"><title>Example</title></svg>', { headers: { 'content-type': 'image/svg+xml' } });
    }
    if (path === '/me/groups') {
      return json({ groups: [{ id: 'g1', email: 'data@thenextimmoscoop.be', name: 'Data' }] });
    }
    if (path.startsWith('/me/settings/') && (method === 'PUT' || method === 'DELETE')) {
      return new Response(null, { status: 204 });
    }
    if (path === '/messages/unread') {
      return json({ unread: talk.filter((message) => message.unread).length });
    }
    if (path.startsWith('/messages?')) {
      const kinds = { question: 0, remark: 0, signal: 0, request: 0, dataHub: 0 } as Record<string, number>;
      const on = { collection: 0, resource: 0, lens: 0, query: 0 } as Record<string, number>;
      for (const message of talk) {
        kinds[message.kind as string] = (kinds[message.kind as string] ?? 0) + 1;
        const subject = message.subject as { kind: string };
        on[subject.kind] = (on[subject.kind] ?? 0) + 1;
      }
      return json({ messages: talk, counts: { forYou: talk.length, unread: talk.filter((message) => message.unread).length, written: 0, kinds, on } });
    }
    const onObject = /^\/messages\/on\/(\w+)\/([^/]+)$/.exec(path);
    if (onObject) {
      return json({ messages: talk.filter((message) => (message.subject as { kind: string; id: string }).kind === onObject[1] && (message.subject as { id: string }).id === onObject[2]) });
    }
    if (path === '/messages' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { subjectKind: string; subjectId: string; kind: string; text: string };
      const made = { id: `m-${talk.length + 1}`, type: 'MSG-CNV-01', kind: body.kind, subject: { kind: body.subjectKind, id: body.subjectId, name: 'Weekly lead volume', collection: null, exists: true }, writer: { id: '1', name: 'Max Verstraete', as: null }, params: { text: body.text, writer: 'Max Verstraete' }, state: 'open', createdAt: '2026-10-29T10:00:00Z', lastAt: '2026-10-29T10:00:00Z', replies: [], replyCount: 0, unread: false, mine: true };
      talk.unshift(made);
      return json({ message: made }, 201);
    }
    const message = talk.find((candidate) => path.startsWith(`/messages/${candidate.id as string}`));
    if (message && path === `/messages/${message.id as string}`) {
      return json({ message });
    }
    if (message && path === `/messages/${message.id as string}/read`) {
      message.unread = false;
      return new Response(null, { status: 204 });
    }
    if (message && path === `/messages/${message.id as string}/replies` && method === 'POST') {
      const body = JSON.parse(init.body as string) as { text: string };
      (message.replies as unknown[]).push({ id: 'r-1', type: 'MSG-CNV-04', kind: 'reply', writer: { id: '1', name: 'Max Verstraete', as: 'owner' }, params: { text: body.text }, createdAt: '2026-10-29T10:00:00Z', mine: true });
      message.state = message.state === 'open' ? 'answered' : message.state;
      return json({ message }, 201);
    }
    if (message && path === `/messages/${message.id as string}/decision` && method === 'POST') {
      const body = JSON.parse(init.body as string) as { outcome: string; text: string };
      message.state = body.outcome;
      (message.replies as unknown[]).push({ id: 'd-1', type: 'MSG-CNV-05', kind: 'decision', writer: { id: '1', name: 'Max Verstraete', as: 'dataTeam' }, params: { outcome: body.outcome, text: body.text }, createdAt: '2026-10-29T10:00:00Z', mine: true });
      return json({ message });
    }
    return json({ error: 'not_found' }, 404);
  });
  return calls;
}

/** The address the page opens on. */
function open(path: string): void {
  history.replaceState(null, '', path);
}

beforeEach(() => {
  // The narrowest window, as tokens.css gives it, and a wide window with a light system and no wish for less motion.
  document.documentElement.style.setProperty('--app-min-width', '900px');
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  // Random picks the first of each set: the gradient, which needs no WebGL, and the first photo.
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setLanguage('nl');
  open('/');
});

describe('the web app, signed out', () => {
  it('shows the sign-in, which returns to the page it started from (FR-UM-01)', async () => {
    serve({ signedIn: false });
    open('/query');
    render(App, { config: CONFIG });
    const signIn = await screen.findByRole('link', { name: /Aanmelden met Google/ });
    expect(signIn.getAttribute('href')).toBe('/auth/login?next=%2Fquery');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('names a refused account, and lets the User choose another (FR-UM-02)', async () => {
    serve({ signedIn: false });
    open('/collections#account=max%40gmail.com');
    render(App, { config: CONFIG });
    const again = await screen.findByRole('link', { name: /Aanmelden met een ander account/ });
    expect(again.getAttribute('href')).toBe('/auth/login?next=%2Fcollections&choose=account');
    expect(screen.getByRole('alert').querySelector('b')?.textContent).toBe('max@gmail.com');
    expect(location.hash).toBe('');
  });

  it('explains a sign-in that went wrong', async () => {
    serve({ signedIn: false });
    open('/collections?error=access_denied');
    render(App, { config: CONFIG });
    expect((await screen.findByRole('alert')).textContent).toContain('Enkel actieve accounts van het bedrijf');
    expect(location.search).toBe('');
  });
});

describe('the web app, signed in', () => {
  it('opens on Collections, with the rail and its panel', async () => {
    serve();
    open('/');
    render(App, { config: CONFIG });
    const collections = await screen.findByRole('link', { name: 'Collections' });
    expect(collections.getAttribute('aria-current')).toBe('page');
    expect(location.pathname).toBe('/collections');
    expect(screen.getByRole('complementary', { name: 'Collections' }).inert).toBe(false);
    expect(screen.getByRole('link', { name: 'Mijn pagina' }).textContent).toBe('MV');
    expect(document.title).toBe('Data Hub — Collections');
  });

  it('slides the panel in and out with the item of its section, and remembers it (navigation rule 5)', async () => {
    const calls = serve();
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Collections' }));
    expect(screen.getByRole('complementary', { hidden: true }).inert).toBe(true);
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/panel.open', body: { value: false } });
  });

  it('goes to another section with its panel open', async () => {
    serve({ settings: { 'panel.open': false } });
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Grafieken' }));
    expect(location.pathname).toBe('/charts');
    expect(screen.getByRole('complementary', { name: 'Grafieken' }).inert).toBe(false);
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Grafieken' })).toBeTruthy();
  });

  it('switches between light and dark, and remembers it', async () => {
    const calls = serve();
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('button', { name: 'Wissel tussen licht en donker' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/theme', body: { value: 'dark' } });
  });

  it('opens My page behind the initials, where the language of Data Hub is chosen (DEC-UX-85)', async () => {
    const calls = serve();
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Mijn pagina' }));
    expect(location.pathname).toBe('/me');
    expect(screen.getByRole('heading', { level: 1, name: 'Max Verstraete' })).toBeTruthy();
    expect(await screen.findByText('data@thenextimmoscoop.be')).toBeTruthy();
    expect(screen.queryByRole('complementary', { hidden: true })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/language', body: { value: 'en' } });
  });

  it('keeps a background per theme (DEC-UX-108)', async () => {
    const calls = serve({ settings: { language: 'en' } });
    open('/me/background');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('radio', { name: /Fresh piste/ }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/background.light', body: { value: 'piste' } });
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Fresh piste');
  });

  it('shows one page for what does not exist or may not be seen (DEC-UX-32)', async () => {
    serve();
    open('/collections/secret');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
  });
});

describe('the web app, for the Data Team', () => {
  it('shows the Resources without a Collection on top of the panel of Collections (FR-SR-35, DEC-UX-16)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections');
    render(App, { config: CONFIG });
    const resource = await screen.findByRole('link', { name: /Saved searches/ });
    expect(resource.getAttribute('href')).toBe('/resources/r1');
    expect(screen.getByText('Zonder Collection')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toon wat Zonder Collection bevat' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the page of a waiting Resource: where it came from, its description and its maturity (FR-SR-07, FR-SR-09)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: /Saved searches/ }));
    expect(location.pathname).toBe('/resources/r1');
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Saved searches' })).toBeTruthy();
    expect(main.getByText(SAVED_SEARCHES.key)).toBeTruthy();
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Nog in geen Collection.');
    expect(notice.textContent).toContain('Hij kwam binnen op 21 okt via de exposure datahub_savedSearches in immoscoop_dataplatform_sql.');
    expect(main.getByText('One row per saved search.')).toBeTruthy();
    expect(main.getByText('2 van de 2 kolommen hebben nog geen beschrijving')).toBeTruthy();
    expect(await main.findByText('Geregistreerd via de exposure datahub_savedSearches')).toBeTruthy();
    expect(document.title).toBe('Data Hub — Saved searches');
    expect(screen.getByRole('link', { name: /Saved searches/ }).getAttribute('aria-current')).toBe('page');
  });

  it('shows the page for what may not be seen to anyone else (FR-SR-31, DEC-UX-32)', async () => {
    serve();
    open('/resources/r1');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    expect(screen.queryByText('Zonder Collection')).toBeNull();
  });
});

describe('the web app, with Collections', () => {
  it('lists every Collection the User sees in the panel, All or Yours, each unfolding to its Resources (FR-CO-18, FR-CO-22, DEC-UX-87)', async () => {
    serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    const credit = await panel.findByRole('link', { name: /Credit leads/ });
    expect(credit.getAttribute('href')).toBe('/collections/c1');
    expect(credit.textContent).toContain('1 Resource');
    // Only the Collections of the User say whether they are public or private.
    expect(credit.textContent).toContain('Publiek');
    expect(panel.getByRole('link', { name: /Listings/ }).textContent).not.toContain('Publiek');
    await fireEvent.click(panel.getByRole('button', { name: 'Toon wat Credit leads bevat' }));
    const weekly = panel.getByRole('link', { name: /Weekly lead volume/ });
    expect(weekly.getAttribute('href')).toBe('/resources/r2');
    // Not published: a lighter name, and hover says so.
    expect(weekly.querySelector('[title]')?.getAttribute('title')).toBe('Weekly lead volume · niet gepubliceerd');

    await fireEvent.click(panel.getByRole('radio', { name: 'Van jou' }));
    expect(panel.queryByRole('link', { name: /Listings/ })).toBeNull();
    expect(panel.getByRole('link', { name: /Credit leads/ })).toBeTruthy();
  });

  it('searches the Collections and their Resources together, unfolding where a Resource matches (FR-CO-24)', async () => {
    serve();
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await panel.findByRole('link', { name: /Credit leads/ });
    await fireEvent.input(panel.getByRole('searchbox'), { target: { value: 'weekly' } });
    expect(panel.getByRole('link', { name: /Weekly lead volume/ })).toBeTruthy();
    expect(panel.queryByRole('link', { name: /Listings/ })).toBeNull();
    await fireEvent.input(panel.getByRole('searchbox'), { target: { value: 'nothing like it' } });
    expect(panel.getByText('Niets komt overeen met je zoekopdracht.')).toBeTruthy();
  });

  it('opens on the intro until the User dismisses it, then shows it again on request (Start screen per section)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 2, name: 'Wat zijn Collections?' })).toBeTruthy();
    // Yours, and what changed lately, with who did it.
    expect((await main.findAllByRole('link', { name: /Credit leads/ }))[0]?.textContent).toContain('Van Data');
    expect(main.getByText('Weekly lead volume toegevoegd door Dirk Vos')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Verberg de intro' }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/intro.collections', body: { value: 1 } });
    await fireEvent.click(main.getByRole('button', { name: 'Toon de intro' }));
    expect(calls).toContainEqual({ method: 'DELETE', path: '/me/settings/intro.collections' });
    expect(main.getByRole('heading', { level: 2, name: 'Wat zijn Collections?' })).toBeTruthy();
  });

  it('opens the page of a Collection from the panel: what it is, what needs attention, its Resources and its history (FR-CO-25 to FR-CO-27)', async () => {
    serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await fireEvent.click(await panel.findByRole('link', { name: /Credit leads/ }));
    expect(location.pathname).toBe('/collections/c1');
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Credit leads' })).toBeTruthy();
    expect(main.getByText('Owner: Data')).toBeTruthy();
    expect(main.getByText(/^Aangemaakt op 3 sep\.? door An Claes$/)).toBeTruthy();
    expect(main.getByRole('region', { name: 'Vraagt aandacht' }).textContent).toContain(
      '1 Resource is nog niet gepubliceerd: Weekly lead volume. Tot de Owner hem publiceert, zien enkel Data en het Data Team hem.',
    );
    const row = within(main.getByRole('table', { name: 'Resources' })).getByRole('link', { name: /Weekly lead volume/ }).closest('tr')!;
    expect(row.textContent).toContain('2 · Described');
    expect(row.textContent).toContain('Toegevoegd aan de Collection Credit leads door Dirk Vos');
    expect(main.getByText('Collection aangemaakt door An Claes')).toBeTruthy();
    expect(document.title).toBe('Data Hub — Credit leads');
    // It unfolds in the panel, with an outline.
    expect(panel.getByRole('button', { name: 'Toon wat Credit leads bevat' }).getAttribute('aria-expanded')).toBe('true');
    expect(panel.getByRole('link', { name: /Credit leads/ }).getAttribute('aria-current')).toBe('page');
    // Only the Data Team adds Resources.
    expect(main.queryByRole('button', { name: /Resources toevoegen/ })).toBeNull();
  });

  it('shows a colleague no actions and no Resource that is not published (DEC-CO-12, DEC-CO-15)', async () => {
    serve();
    open('/collections/c2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Listings' })).toBeTruthy();
    expect(main.queryByRole('button', { name: /Bewerken/ })).toBeNull();
    expect(main.queryByRole('region', { name: 'Vraagt aandacht' })).toBeNull();
    expect(main.getByText('Nog geen gepubliceerde Resources in deze Collection.')).toBeTruthy();
  });

  it('makes a Collection on an empty page, with a required icon and one of the groups of the User (FR-CO-12, DEC-CO-25)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await fireEvent.click(panel.getByRole('link', { name: 'Nieuwe Collection' }));
    expect(location.pathname).toBe('/collections/new');
    const main = within(await screen.findByRole('main'));
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Search behaviour' } });
    await fireEvent.input(main.getByRole('textbox', { name: /Beschrijving/ }), { target: { value: 'What visitors search for.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    expect(main.getByText('Kies een icoon: het is het enige wat de Collection onderscheidt.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    await fireEvent.click(await main.findByRole('radio', { name: 'binoculars' }));
    expect((main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement).value).toBe('g1');
    await fireEvent.click(main.getByRole('radio', { name: 'Publiek' }));
    expect(main.getByText('Elke collega ziet de Collection, en de Resources erin zodra ze gepubliceerd zijn.')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/collections/c-new'));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/collections',
      body: { name: 'Search behaviour', description: 'What visitors search for.', icon: 'binoculars', ownerUnit: 'g1', visibility: 'public' },
    });
  });

  it('edits a Collection in place, and sends only what changed (FR-CO-30)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Bewerken/ }));
    expect(main.getByText('Enkel groepen waar je zelf in zit. De Owner Unit staat in voor de Resources van de Collection.')).toBeTruthy();
    // It still holds a Resource, so it cannot be dissolved (FR-CO-10).
    expect((main.getByRole('button', { name: 'Opheffen' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(main.getByRole('textbox', { name: /Beschrijving/ }), { target: { value: 'Every credit lead.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1', body: { description: 'Every credit lead.' } }));
  });
});

describe('the page of a Resource', () => {
  it('shows its Owner what it is, and the actions that come later (FR-SR-24, DEC-UX-90)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' })).toBeTruthy();
    // Query starts a new query on it (FR-SR-46); "Messages" opens the slide-in (FR-CV-07).
    expect(main.getByRole('link', { name: /Query/ }).getAttribute('href')).toBe('/query/new/r2');
    expect(main.getByRole('link', { name: /Berichten/ }).getAttribute('href')).toBe('/resources/r2/messages');
    // For its Owner, while it is not published, "Publish" takes the place of "Ask a question" (DEC-UX-31).
    expect(main.queryByRole('button', { name: /Stel een vraag/ })).toBeNull();
    expect((main.getByRole('button', { name: /Publiceren/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('Enkel Data en het Data Team zien hem. Eens gepubliceerd ziet iedereen die Credit leads ziet hem.');
    expect(main.getByText('One row per week and lead source.')).toBeTruthy();
    expect(main.getByText(/op week_start, een partitie per dag/)).toBeTruthy();
    expect(main.getByText(/Filter eerst op week_start/)).toBeTruthy();
    // Its size and partitions, from BigQuery (FR-SR-39).
    expect(await main.findByText(/312 partities/)).toBeTruthy();
    expect(main.getByText('6,2 GB in totaal, ongeveer 20 MB per dag')).toBeTruthy();
    expect(main.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Overzicht', 'Kolommen', 'Lineage', 'Geschiedenis', 'Voorbeeld']);
  });

  it('previews its newest partitions, chosen by its cluster column, as a query that runs by itself up to 100 MB (FR-SR-38, DEC-SR-39)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('tab', { name: 'Voorbeeld' }));
    // The rows come by themselves: 12 MB is under 100 MB, nothing to approve.
    expect(await main.findByText('2026-10-19')).toBeTruthy();
    expect(main.getByText(/Leest ongeveer 12 MB · 4 partities van 312/)).toBeTruthy();
    expect(main.getByText('q-20261029-preview')).toBeTruthy();
    expect(main.getByText(/^sinds 28 sep\.? 2026$/)).toBeTruthy();
    // No export: under it, the way to Query (DEC-UX-120).
    expect(main.getAllByRole('link', { name: 'Deze Resource bevragen' })[0]?.getAttribute('href')).toBe('/query/new/r2');
    await fireEvent.change(main.getByRole('combobox', { name: /lead_source/ }), { target: { value: 'app' } });
    await vi.waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/preview/runs', body: { window: 4, values: { lead_source: 'app' }, approve: false } }),
    );
    await fireEvent.change(main.getByRole('combobox', { name: /week_start/ }), { target: { value: '1' } });
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/preview/choices', body: { window: 1 } }));
  });

  it('shows its Owner Unit the queries that used it, and no one else (FR-SR-44, DEC-SR-41)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('tab', { name: 'Geschiedenis' }));
    expect(await main.findByText('2 queries gebruikten hem, de laatste 30 dagen')).toBeTruthy();
    const rows = main.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent?.trim()).slice(0, 4))).toEqual([
      ['Leads per source name', 'Query', 'Jij', '3'],
      ['Preview · Weekly lead volume', 'Voorbeeld', 'Karel Peeters', '1'],
    ]);
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/query/q1');
    cleanup();

    // A colleague outside its Owner Unit sees its Preview, not its History.
    serve({ groups: [], weekly: { collectionId: 'c2' } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const other = within(await screen.findByRole('main'));
    await other.findByRole('tab', { name: 'Voorbeeld' });
    expect(other.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Overzicht', 'Kolommen', 'Lineage', 'Voorbeeld']);
  });

  it('lets its Owner edit what Data Hub keeps about it in place, and the fields (FR-RC-15, FR-RC-16)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('button', { name: 'Voeg een Business Description toe' }));
    await fireEvent.input(main.getByRole('textbox', { name: 'Business Description' }), { target: { value: 'The credit leads we send to KBC.' } });
    await fireEvent.input(main.getByRole('textbox', { name: 'Beoogd gebruik' }), { target: { value: 'Weekly trends.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PATCH',
        path: '/resources/r2',
        body: { businessDescription: 'The credit leads we send to KBC.', intendedUse: 'Weekly trends.', pitfalls: '', knownGaps: [''], reliableSince: null, keyFields: [], parameters: [] },
      }),
    );
    expect(await main.findByText('The credit leads we send to KBC.')).toBeTruthy();
    expect(main.getByText('Weekly trends.')).toBeTruthy();

    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    expect(main.getByText('The website, the app or a partner.')).toBeTruthy();
    expect(main.getByText('Partitie')).toBeTruthy();
    expect(main.getByText('Cluster 1')).toBeTruthy();
    // Edit relations is for a Data Admin only (DEC-UX-107).
    expect(main.queryByRole('button', { name: /Relaties bewerken/ })).toBeNull();
    await fireEvent.click(main.getByRole('button', { name: /Bewerken/ }));
    await fireEvent.input(main.getByRole('textbox', { name: 'Business Description · week_start' }), { target: { value: 'The Monday of the week.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() =>
      expect(calls).toContainEqual({ method: 'PUT', path: '/resources/r2/fields', body: { fields: [{ name: 'week_start', businessDescription: 'The Monday of the week.' }] } }),
    );
  });

  it('lets its Owner publish it, its first Confirmation, once the declaration is ticked (FR-SR-49, DEC-UX-63)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('button', { name: /Publiceren/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    expect(sheet.getByText(/het hele bedrijf, want de Collection is publiek/)).toBeTruthy();
    expect(sheet.getByText(/jij mag hem publiceren/)).toBeTruthy();
    const button = sheet.getByRole('button', { name: /Publiceren en bevestigen/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await fireEvent.click(sheet.getByRole('checkbox', { name: /Voor Data bevestig ik dat deze Resource klopt/ }));
    expect(button.disabled).toBe(false);
    await fireEvent.click(button);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/publication' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(main.getByText('Gepubliceerd', { selector: '.chip' })).toBeTruthy();
    expect(main.queryByText('Nog niet gepubliceerd.')).toBeNull();
    expect(main.getAllByText('28 okt 2026 door Max Verstraete')).toHaveLength(2);
  });

  it('warns everyone of a change since its last Confirmation, until its Owner Unit marks it seen (FR-MR-12, DEC-UX-64)', async () => {
    const calls = serve({
      groups: ['g1'],
      weekly: { published: true, level: 3, changes: [{ field: 'week_start', change: 'added', old: null, new: 'DATE', at: '2026-10-27T08:00:00Z' }] },
    });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const warning = await main.findByText(/het veld week_start werd toegevoegd op 27 okt 2026/);
    expect(warning.textContent).toContain('Het Level blijft 3 · Confirmed; de Owner is verwittigd.');
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    expect(main.getByText('Nieuw')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /^Markeer als gezien/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/changes/seen' }));
    await vi.waitFor(() => expect(main.queryByText(/het veld week_start werd toegevoegd/)).toBeNull());
  });

  it('lets its Owner Unit deprecate it once published, with why, and take that away (FR-SR-50, DEC-UX-101)', async () => {
    const calls = serve({ groups: ['g1'], weekly: { published: true, level: 3 } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('button', { name: /Als deprecated markeren/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    const button = sheet.getByRole('button', { name: /Als deprecated markeren/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await fireEvent.input(sheet.getByRole('textbox', { name: 'Waarom hij deprecated is' }), { target: { value: 'Replaced by the figures with partner leads' } });
    await fireEvent.click(button);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/resources/r2/deprecation', body: { reason: 'Replaced by the figures with partner leads', insteadOf: null } }));
    expect(await main.findByText(/door Max Verstraete op 28 okt 2026: Replaced by the figures with partner leads\./)).toBeTruthy();
    expect(main.getByText('Deprecated', { selector: '.chip' })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Wegnemen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/deprecation' }));
    await vi.waitFor(() => expect(main.queryByText(/Replaced by the figures/)).toBeNull());
  });

  it('lets a Data Admin change its grain and relations with Edit relations (DEC-UX-107)', async () => {
    const calls = serve({ roles: ['datateam'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    await fireEvent.click(main.getByRole('button', { name: /Relaties bewerken/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Grain en relaties van Weekly lead volume' }));
    await fireEvent.click(await sheet.findByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        path: '/resources/r2/details',
        body: expect.objectContaining({ partition: { field: 'week_start', unit: 'day' }, clusterBy: ['lead_source'], mappings: [] }),
      }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('walks its lineage one step at a time, the Resource in the middle (FR-SR-54, DEC-UX-100)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Lineage' }));
    const upstream = await main.findByRole('button', { name: /int_leads/ });
    expect(main.getByText('lead_share')).toBeTruthy();
    // Only its direct models at first; a click adds what is next to it, a column further out.
    expect(main.queryByText('stg_leads')).toBeNull();
    await fireEvent.click(upstream);
    expect(upstream.getAttribute('aria-expanded')).toBe('true');
    expect(main.getByText('stg_leads')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Terug naar zijn directe modellen/ }));
    expect(main.queryByText('stg_leads')).toBeNull();
  });
});

describe('the web app, for the Data Team, with Collections', () => {
  it('hands a Collection to any group of the domain (FR-CO-35)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Bewerken/ }));
    const owner = main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement;
    await vi.waitFor(() => expect([...owner.options].map((option) => option.value)).toEqual(['g1', 'g2']));
    expect(main.getByText(/Elke groep van het domein/)).toBeTruthy();
  });

  it('adds Resources without a Collection from the page of a Collection, in a sheet of two steps (FR-CO-31, FR-CO-33, FR-CO-34)', async () => {
    const calls = serve({ roles: ['datateam'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click((await main.findAllByRole('button', { name: /Resources toevoegen/ }))[0]!);
    const sheet = within(screen.getByRole('dialog', { name: 'Resources toevoegen aan Credit leads' }));
    expect(sheet.getByText(/^Kwam binnen op 21 okt\.? via de exposure datahub_savedSearches$/)).toBeTruthy();
    const next = sheet.getByRole('button', { name: /Volgende: grain en relaties/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await fireEvent.click(sheet.getByRole('checkbox'));
    await fireEvent.click(next);

    // Step 2: what dbt and the Domain Model propose, each with where it came from.
    const second = within(await screen.findByRole('dialog', { name: 'Grain en relaties van 1 Resource' }));
    expect(await second.findByText(/versie 0\.0\.70, zoals het op prod draait/)).toBeTruthy();
    expect(await second.findByText('Uit een dbt-test')).toBeTruthy();
    const mapping = second.getByRole('combobox', { name: 'Mapping van search_id' }) as HTMLSelectElement;
    expect(mapping.value).toBe('is');
    expect((second.getByRole('combobox', { name: 'Entity-identiteit van search_id' }) as HTMLInputElement).value).toBe('search.searchId');
    expect(second.getByText('Voorgesteld op basis van de naam')).toBeTruthy();
    expect(second.getByText('Eén rij per search: de grain is dit veld')).toBeTruthy();
    // A field mapped by hand, with an Entity the Domain Model does not have yet (DEC-CO-21).
    await fireEvent.change(second.getByRole('combobox', { name: 'Mapping van filters' }), { target: { value: 'occurredWithin' } });
    const identity = second.getByRole('combobox', { name: 'Entity-identiteit van filters' });
    expect((second.getByRole('button', { name: '1 Resource toevoegen' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(identity, { target: { value: 'filter.filterId' } });
    expect(second.getByText(/zit nog niet in het Domain Model/)).toBeTruthy();
    await fireEvent.input(second.getByRole('textbox', { name: 'Wat één rij is, in woorden' }), { target: { value: 'saved search' } });
    await fireEvent.click(second.getByRole('button', { name: '1 Resource toevoegen' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/collections/c1/resources',
      body: {
        resources: [
          {
            id: 'r1',
            partition: null,
            clusterBy: [],
            partitionFilter: 'none',
            grain: ['search_id'],
            grainSentence: 'saved search',
            modelType: null,
            origins: { grain: 'test', grainSentence: 'here' },
            release: '0.0.70',
            mappings: [
              { field: 'search_id', kind: 'is', relationType: null, identity: 'search.searchId', subject: null, origin: 'name', inDomainModel: true },
              { field: 'filters', kind: 'relation', relationType: 'occurredWithin', identity: 'filter.filterId', subject: 'search_id', origin: 'here', inDomainModel: false },
            ],
          },
        ],
      },
    });
  });
});

describe('Query', () => {
  it('opens the last query of the User, listed in the panel by the day of its last run (FR-SR-43, DEC-UX-74)', async () => {
    serve({ queries: [{ ...QUERY, lastRunAt: new Date().toISOString() }] });
    open('/query');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // The page of a query loads its editor the first time it opens.
    expect(await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 })).toBeTruthy();
    expect(location.pathname).toBe('/query/q1');
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    expect(panel.getByText('Vandaag')).toBeTruthy();
    expect(panel.getByRole('link', { name: /Leads per source name/ }).getAttribute('aria-current')).toBe('page');
    expect(panel.getByText(/Weekly lead volume · 1 keer/)).toBeTruthy();
    // It reads only its Resources; another set is a new query, and the Lenses on them come later (DEC-UX-73, DEC-UX-114).
    expect(main.getByText('Leest enkel')).toBeTruthy();
    expect(main.getByRole('link', { name: /Weekly lead volume/ }).getAttribute('href')).toBe('/resources/r2');
    // Its author makes it a Lens (DEC-UX-25).
    expect(main.getByRole('link', { name: 'Maak er een Lens van' }).getAttribute('href')).toBe('/query/q1/lens');
  });

  it('starts a new query on a Resource, named from it and the date, as not run yet (FR-SR-45, FR-SR-46, DEC-UX-114)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/query/new/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const name = (await main.findByRole('textbox', { name: /Naam/ })) as HTMLInputElement;
    await vi.waitFor(() => expect(name.value).toMatch(/^Weekly lead volume, \d+ /));
    expect(await main.findByText('Nog geen Lens gebruikt deze Resources.', {}, { timeout: 3000 })).toBeTruthy();
    expect(within(screen.getByRole('complementary', { name: 'Query' })).getByText('Nieuw · nog niet uitgevoerd')).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: /Wat wil je weten/ }), { target: { value: 'Which sources bring our leads?' } });
    await fireEvent.click(main.getByRole('button', { name: 'Begin je eigen' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls).toContainEqual({ method: 'POST', path: '/queries', body: { name: name.value, question: 'Which sources bring our leads?', resources: ['r2'] } });
  });

  it('says what the SQL reads before it runs, and shows its result with its Query ID, 100 rows a page (FR-SR-36, FR-SR-51, FR-LN-06)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const run = await main.findByRole('button', { name: /Uitvoeren\s*80 MB/ }, { timeout: 3000 });
    await vi.waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    expect(main.getByText(/4 partities/)).toBeTruthy();
    await fireEvent.click(run);
    expect(await main.findByRole('grid', { name: 'Resultaat van uitvoering 1' })).toBeTruthy();
    expect(main.getByText('q-20261029-4c2e1a')).toBeTruthy();
    expect(main.getByText('210 rijen')).toBeTruthy();
    expect(main.getByText('null')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/runs', body: { sql: QUERY.sql, parameters: [], approve: false } });
    await fireEvent.click(main.getByRole('button', { name: 'Volgende pagina' }));
    await vi.waitFor(() => expect(main.getByText('2026-08-03')).toBeTruthy());
  });

  it('asks to approve a query above 100 MB, in red, by running it (DEC-SR-29, DEC-UX-28)', async () => {
    const calls = serve({ queries: [{ ...QUERY, sql: `${QUERY.sql}-- all weeks\n` }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const run = await main.findByRole('button', { name: /Goedkeuren en uitvoeren\s*840 MB/ }, { timeout: 3000 });
    await vi.waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(run);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/runs', body: { sql: `${QUERY.sql}-- all weeks\n`, parameters: [], approve: true } }));
  });

  it('names a table outside its Resources, and warns without a partition filter, with the filter to add (DEC-UX-73, FR-SR-40)', async () => {
    const outside = 'select * from `immoscoop-dataplatform-398214.dbt_prod_stacks.partner_contracts` where x = 1';
    serve({ queries: [{ ...QUERY, sql: outside }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // Next to its Resources and in the bar, in place of the Pre-flight.
    await vi.waitFor(() => expect(main.getAllByText(/is geen van de Resources van deze query/)).toHaveLength(2), { timeout: 3000 });
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens a new query for a User who has none yet', async () => {
    serve();
    open('/query');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Nieuwe query' })).toBeTruthy();
    expect(location.pathname).toBe('/query/new');
  });

  it('shows the Data Team the query of a colleague to read, not to run, with everyone’s queries under All (DEC-LN-01)', async () => {
    const calls = serve({ roles: ['datateam'], queries: [{ ...QUERY, mine: false, ownerName: 'An Claes', lastRun: RUN, lastRunAt: RUN.startedAt }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Een query van An Claes: je leest hem, enkel An Claes schrijft en voert hem uit.')).toBeTruthy();
    expect(main.queryByRole('button', { name: /Uitvoeren/ })).toBeNull();
    expect(main.queryByRole('button', { name: 'Opmaken' })).toBeNull();
    expect(main.getByText(/Uitgevoerd door Max Verstraete als q-20261029-4c2e1a/)).toBeTruthy();
    expect(calls.some((call) => call.path.endsWith('/preflight'))).toBe(false);
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    await fireEvent.click(panel.getByRole('radio', { name: 'Alle' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'GET', path: '/queries?all=true' }));
  });

  it('lets who made a query change its name and question in place; a name stays required (DEC-UX-119, FR-SR-45)', async () => {
    const preview = { ...QUERY, id: 'q-preview', kind: 'preview', name: 'Preview · Weekly lead volume', question: '' };
    const calls = serve({ queries: [{ ...QUERY }, preview] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // A preview of a Resource is a query of the User, marked so in the panel.
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    expect(within(await panel.findByRole('link', { name: /Preview · Weekly lead volume/ })).getByText('Voorbeeld')).toBeTruthy();
    await fireEvent.click(await main.findByRole('button', { name: 'Leads per source name' }, { timeout: 3000 }));
    const name = main.getByRole('textbox', { name: 'Naam' }) as HTMLInputElement;
    await fireEvent.input(name, { target: { value: '  ' } });
    expect((main.getByRole('button', { name: 'Bewaren' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(name, { target: { value: 'Leads per source' } });
    await fireEvent.input(main.getByRole('textbox', { name: /Wat wil je weten/ }), { target: { value: 'Where do our leads come from?' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    expect(await main.findByRole('heading', { level: 1, name: 'Leads per source' })).toBeTruthy();
    expect(main.getByText('Where do our leads come from?')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PATCH', path: '/queries/q1', body: { name: 'Leads per source', question: 'Where do our leads come from?' } });
  });

  it('adds the partition filter it offers, and checks the SQL again (DEC-SR-35)', async () => {
    const plain = 'select week_start from `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`';
    const calls = serve({ queries: [{ ...QUERY, sql: plain }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Zonder filter op week_start leest hij heel Weekly lead volume; met een filter op de recente partities hoogstens 82 MB.', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Voeg de filter toe' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: { sql: `${plain} where week_start >= '2026-10-01'`, parameters: [] } }), { timeout: 3000 });
  });

  const withParameters = 'select week_start\nfrom `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`\nwhere week_start >= @dateFrom and lead_source = @leadChannel\n';
  const dateFrom = { name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' };

  it('defines an @name of the SQL as a Parameter, its kind suggested, and checks the SQL with it (DEC-UX-71, DEC-UX-117, DEC-UX-118)', async () => {
    const calls = serve({ queries: [{ ...QUERY, sql: withParameters, parameters: [dateFrom] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // A suggested function says what it gives today, worked out by Data Hub itself.
    expect(await main.findByText(/vandaag 1 jan/)).toBeTruthy();
    expect(await main.findByText('@leadChannel staat in de query, maar is geen Parameter.', {}, { timeout: 3000 })).toBeTruthy();
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(main.getByRole('button', { name: 'Definieer hem' }));
    const window = within(await screen.findByRole('dialog', { name: '@leadChannel definiëren' }));
    expect(window.getByRole('radio', { name: /Keuze/ }).getAttribute('aria-checked')).toBe('true');
    await fireEvent.input(window.getByRole('textbox', { name: 'De lijst' }), { target: { value: 'Form\nPhone\nForm' } });
    await fireEvent.click(window.getByRole('button', { name: 'Toevoegen' }));
    const leadChannel = { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] };
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: { sql: withParameters, parameters: [dateFrom, leadChannel] } }), { timeout: 3000 });
    await vi.waitFor(() => expect((main.getByRole('button', { name: /Uitvoeren\s*80 MB/ }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
  });

  it('shows its history, previews a run read only, and applies it to the query (DEC-UX-74, DEC-UX-99)', async () => {
    const first = { ...RUN, ref: 'q-20261027-0b1d2e', number: 1, sql: withParameters, parameters: [dateFrom, { name: 'leadChannel', kind: 'choice', value: 'Phone', list: ['Form', 'Phone'] }], startedAt: '2026-10-27T09:14:00Z' };
    const second = { ...RUN, number: 2 };
    const calls = serve({ queries: [{ ...QUERY, lastRun: second, lastRunAt: second.startedAt, runs: 2, history: [second, first] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // The query that is open unfolds in the panel to its last runs.
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    expect((await panel.findByRole('link', { name: /Uitvoering 1/ })).getAttribute('href')).toBe('/query/q1/runs/1');
    await fireEvent.click(await main.findByRole('radio', { name: 'Geschiedenis · 2 uitvoeringen' }));
    expect(await main.findByText('Nu getoond')).toBeTruthy();
    expect(main.getByText(/een nieuwe query op Weekly lead volume/)).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Bekijken' }));
    // Its result is no longer kept: it runs again as a new run, or its SQL and values are applied.
    expect(await main.findByText(/Uitvoering 1 bekijken/)).toBeTruthy();
    expect(await main.findByRole('button', { name: /Opnieuw uitvoeren/ })).toBeTruthy();
    expect(main.getByText(/met @dateFrom 1 jan\.? 2026, @leadChannel Phone/)).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Overnemen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: { sql: withParameters, parameters: first.parameters } }), { timeout: 3000 });
  });

  it('sends a query above 1 GB to the Data Team, and says since when it waits (DEC-UX-116, MSG-QRY-01)', async () => {
    const calls = serve({ queries: [{ ...QUERY, sql: `${QUERY.sql}-- every year\n` }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const send = await main.findByRole('button', { name: /Naar het Data Team sturen\s*4,8 GB/ }, { timeout: 3000 });
    await vi.waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(send);
    expect(main.getByText(/iemand van het Data Team aanvaardt hem eerst/)).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: /Een woordje voor het Data Team/ }), { target: { value: 'For the five-year review.' } });
    await fireEvent.click(main.getByRole('button', { name: /Versturen/ }));
    expect(await main.findByText(/Wacht op het Data Team sinds \d\d:\d\d/)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/requests', body: { sql: `${QUERY.sql}-- every year\n`, parameters: [], text: 'For the five-year review.' } });
    expect(await within(screen.getByRole('complementary', { name: 'Query' })).findByText('Naar het Data Team')).toBeTruthy();
  });

  it('starts a new query without one of its Resources, taking the SQL and Parameters along (DEC-UX-73)', async () => {
    const sources = { ...QUERY.resources[0], id: 'r9', key: 'immoscoop-dataplatform-398214.dbt_prod_leads.lead_sources', displayName: 'Lead sources', partition: null };
    const calls = serve({ queries: [{ ...QUERY, resources: [QUERY.resources[0], sources], parameters: [dateFrom] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: 'Lead sources weghalen' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Zonder Lead sources' }));
    const name = sheet.getByRole('textbox', { name: /Naam/ }) as HTMLInputElement;
    expect(name.value).toMatch(/^Weekly lead volume, \d+ /);
    expect(await sheet.findByText('Nog geen Lens gebruikt deze Resources.', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: /De nieuwe query starten/ }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/queries',
      body: { name: name.value, question: QUERY.question, resources: ['r2'], sql: QUERY.sql, parameters: [dateFrom], startedFrom: 'q1' },
    });
  });
});

describe('Lenses', () => {
  it('makes a Lens of a query, with what it does step by step, into a Collection its author owns (FR-LE-07, FR-LE-08, DEC-UX-121)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY, sql: `${QUERY.sql} where 1 = 1`, parameters: [{ name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' }] }] });
    open('/query/q1/lens');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Maak er een Lens van' })).toBeTruthy();
    expect((await main.findByRole('textbox', { name: 'Naam' }) as HTMLInputElement).value).toBe('Leads per source name');
    // The Parameters come from the query, each with the name Users see; its default stands as its function (DEC-UX-75).
    expect(((await main.findByRole('textbox', { name: 'Naam die Users zien van @dateFrom' })) as HTMLInputElement).value).toBe('Date from');
    expect(main.getByText('Begin van dit jaar')).toBeTruthy();
    // Within range: its author publishes it (FR-LE-08).
    expect(await main.findByText('Binnen de grenzen.')).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: /Wat hij doet, stap voor stap/ }), { target: { value: 'Takes the weekly lead volume.\n\nAdds the sources.' } });
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam die Users zien van @dateFrom' }), { target: { value: 'From' } });
    const tag = main.getByRole('textbox', { name: 'Een tag toevoegen' });
    await fireEvent.input(tag, { target: { value: '#Leads' } });
    await fireEvent.keyDown(tag, { key: 'Enter' });
    await fireEvent.click(main.getByRole('button', { name: 'Lens publiceren' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/lenses/l-made'));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/lenses',
      body: {
        queryId: 'q1',
        collectionId: 'c1',
        name: 'Leads per source name',
        question: QUERY.question,
        shows: '',
        steps: ['Takes the weekly lead volume.', 'Adds the sources.'],
        tags: ['leads'],
        labels: { dateFrom: 'From' },
        approve: false,
        text: '',
      },
    });
  });

  it('runs a Lens only when its User runs it, with the values they chose, and marks a result for old values (FR-LE-12, DEC-LE-12)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: /Leads per source, week by week/ })).toBeTruthy();
    // Under Collections, its Collection unfolded and the Lens marked as open (DEC-UX-66).
    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect((await panel.findByRole('link', { name: /Leads per source, week by week/ })).getAttribute('aria-current')).toBe('page');
    // It does not run when it opens.
    expect(main.getByText('Nog niet uitgevoerd.')).toBeTruthy();
    expect(calls.some((call) => call.path === '/lenses/l1/runs')).toBe(false);
    await fireEvent.change(main.getByRole('combobox', { name: 'De waarde van Lead channel' }), { target: { value: 'Phone' } });
    expect(main.getByText('Standaard: Form')).toBeTruthy();
    const run = await main.findByRole('button', { name: /Uitvoeren/ });
    await vi.waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(run);
    expect(await main.findByText('q-20261029-1e2a3b')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/lenses/l1/runs', body: { values: { dateFrom: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', leadChannel: 'Phone' }, approve: false } });
    await fireEvent.click(main.getByRole('button', { name: 'Standaard' }));
    expect(await main.findByText('De Parameters veranderden.')).toBeTruthy();
    // About tells what it does as its author wrote it, never its SQL (FR-LE-14, DEC-UX-121).
    await fireEvent.click(main.getByRole('tab', { name: 'Over' }));
    expect(main.getByText('Keeps one lead channel.')).toBeTruthy();
    expect(main.getByText('Geschreven door wie hem maakte, in gewone taal.')).toBeTruthy();
    expect(main.queryByText(/select/)).toBeNull();
  });

  it('lists the Lenses of a Collection on its page and in the panel (FR-CO-28, FR-CO-36)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const table = within(await main.findByRole('table', { name: 'Lenses' }));
    expect(table.getByRole('link', { name: /Leads per source, week by week/ }).getAttribute('href')).toBe('/lenses/l1');
    expect(table.getByText('Max Verstraete')).toBeTruthy();
    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect(panel.getByRole('link', { name: /Leads per source, week by week/ }).getAttribute('href')).toBe('/lenses/l1');
  });

  it('shows a Broken Lens with what it misses, Run off and no result, and a red dot where it is listed (FR-LE-17, DEC-UX-81)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS, broken: { kind: 'column', name: 'lead_channel', since: '2026-10-28T05:17:00Z' } }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Deze Lens kan niet draaien.')).toBeTruthy();
    expect(main.getByText('Broken')).toBeTruthy();
    expect(main.getByText(/Hij leest de kolom lead_channel, die sinds 28 okt\.? 2026 niet meer bestaat/)).toBeTruthy();
    // Its last result is not shown; Run is off and nothing is checked (DEC-UX-81).
    expect(main.getByText('Kan niet draaien.')).toBeTruthy();
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(main.getByRole('button', { name: 'Open zijn query' })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(calls.some((call) => call.path === '/lenses/l1/preflight')).toBe(false);
    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect(panel.getByRole('img', { name: 'Lens · Broken: de kolom lead_channel bestaat niet meer' })).toBeTruthy();
  });

  it('stops a Lens when a run with its defaults grows past 1 GB, in amber, Run off (DEC-LE-11, DEC-LE-19, DEC-UX-125)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS, grows: true }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // The Pre-flight with its defaults finds it grew: the page reads the Lens again.
    expect(await main.findByText('Deze Lens is gestopt.', {}, { timeout: 3000 })).toBeTruthy();
    expect(main.getByText(/Eén run met zijn standaardwaarden leest 1,4 GB, sinds 29 okt\.? 2026/)).toBeTruthy();
    expect(main.getByText('Gestopt.')).toBeTruthy();
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(main.getByRole('tab', { name: 'Over' }));
    expect(main.getByText('Gestopt: één run met zijn standaardwaarden las 1,4 GB')).toBeTruthy();
  });

  it('opens the query of a Lens for its Owner Unit, and edits what it tells, never its SQL (DEC-LE-18, FR-LE-06)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY }], lenses: [{ ...LENS }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('link', { name: 'Bewerken' }));
    const edit = within(await screen.findByRole('main'));
    expect(await edit.findByRole('heading', { level: 1, name: 'De Lens bewerken' })).toBeTruthy();
    const shows = (await edit.findByRole('textbox', { name: 'Wat hij toont' })) as HTMLTextAreaElement;
    await vi.waitFor(() => expect(shows.value).toBe(LENS.shows));
    expect(edit.getByRole('combobox', { name: 'Collection' }).matches(':disabled')).toBe(true);
    await fireEvent.input(shows, { target: { value: 'Leads per source, a row a week.' } });
    await fireEvent.click(edit.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/lenses/l1'));
    expect(calls.find((call) => call.method === 'PATCH' && call.path === '/lenses/l1')?.body).toMatchObject({ shows: 'Leads per source, a row a week.', labels: { dateFrom: 'From', leadChannel: 'Lead channel' } });

    await fireEvent.click(await within(await screen.findByRole('main')).findByRole('button', { name: 'Openen in Query' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q1'));
    expect(calls).toContainEqual({ method: 'POST', path: '/lenses/l1/query' });
  });

  it('updates a Lens from the query used as it, after its size check (FR-LE-16, DEC-UX-77)', async () => {
    const used = { id: 'l1', name: LENS.name, collectionId: 'c1', state: 'published', createdAt: LENS.createdAt, version: 1, range: 'free', reads: 80_000_000 };
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY, sql: `${QUERY.sql} where 1 = 1`, lens: used }], lenses: [{ ...LENS }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const update = await main.findByRole('button', { name: 'De Lens bijwerken' });
    expect(main.queryByRole('link', { name: 'Maak er een Lens van' })).toBeNull();
    expect(main.queryByRole('button', { name: /Lenses op deze Resources/ })).toBeNull();
    expect(main.getByText(/overschrijft hem met deze query/)).toBeTruthy();
    await fireEvent.click(update);
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText('Wat hij vervangt')).toBeTruthy();
    expect(await sheet.findByText('80 MB per run, binnen het bereik:', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: 'De Lens bijwerken' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/lenses/l1'));
    expect(calls).toContainEqual({ method: 'PUT', path: '/lenses/l1/version', body: { queryId: 'q1', approve: false, text: '' } });
  });

  it('starts a new Lens from its Collection with a query that remembers it (DEC-UX-123)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const links = await main.findAllByRole('link', { name: 'Nieuwe Lens' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/query/new/for/c1', '/query/new/for/c1']);

    await fireEvent.click(links[0] as HTMLElement);
    const start = within(await screen.findByRole('main'));
    await fireEvent.click(await start.findByRole('button', { name: 'Een Resource toevoegen' }));
    await fireEvent.click(await start.findByRole('button', { name: /Weekly lead volume/ }));
    await fireEvent.click(start.getByRole('button', { name: 'Begin je eigen' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls.find((call) => call.method === 'POST' && call.path === '/queries')?.body).toMatchObject({ resources: ['r2'], forCollection: 'c1' });
  });

  it('offers a new query the Lenses on its Resources, to use before writing one (FR-SR-47, FR-SR-48, DEC-UX-22)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }, { ...LENS, id: 'l-waiting', name: 'Every lead since 2019', state: 'waiting' }] });
    open('/query/new/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.input(await main.findByRole('textbox', { name: /Wat wil je weten/ }), { target: { value: 'How many come in each week?' } });
    const offered = within(await main.findByRole('article', { name: 'Leads per source, week by week' }, { timeout: 3000 }));
    // The word it shares is marked; the best match says so (DEC-UX-23).
    await vi.waitFor(() => expect(offered.getByText('week', { selector: 'mark' })).toBeTruthy());
    expect(offered.getByText('Beste overeenkomst')).toBeTruthy();
    expect(offered.getByText('1 woord gemeen')).toBeTruthy();
    expect(offered.getByText('Credit leads · door Max Verstraete')).toBeTruthy();
    expect(offered.getByRole('link', { name: 'Gebruik deze Lens' }).getAttribute('href')).toBe('/lenses/l1');
    expect(main.getByText('Op precies deze Resource')).toBeTruthy();
    // A Lens that waits for the Data Team is not offered (DEC-SR-43).
    expect(main.queryByRole('article', { name: 'Every lead since 2019' })).toBeNull();
    expect(calls.some((call) => call.path.startsWith('/lenses/suggestions?resources=r2&question=How+many'))).toBe(true);
  });

  it('shows the Lenses on the Resources of a query in a sheet, while writing it (DEC-UX-73)', async () => {
    serve({ groups: ['g1'], queries: [{ ...QUERY }], lenses: [{ ...LENS }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const button = await main.findByRole('button', { name: /Lenses op deze Resources · 1/ });
    await vi.waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(button);
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText('Terwijl je je query schrijft')).toBeTruthy();
    expect(sheet.getByRole('link', { name: 'Gebruik deze Lens' }).getAttribute('href')).toBe('/lenses/l1');
  });

  it('shows the Lenses of the User under Yours, and new Lenses of others, on the start screen (FR-CO-37, DEC-UX-126)', async () => {
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
    serve({
      groups: ['g1'],
      settings: { 'intro.collections': 1 },
      lenses: [
        { ...LENS, lastRunAt: new Date(Date.now() - 120_000).toISOString() },
        { ...LENS, id: 'l-broken', name: 'Response time and conversion', broken: { kind: 'column', name: 'first_reply_at', since: recent } },
        { ...LENS, id: 'l-new', name: 'Listings per region', collectionId: 'c2', mine: false, authorName: 'Ruth Aerts', publishedAt: recent },
        { ...LENS, id: 'l-old', name: 'Listings per year', collectionId: 'c2', mine: false, authorName: 'Ruth Aerts', publishedAt: '2026-01-01T08:00:00Z' },
      ],
    });
    open('/collections');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const ran = await main.findByRole('link', { name: /Leads per source, week by week/ });
    expect(within(ran).getByText(/Door jou uitgevoerd/)).toBeTruthy();
    const broken = main.getByRole('link', { name: /Response time and conversion/ });
    expect(within(broken).getByText('first_reply_at bestaat niet meer')).toBeTruthy();
    expect(main.getByText('1 Resource · 2 Lenses')).toBeTruthy();
    // New: published in the last 30 days in a public Collection of another group.
    expect(main.getByRole('heading', { level: 2, name: 'Nieuwe Lenses' })).toBeTruthy();
    expect(within(main.getByRole('link', { name: /Listings per region/ })).getByText(/gepubliceerd door Ruth Aerts/)).toBeTruthy();
    expect(main.queryByRole('link', { name: /Listings per year/ })).toBeNull();
  });

  it('searches Lenses, Resources and Collections by the words of a question on the start screen (FR-CO-37, DEC-UX-127)', async () => {
    const calls = serve({ groups: ['g1'], settings: { 'intro.collections': 1 }, lenses: [{ ...LENS }] });
    open('/collections');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 2, name: 'Van jou' })).toBeTruthy();
    const field = main.getByRole('searchbox', { name: 'Zoek in Collections, Resources en Lenses' });
    await fireEvent.input(field, { target: { value: 'Which sources bring the most leads?' } });
    await fireEvent.submit(main.getByRole('search'));
    // In place of the sections: Lenses, then Resources, then Collections, the shared words marked.
    const lens = within(await main.findByRole('article', { name: 'Leads per source, week by week' }));
    expect(lens.getByText('Beste overeenkomst')).toBeTruthy();
    expect(lens.getByRole('link', { name: 'Gebruik deze Lens' }).getAttribute('href')).toBe('/lenses/l1');
    const resources = within(main.getByRole('table', { name: 'Resources' }));
    expect(resources.getByRole('link', { name: /Weekly lead volume/ }).getAttribute('href')).toBe('/resources/r2');
    expect(resources.getByText('lead', { selector: 'mark' })).toBeTruthy();
    expect(main.getByRole('link', { name: /Credit leads/ }).getAttribute('href')).toBe('/collections/c1');
    expect(main.queryByRole('heading', { level: 2, name: 'Van jou' })).toBeNull();
    expect(calls).toContainEqual({ method: 'GET', path: '/search?question=Which+sources+bring+the+most+leads%3F' });
    // Clear goes back to the start screen.
    await fireEvent.click(main.getByRole('button', { name: 'Wissen' }));
    expect(main.getByRole('heading', { level: 2, name: 'Van jou' })).toBeTruthy();
    // Nothing found says so, with "New query".
    await fireEvent.input(field, { target: { value: 'How do agencies rate their brokers?' } });
    await fireEvent.submit(main.getByRole('search'));
    expect(await main.findByText('Niets deelt een woord met je vraag.')).toBeTruthy();
    expect(main.getByRole('link', { name: 'Nieuwe query' }).getAttribute('href')).toBe('/query/new');
  });

  it('opens a Lens that waits for the Data Team as its author made it, frozen (FR-LE-09, DEC-LE-05)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS, state: 'waiting', range: 'request', reads: 6_200_000_000, request: { state: 'waiting', sentAt: new Date().toISOString(), reads: 6_200_000_000, text: '' } }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText(/Naar het Data Team gestuurd door Max Verstraete/)).toBeTruthy();
    expect(main.getByText('Tot ze hem aanvaarden, zie alleen jij de Lens, en wijzigt niemand hem.')).toBeTruthy();
    expect(main.getByRole('textbox', { name: 'Naam' }).matches(':disabled')).toBe(true);
    expect(main.queryByRole('button', { name: /Uitvoeren/ })).toBeNull();
  });
});

describe('Messages', () => {
  it('counts what moved for the User in the rail, and lists it in the Message Centre (FR-CV-06)', async () => {
    const calls = serve({ groups: ['g1'], conversations: [QUESTION, DESCRIBED] });
    open('/messages');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('link', { name: 'Berichten, 1 ongelezen' })).toBeTruthy();
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Voor jou' })).toBeTruthy();
    // A person's words, and the first line of what Data Hub tells, from the Message Catalogue (FR-CV-15).
    expect(await main.findByText('Will KBC follow-up be published this month?')).toBeTruthy();
    expect(main.getByText('Eén beschrijving van Weekly lead volume is gewijzigd in dbt. Je businessbeschrijvingen blijven zoals ze zijn, en er wordt niets van je gevraagd.')).toBeTruthy();
    expect(main.getByRole('img', { name: 'Ongelezen' })).toBeTruthy();
    // The panel filters on the views, the kinds and the kinds of object.
    const panel = within(screen.getByRole('navigation', { name: 'Berichten' }));
    expect(panel.getByRole('button', { name: /Voor jou/ }).getAttribute('aria-current')).toBe('true');
    await fireEvent.click(panel.getByRole('button', { name: /Questions/ }));
    await vi.waitFor(() => expect(calls.some((call) => call.path === '/messages?view=forYou&kind=question')).toBe(true));

    // Opened, it is read, and it takes a reply that tells its writer (FR-CV-09).
    await fireEvent.click(main.getByRole('link', { name: /Will KBC follow-up/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/read' }));
    expect(await main.findByRole('link', { name: /Openen in context/ })).toBeTruthy();
    expect(main.getByRole('link', { name: /Openen in context/ }).getAttribute('href')).toBe('/collections/c1/messages/m1');
    await fireEvent.input(main.getByRole('textbox', { name: 'Je antwoord' }), { target: { value: 'Yes, next week.' } });
    await fireEvent.click(main.getByRole('button', { name: /Antwoorden/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/replies', body: { text: 'Yes, next week.' } }));
    expect(await main.findByText('Yes, next week.')).toBeTruthy();
  });

  it('shows what Data Hub tells laid out, with the way to its object (FR-CV-15)', async () => {
    serve({ groups: ['g1'], conversations: [DESCRIBED] });
    open('/messages/m2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Eén beschrijving van Weekly lead volume is gewijzigd in dbt', { selector: 'b' })).toBeTruthy();
    expect(main.getByText('lead_count', { selector: 'code' })).toBeTruthy();
    expect(main.getByText('Number of leads', { selector: 'del' })).toBeTruthy();
    // It asks nothing, so it takes no reply.
    expect(main.queryByRole('textbox', { name: 'Je antwoord' })).toBeNull();
  });

  it('carries the Learning Card that explains it, which opens inline (FR-LR-38, DEC-UX-79)', async () => {
    const calls = serve({ groups: ['g1'], conversations: [DESCRIBED] });
    open('/messages/m2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Begrijp wat hier gebeurt')).toBeTruthy();
    const card = main.getByRole('button', { name: /K3\.4\s*Waar definities leven/ });
    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(card.textContent).toContain('Nog niet gezien');
    await fireEvent.click(card);
    expect((await main.findByText('woordenlijst', { selector: 'b' })).parentElement?.textContent).toMatch(/^De woordenlijst legt een begrip uit/);
    expect(main.getByRole('link', { name: /Open de hele kaart/ }).getAttribute('href')).toBe('/learning/K3.4');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/K3.4', body: { step: 'core' } }));
    await fireEvent.click(main.getByRole('button', { name: /Ik heb het begrepen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/K3.4/understood' }));
    expect(main.getByRole('button', { name: /K3\.4/ }).textContent).toContain('Begrepen');
  });

  it('lets the Data Team decide on a Request, a refusal with a reason (FR-CV-08)', async () => {
    const calls = serve({ roles: ['datateam'], conversations: [REQUEST] });
    open('/messages/m3');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('For the five-year review.')).toBeTruthy();
    expect(main.getByText('4,8 GB')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Weigeren/ }));
    expect(await main.findByText('Een weigering heeft een reden nodig.')).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: 'Je beslissing' }), { target: { value: 'Once, for the review.' } });
    await fireEvent.click(main.getByRole('button', { name: /Aanvaarden/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m3/decision', body: { outcome: 'accepted', text: 'Once, for the review.' } }));
    expect(await main.findByText('Aanvaard', { selector: '.reply .state' })).toBeTruthy();
  });

  it('opens the Messages on a Resource in a slide-in, to write a Question, Remark or Signal (FR-CV-07)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2/messages');
    render(App, { config: CONFIG });
    const sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    expect(sheet.getByText('Berichten op deze Resource')).toBeTruthy();
    expect(sheet.getAllByRole('radio').map((radio) => radio.textContent?.trim())).toEqual(['Question', 'Remark', 'Signal', 'Alle 0', 'Questions 0', 'Remarks 0', 'Signals 0']);
    await fireEvent.click(sheet.getByRole('radio', { name: 'Signal' }));
    expect(sheet.getByText('Data en het Data Team krijgen een melding.')).toBeTruthy();
    await fireEvent.input(sheet.getByRole('textbox', { name: 'Nieuw bericht' }), { target: { value: 'Zero partner leads last week.' } });
    await fireEvent.click(sheet.getByRole('button', { name: /Plaatsen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages', body: { subjectKind: 'resource', subjectId: 'r2', kind: 'signal', text: 'Zero partner leads last week.' } }));
  });

  it('opens a Message in context: its object as it is, with the Message in a floating window (FR-CV-09)', async () => {
    serve({ groups: ['g1'], conversations: [QUESTION] });
    open('/collections/c1/messages/m1');
    render(App, { config: CONFIG });
    const window = within(await screen.findByRole('dialog', { name: 'Credit leads' }));
    expect(await window.findByText('Will KBC follow-up be published this month?')).toBeTruthy();
    expect(window.getByText('Question op deze Collection')).toBeTruthy();
    expect(window.getByRole('link', { name: /Het bericht op deze Collection/ }).getAttribute('href')).toBe('/collections/c1/messages');
    // The page stays behind it, usable.
    expect(await within(screen.getByRole('main')).findByRole('heading', { level: 1, name: 'Credit leads' })).toBeTruthy();
  });
});

describe('the Learning Centre', () => {
  it('opens on top of the rail with its intro, the card to continue, what is suggested and the path through the Levels (DEC-LR-27, FR-LR-32)', async () => {
    serve({ learned: [{ card: '1.2.2', seenAt: '2026-10-28T09:00:00Z', lastAt: '2026-10-28T09:00:00Z', step: 'see', understoodAt: null }] });
    open('/learning');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 2, name: 'Wat is het Learning Centre?' })).toBeTruthy();
    expect(main.getByRole('link', { name: /Begin met het Compass/ }).getAttribute('href')).toBe('/learning/K3.4');
    expect(await main.findByRole('heading', { level: 2, name: 'Verder lezen' })).toBeTruthy();
    expect(main.getByText('Voorgesteld · Toepassen · je stopte bij Zie het')).toBeTruthy();
    expect(main.getByText('Compass, 1 · User, nog niet begrepen')).toBeTruthy();
    expect(main.getAllByRole('link', { name: /Waar definities leven/ })[0]?.getAttribute('href')).toBe('/learning/K3.4');
    expect(main.getAllByText('1 van 34 gezien').length).toBeGreaterThan(0);
    const panel = within(screen.getByRole('complementary', { name: 'Learning Centre' }));
    expect(panel.getByText(/Je zag 1 van \d+ kaarten/)).toBeTruthy();
    expect(document.title).toBe('Data Hub — Learning Centre');
  });

  it('lists every card in the panel, the ones to be written without a page (FR-LR-03)', async () => {
    serve();
    open('/learning');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Learning Centre' }));
    await fireEvent.click(panel.getByRole('button', { name: /1 · User/ }));
    expect(panel.getByRole('link', { name: /Unieke tellingen tel je niet op/ }).getAttribute('href')).toBe('/learning/1.2.2');
    expect(panel.getAllByTitle('Nog te schrijven')[0]?.textContent).toContain('1.1.1');
  });

  it('opens a card in five steps, keeps each step it opens, and lets the User say they understand it (FR-LR-27, FR-LR-28)', async () => {
    const calls = serve();
    open('/learning/K3.4');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: /Waar definities leven/ })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['1 Waarom nu', '2 Kernidee', '3 Zie het', '4 Check je begrip', '5 Je kan nu']);
    expect(document.title).toBe('Data Hub — K3.4 Waar definities leven');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/K3.4', body: { step: 'why' } }));
    await fireEvent.click(screen.getByRole('button', { name: /^Volgende/ }));
    expect(screen.getByRole('tab', { name: /Kernidee/ }).getAttribute('aria-selected')).toBe('true');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/K3.4', body: { step: 'core' } }));
    // The quick path skips See it and Check your understanding.
    await fireEvent.click(screen.getByRole('button', { name: 'Snel' }));
    expect(screen.getByText('Volgende: Je kan nu')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Ik heb het begrepen/ }));
    expect(screen.getByRole('tab', { name: /Je kan nu/ }).getAttribute('aria-selected')).toBe('true');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/K3.4/understood' }));
    expect(screen.getByRole('button', { name: /Begrepen/ }).getAttribute('title')).toBe('Begrepen · klik om ongedaan te maken');
    expect(screen.getByRole('link', { name: /Messages/ }).getAttribute('href')).toBe('/learning/K3.4/messages');
    expect(screen.queryByRole('navigation', { name: 'Volgende' })).toBeNull();
  });

  it('opens a card where the User stopped, until they understand it (FR-LR-32)', async () => {
    serve({ learned: [{ card: '1.2.2', seenAt: '2026-10-28T09:00:00Z', lastAt: '2026-10-28T09:00:00Z', step: 'see', understoodAt: null }] });
    open('/learning/1.2.2');
    render(App, { config: CONFIG });
    expect((await screen.findByRole('tab', { name: /Zie het/ })).getAttribute('aria-selected')).toBe('true');
  });

  it('asks one question at a time, and shows the answer and why without a score (FR-LR-30)', async () => {
    serve();
    open('/learning/K3.4');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('tab', { name: /Check je begrip/ }));
    expect(await screen.findByRole('heading', { level: 2, name: /Waar kijk je\?/ })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /In de woordenlijst/ }));
    expect(screen.getByRole('status').textContent).toMatch(/^De woordenlijst legt uit/);
    expect(screen.getByRole('button', { name: /In de woordenlijst/ }).textContent).toContain('Jouw antwoord');
    expect(screen.getByRole('button', { name: /In de officiële definitie/ }).textContent).toContain('Het antwoord');
    await fireEvent.click(screen.getByRole('button', { name: /Nog een vraag/ }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the example of See it as the Chart Server draws it (FR-LR-29, DEC-LR-26)', async () => {
    const calls = serve();
    open('/learning/1.2.2/see');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: /Zie het/ })).toBeTruthy();
    const picture = await screen.findByAltText(/3.700 meer in de eerste staaf/);
    expect(picture.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(calls.find((call) => call.path.endsWith('/render'))?.body).toMatchObject({ theme: 'light', size: 'default' });
    expect(screen.getByRole('link', { name: /Open de hele kaart/ }).getAttribute('href')).toBe('/learning/1.2.2');
  });

  it('takes a Question or a Remark on a card, for the Data Team (FR-LR-06)', async () => {
    serve();
    open('/learning/K3.4/messages');
    render(App, { config: CONFIG });
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText('Learning Card · Compass')).toBeTruthy();
    expect(sheet.queryByRole('radio', { name: /Signaal|Signal/ })).toBeNull();
  });
});

describe('the markers of the Learning Centre', () => {
  const details = { ...WEEKLY_DETAIL.details, grain: ['week_start', 'lead_source'], modelType: 'aggregate' };

  it('explain the grain of a Resource with its written cards, and open one in a floating window over the page (FR-LR-12, FR-LR-35, FR-LR-36)', async () => {
    const calls = serve({ weekly: { details }, learned: [{ card: '1.2.2', seenAt: '2026-10-26T09:00:00Z', lastAt: '2026-10-26T09:00:00Z', step: 'see', understoodAt: null }] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const grain = await screen.findByRole('button', { name: /^grain: week_start × lead_source/ });
    expect(grain.textContent).toContain('ⓘ');
    expect(grain.getAttribute('aria-haspopup')).toBe('dialog');
    await fireEvent.keyDown(grain, { key: 'Enter' });
    const pop = within(screen.getByRole('dialog', { name: 'Uitgelegd in 3 Learning Cards' }));
    expect(pop.getAllByRole('button').map((item) => item.textContent?.slice(0, 5))).toEqual(['2.3.5', '1.2.2', '1.2.1']);
    expect(await pop.findByText(/^Gezien/)).toBeTruthy();
    expect(pop.getAllByText('Nog niet gezien')).toHaveLength(2);
    expect(pop.getAllByRole('link', { name: /Zie het/ })[0]?.getAttribute('href')).toBe('/learning/2.3.5/see');
    await fireEvent.click(pop.getByRole('button', { name: /^2\.3\.5/ }));
    const window = within(await screen.findByRole('dialog', { name: /^2\.3\.5 De grain-vraag/ }));
    expect(window.getByRole('tab', { name: 'Waarom nu' }).getAttribute('aria-selected')).toBe('true');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/learning/progress/2.3.5', body: { step: 'why' } }));
    await fireEvent.click(window.getByRole('button', { name: /^Volgende/ }));
    expect(window.getByRole('tab', { name: 'Kernidee' }).getAttribute('aria-selected')).toBe('true');
    expect(window.getByRole('link', { name: /Open in het Learning Centre/ }).getAttribute('href')).toBe('/learning/2.3.5');
    expect(location.pathname).toBe('/resources/r2');
  });

  it('explain the Level with K5.2 and the model type with 2.3.6 (DEC-LR-30, FR-LR-39)', async () => {
    serve({ weekly: { details } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    await fireEvent.keyDown(await screen.findByRole('button', { name: /2 · Described.*uitgelegd/ }), { key: 'Enter' });
    const items = within(screen.getByRole('dialog', { name: 'Uitgelegd in 2 Learning Cards' })).getAllByRole('button');
    expect(items.map((item) => item.textContent)).toEqual([expect.stringMatching(/^K5\.2Het Level van een Resource/), expect.stringMatching(/^3\.3\.3/)]);
    await fireEvent.keyDown(screen.getByRole('button', { name: /2 · Described.*uitgelegd/ }), { key: 'Escape' });
    await fireEvent.keyDown(screen.getByRole('button', { name: /^modeltype: aggregate/ }), { key: 'Enter' });
    expect(within(screen.getByRole('dialog', { name: 'Uitgelegd in 1 Learning Card' })).getByRole('button', { name: /^2\.3\.6/ })).toBeTruthy();
  });
});
