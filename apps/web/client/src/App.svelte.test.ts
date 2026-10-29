import { fireEvent, render, screen, within } from '@testing-library/svelte';
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
} = {}): Saved[] {
  const calls: Saved[] = [];
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
    // query, as it keeps the queries of the User and checks and runs their SQL (TR-SR-15 to TR-SR-17).
    if (path === '/queries' && method === 'GET') {
      return json({
        queries: queries.map(({ id, name, ownerName, resources: on, lastRunAt, createdAt, request }) => ({ id, name, ownerName, resources: on, lastRunAt, createdAt, runs: lastRunAt ? 1 : 0, request: request ?? null })),
      });
    }
    if (path === '/queries' && method === 'POST') {
      const { name, question } = JSON.parse(init.body as string) as { name: string; question: string };
      const made = { ...QUERY, name, question, id: 'q-made', lastRun: null, lastRunAt: null };
      queries.unshift(made);
      return json({ query: made }, 201);
    }
    const query = queries.find((candidate) => path.startsWith(`/queries/${candidate.id as string}`));
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
    if (path === '/me/groups') {
      return json({ groups: [{ id: 'g1', email: 'data@thenextimmoscoop.be', name: 'Data' }] });
    }
    if (path.startsWith('/me/settings/') && (method === 'PUT' || method === 'DELETE')) {
      return new Response(null, { status: 204 });
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
    // Query starts a new query on it (FR-SR-46); the Messages come with part 7.
    expect(main.getByRole('link', { name: /Query/ }).getAttribute('href')).toBe('/query/new/r2');
    for (const name of ['Berichten']) {
      expect((main.getByRole('button', { name: new RegExp(name) }) as HTMLButtonElement).disabled).toBe(true);
    }
    // For its Owner, while it is not published, "Publish" takes the place of "Ask a question" (DEC-UX-31).
    expect(main.queryByRole('button', { name: /Stel een vraag/ })).toBeNull();
    expect((main.getByRole('button', { name: /Publiceren/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('Enkel Data en het Data Team zien hem. Eens gepubliceerd ziet iedereen die Credit leads ziet hem.');
    expect(main.getByText('One row per week and lead source.')).toBeTruthy();
    expect(main.getByText('op week_start, een partitie per dag')).toBeTruthy();
    expect(main.getByText(/Filter eerst op week_start/)).toBeTruthy();
    expect(main.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Overzicht', 'Kolommen', 'Lineage', 'Geschiedenis', 'Voorbeeld']);
    await fireEvent.click(main.getByRole('tab', { name: 'Voorbeeld' }));
    expect(main.getByText('Dit tabblad wordt nog gebouwd.')).toBeTruthy();
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
    await fireEvent.click(main.getByRole('button', { name: 'Markeer als gezien' }));
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
    // It reads only its Resources; another set, the Lenses and making it a Lens come later (DEC-UX-73, DEC-UX-114).
    expect(main.getByText('Leest enkel')).toBeTruthy();
    expect(main.getByRole('link', { name: /Weekly lead volume/ }).getAttribute('href')).toBe('/resources/r2');
    expect((main.getByRole('button', { name: 'Maak er een Lens van' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts a new query on a Resource, named from it and the date, as not run yet (FR-SR-45, FR-SR-46, DEC-UX-114)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/query/new/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const name = (await main.findByRole('textbox', { name: /Naam/ })) as HTMLInputElement;
    await vi.waitFor(() => expect(name.value).toMatch(/^Weekly lead volume, \d+ /));
    expect(main.getByText('Nog geen Lens gebruikt deze Resources.')).toBeTruthy();
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
    expect(sheet.getByText('Nog geen Lens gebruikt deze Resources.')).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: /De nieuwe query starten/ }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/queries',
      body: { name: name.value, question: QUERY.question, resources: ['r2'], sql: QUERY.sql, parameters: [dateFrom], startedFrom: 'q1' },
    });
  });
});
