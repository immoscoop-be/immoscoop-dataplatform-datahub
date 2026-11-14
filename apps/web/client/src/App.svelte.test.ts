import { formatBigQuery } from '@datahub/ui/components/sqlFormat.js';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PERMISSIONS, STARTING_GROUPS, type Permissions, type StartingGroup } from '@datahub/contracts/permissions';
import App from './App.svelte';
import type { Config } from './lib/config.js';

const CONFIG: Config = {
  identityUrl: 'https://identity.test',
  catalogueUrl: 'https://catalogue.test',
  registryUrl: 'https://registry.test',
  queryUrl: 'https://query.test',
  semgraphUrl: 'https://semgraph.test',
};

/** The why of a Known Gap, in its form (FR-RC-24). */
const WHY = 'Wat ontbreekt of maar deels aanwezig is, en waarom · gewone tekst';

const ME = { sub: '1', email: 'max@thenextimmoscoop.be', name: 'Max Verstraete', groups: [] as string[] };

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

/** What semgraph offers, as its overview gives it in Dutch: four charts, and two it only plans (FR-CH-06). */
const SEMGRAPH_CHARTS = {
  locale: 'nl-BE',
  semgraphs: [
    { id: 'distribution', title: 'Verdeling', answers: 'Hoe liggen de waarden verspreid?' },
    { id: 'kpiTile', title: 'KPI-tegel', answers: 'Hoeveel is het nu, en is dat meer of minder dan ervoor?' },
    { id: 'periodComparison', title: 'Vergelijking met de vorige periode', answers: 'Doen we het beter of slechter dan in de periode ervoor?' },
    { id: 'movingWindowAverage', title: 'Voortschrijdend gemiddelde', answers: 'Hoe evolueert dit, zonder dagelijkse ruis?' },
  ].map((chart) => ({ ...chart, href: `/semgraphs/${chart.id}`, examples: [] })),
  planned: ['cumulative', 'funnel'],
};

/** Two charts as semgraph describes them, each with examples that it draws, with a warning or a caution, or refuses. */
const SEMGRAPH_DESCRIBED: Record<string, Record<string, unknown>> = {
  movingWindowAverage: {
    id: 'movingWindowAverage',
    title: 'Voortschrijdend gemiddelde',
    answers: 'Hoe evolueert dit, zonder dagelijkse ruis?',
    exampleQuestions: ['Hoe evolueerden de kredietleads de voorbije vier weken?'],
    doNotUseWhen: [
      { intent: 'compareWithLastYear', use: 'periodComparison' },
      { intent: 'showTotalSoFar', use: 'cumulative' },
    ],
    data: { minimumPoints: 28 },
    examples: [
      { name: 'basic', title: 'Kredietleads per dag (voorbeelddata)' },
      { name: 'long-horizon', title: 'Kredietleads per dag, laatste anderhalf jaar (voorbeelddata)' },
      { name: 'long-horizon-dark', title: 'Kredietleads per dag, laatste anderhalf jaar (voorbeelddata)', theme: 'dark' },
      { name: 'window-10', title: 'Kredietleads per dag (voorbeelddata)' },
      { name: 'unique-without-aggregation', title: 'Unieke bezoekers per dag (voorbeelddata)' },
    ],
  },
  kpiTile: {
    id: 'kpiTile',
    title: 'KPI-tegel',
    answers: 'Hoeveel is het nu, en is dat meer of minder dan ervoor?',
    exampleQuestions: [],
    doNotUseWhen: [],
    data: { minimumPoints: 14 },
    examples: [
      { name: 'few-leads', title: 'Leads' },
      { name: 'rolling-28d-card', title: 'Leads', size: 'card' },
    ],
  },
};

/** Groups of Data Hub, as the Owner Unit of a Collection: named, without an address (FR-UM-12). */
const DATA = { id: 'g1', name: 'Data', email: null };
const SALES = { id: 'g2', name: 'Sales', email: null };

/** A Group as identity lists it: by default one the User is in, managing itself (FR-UM-18). */
function summaryOf(group: { id: string; name: string }, more: Record<string, unknown> = {}) {
  return { id: group.id, name: group.name, sentence: '', managedBy: { id: group.id, name: group.name, isMember: true }, memberCount: 1, isMember: true, mayChange: true, ...more };
}

/** A Collection of the group Data, with one Resource in it that is not published yet. */
const CREDIT = {
  id: 'c1',
  name: 'Credit leads',
  description: 'The credit leads Immoscoop sends to KBC.',
  intro: '',
  icon: 'coins',
  ownerUnit: DATA,
  visibility: 'public',
  createdAt: '2026-09-03T08:00:00Z',
  createdBy: 'An Claes',
  canManage: true,
  resources: [{ id: 'r2', key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume', displayName: 'Weekly lead volume', level: 2, published: false, deprecated: false, withdrawn: false, folderId: null as string | null }],
  folders: [] as { id: string; name: string; parentId: string | null; createdBy: string; createdAt: string }[],
  lensFolders: {} as Record<string, string>,
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
/** The Source Job of dbt-prod in uat, as the configuration of the environment sets it (FR-AR-18). */
const SOURCE_JOB_TILE = {
  projectId: '9367',
  projectName: 'immoscoop_dataplatform_sql',
  job: { id: '322951', name: 'daily UAT build', environmentName: 'UAT', kind: 'scheduled', generatesDocs: true },
  setBy: null as string | null,
  setAt: null as string | null,
  lastSet: { runId: '58101536', status: 'processed', receivedAt: '2026-10-31T06:05:00Z', processedAt: '2026-10-31T06:07:00Z' },
  dbtCloud: true,
};

/** The jobs of dbt-prod in dbt Cloud: a CI job and a job of Production cannot be its Source Job in uat. */
const DBT_JOBS = [
  { id: '322951', name: 'daily UAT build', projectId: '9367', environmentId: '1', environmentName: 'UAT', kind: 'scheduled', generatesDocs: true, lastRun: { at: '2026-10-31T06:00:00Z', status: 'Success' }, current: true, notChoosable: null },
  { id: '352118', name: 'UAT - Deploy - Merge build', projectId: '9367', environmentId: '1', environmentName: 'UAT', kind: 'merge', generatesDocs: true, lastRun: { at: '2026-10-31T09:50:00Z', status: 'Success' }, current: false, notChoosable: null },
  { id: '324451', name: 'CI/CD - UAT - triggered by Github Pipelines', projectId: '9367', environmentId: '1', environmentName: 'UAT', kind: 'ci', generatesDocs: false, lastRun: null, current: false, notChoosable: 'ci' },
  { id: '351870', name: 'UAT - Hourly freshness', projectId: '9367', environmentId: '1', environmentName: 'UAT', kind: 'scheduled', generatesDocs: false, lastRun: null, current: false, notChoosable: 'noDocs' },
  { id: '324502', name: 'CI/CD - prod - triggered by Github Pipelines', projectId: '9367', environmentId: '2', environmentName: 'Production', kind: 'merge', generatesDocs: true, lastRun: null, current: false, notChoosable: 'otherEnvironment' },
];

/** A delivery of the webhook, as registry keeps it (FR-AR-19). */
const DELIVERY = {
  eventType: 'job.run.completed',
  webhookName: 'Data Hub uat',
  accountId: '576',
  projectId: '9367',
  environmentName: 'UAT',
  runStartedAt: null,
  runFinishedAt: null,
};

/** The deliveries of the last 30 days, the newest first: failed, ignored, refused and recorded. */
const DELIVERIES = [
  { ...DELIVERY, id: '4', receivedAt: '2026-10-31T09:20:00Z', outcome: 'recorded', reason: null, jobId: '322951', jobName: 'daily UAT build', runId: '58141207', runStatus: 'Success', set: { status: 'failed', error: 'The run has no catalog.json.', processedAt: null, current: false }, sourceJob: true },
  { ...DELIVERY, id: '3', receivedAt: '2026-10-31T09:10:00Z', outcome: 'ignored', reason: 'notSourceJob', jobId: '324451', jobName: 'CI/CD - UAT - triggered by Github Pipelines', runId: '58212208', runStatus: 'Success', set: null, sourceJob: false },
  { ...DELIVERY, id: '2', receivedAt: '2026-10-31T08:58:00Z', outcome: 'refused', reason: 'signature', eventType: null, webhookName: null, accountId: null, projectId: null, environmentName: null, jobId: null, jobName: null, runId: null, runStatus: null, set: null, sourceJob: false },
  { ...DELIVERY, id: '1', receivedAt: '2026-10-31T06:05:00Z', outcome: 'recorded', reason: null, jobId: '322951', jobName: 'daily UAT build', runId: '58101536', runStatus: 'Success', set: { status: 'processed', error: null, processedAt: '2026-10-31T06:07:00Z', current: true }, sourceJob: true },
];

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
  // In the house layout, as a query opens (DEC-UX-233).
  sql: 'select\n    week_start,\n    lead_source\nfrom\n    `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`\nwhere\n    week_start >= date_sub(current_date(), interval 28 day)',
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

/** Types at the end of the SQL editor, as a User does: CodeMirror reads the change from its own text. */
async function typeInEditor(editor: HTMLElement, text: string): Promise<void> {
  const lines = editor.querySelectorAll('.cm-line');
  const last = lines[lines.length - 1] as HTMLElement;
  last.appendChild(document.createTextNode(text));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * The Pre-flight query gives: an @name that is not a Parameter, 4.8 GB or 840 MB for SQL that says so, a
 * table outside, or 80 MB.
 */
function preflightOf(sql: string, parameters: { name: string }[] = []) {
  const base = {
    partitions: 4,
    problems: [] as unknown[],
    warnings: [] as unknown[],
    thresholds: { approve: 100_000_000, request: 1_000_000_000 },
    unused: [] as string[],
    // The columns of its result, as the dry run says them (FR-LE-19).
    columns: [{ name: 'week_start', type: 'DATE' }, { name: 'leads', type: 'INT64' }, { name: 'share', type: 'FLOAT64' }],
  };
  const at = sql.indexOf('@leadChannel');
  if (at >= 0 && !parameters.some((parameter) => parameter.name === 'leadChannel')) {
    return { ...base, runnable: false, bytes: null, range: null, partitions: null, problems: [{ kind: 'undefinedParameter', name: 'leadChannel', start: at, end: at + 12, suggestedKind: 'choice' }] };
  }
  if (sql.includes('-- every year')) return { ...base, runnable: true, bytes: 4_800_000_000, range: 'request' };
  // A power user's query reads a table Data Hub knows that is no Resource (FR-SR-56).
  if (sql.includes('stg_oltp__leads')) {
    const key = 'immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads';
    const columns = [{ name: 'lead_id', dataType: 'STRING', description: 'Id of the lead.' }, { name: 'created_date', dataType: 'DATE', description: 'Day it came in.' }];
    return { ...base, runnable: true, bytes: 80_000_000, range: 'free', tables: [{ key, fullName: key, name: 'stg_oltp__leads', layer: 'staging', columns, partition: { field: 'created_date', unit: 'day' } }] };
  }
  if (sql.includes('partner_contracts')) {
    const start = sql.indexOf('`immoscoop-dataplatform-398214.dbt_prod_stacks.partner_contracts`');
    return { ...base, runnable: false, bytes: null, range: null, partitions: null, problems: [{ kind: 'outside', name: 'immoscoop-dataplatform-398214.dbt_prod_stacks.partner_contracts', start, end: start + 66 }] };
  }
  if (!sql.includes('where')) {
    return { ...base, runnable: true, bytes: 900_000_000, range: 'approve', warnings: [{ kind: 'noPartitionFilter', resource: { id: 'r2', displayName: 'Weekly lead volume' }, column: 'week_start', fix: `${sql} where week_start >= '2026-10-01'`, bytesWithFilter: 82_000_000 }] };
  }
  return sql.includes('-- all weeks') ? { ...base, runnable: true, bytes: 840_000_000, range: 'approve' } : { ...base, runnable: true, bytes: 80_000_000, range: 'free' };
}

/** The Users of the environment, as identity lists them to Admin (FR-PL-06). */
const HOUR = 3_600_000;
const MAX_USER = {
  googleId: '1',
  email: 'max@thenextimmoscoop.be',
  name: 'Max Verstraete',
  permissionGroup: { id: 'pg-admin', name: 'Admin' },
  groups: [{ id: 'g1', name: 'Data' }],
  createdAt: '2026-10-17T08:00:00Z',
  lastLoginAt: new Date(Date.now() - HOUR).toISOString(),
  uses: { web: true, claude: true, excel: false },
  active: true,
};
const AN_USER = {
  googleId: '2',
  email: 'an.claes@immoscoop.be',
  name: 'An Claes',
  permissionGroup: { id: 'pg-lensUser', name: 'Lens user' },
  groups: [
    { id: 'g2', name: 'Sales' },
    { id: 'g9', name: 'Marketing' },
  ],
  createdAt: '2026-09-02T08:00:00Z',
  lastLoginAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  uses: { web: true, claude: true, excel: true },
  active: true,
};
const ELIF_USER = {
  googleId: '3',
  email: 'elif.yilmaz@immoscoop.be',
  name: 'Elif Yilmaz',
  permissionGroup: { id: 'pg-lensUser', name: 'Lens user' },
  groups: [],
  createdAt: new Date(Date.now() - 20 * HOUR).toISOString(),
  lastLoginAt: new Date(Date.now() - 20 * HOUR).toISOString(),
  uses: { web: true, claude: false, excel: false },
  active: true,
};
const BRAM_USER = {
  googleId: '4',
  email: 'bram.desmet@immoscoop.be',
  name: 'Bram De Smet',
  permissionGroup: { id: 'pg-businessAnalyst', name: 'Business analyst' },
  groups: [],
  createdAt: '2026-06-01T08:00:00Z',
  lastLoginAt: '2026-09-14T08:00:00Z',
  uses: { web: false, claude: false, excel: false },
  active: false,
};
const USERS = [MAX_USER, AN_USER, ELIF_USER, BRAM_USER];

/** The Permission groups to start with, as identity keeps them (DEC-PL-07): Lens user the default. */
function startingGroups() {
  return (['admin', 'businessAnalyst', 'lensUser'] as const).map((id) => ({
    id: `pg-${id}`,
    name: STARTING_GROUPS[id].name,
    sentence: STARTING_GROUPS[id].sentence,
    permissions: structuredClone(STARTING_GROUPS[id].permissions),
    isDefault: id === 'lensUser',
    locked: id === 'admin',
    users: 0,
    updatedAt: '2026-11-06T08:00:00Z',
    updatedBy: id === 'admin' ? null : 'Ruth Aerts',
  }));
}

/** A colleague who signed in, as identity knows them. */
const PEOPLE = [
  { email: 'an.claes@immoscoop.be', name: 'An Claes' },
  { email: 'elif.yilmaz@immoscoop.be', name: 'Elif Yilmaz' },
  { email: 'jonas.peeters@immoscoop.be', name: 'Jonas Peeters' },
  { email: 'karel.leys@immoscoop.be', name: 'Karel Leys' },
];

/**
 * The Groups of Data Hub as identity keeps them, as Max sees them, changed by what the page asks (FR-UM-12 to
 * FR-UM-18): Max is in Sales management, which manages Broker team; he is only in Marketing, which Marketing leads
 * manages; with Manage every group he changes every Group.
 */
function groupWorld({ every = false } = {}) {
  const me = ME.email;
  const at = '2026-11-10T09:00:00Z';
  const MAX = { id: '1', name: 'Max Verstraete' };
  const member = (email: string, name: string | null, more: Record<string, unknown> = {}) => ({ email, name, signedIn: name !== null, active: true, addedAt: at, addedBy: MAX, ...more });
  type Kept = { id: string; name: string; sentence: string; managedBy: string; members: ReturnType<typeof member>[]; log: Record<string, unknown>[] };
  let kept: Kept[] = [
    {
      id: 'g-br',
      name: 'Broker team',
      sentence: 'The advisors who look after our brokers',
      managedBy: 'g-sm',
      members: [member('bram.desmet@immoscoop.be', 'Bram De Smet', { active: false }), member('elif.yilmaz@immoscoop.be', 'Elif Yilmaz'), member('karel.leys@immoscoop.be', 'Karel Leys')],
      log: [
        { at, kind: 'added', by: MAX, detail: { email: 'karel.leys@immoscoop.be' } },
        { at, kind: 'added', by: MAX, detail: { email: 'elif.yilmaz@immoscoop.be' } },
        { at, kind: 'made', by: MAX, detail: { name: 'Broker team', managedBy: 'g-sm' } },
      ],
    },
    { id: 'g-mk', name: 'Marketing', sentence: 'Campaigns, the website and its visitors', managedBy: 'g-ml', members: [member('an.claes@immoscoop.be', 'An Claes'), member('jonas.peeters@immoscoop.be', 'Jonas Peeters'), member(me, 'Max Verstraete')], log: [] },
    { id: 'g-ml', name: 'Marketing leads', sentence: '', managedBy: 'g-ml', members: [member('an.claes@immoscoop.be', 'An Claes'), member('jonas.peeters@immoscoop.be', 'Jonas Peeters')], log: [] },
    { id: 'g-sm', name: 'Sales management', sentence: 'Who leads sales', managedBy: 'g-sm', members: [member(me, 'Max Verstraete'), member('an.claes@immoscoop.be', 'An Claes')], log: [] },
  ];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const isIn = (group: Kept) => group.members.some((one) => one.email === me);
  const summary = (group: Kept) => {
    const manager = kept.find((one) => one.id === group.managedBy) ?? group;
    return { id: group.id, name: group.name, sentence: group.sentence, managedBy: { id: manager.id, name: manager.name, isMember: isIn(manager) }, memberCount: group.members.length, isMember: isIn(group), mayChange: every || isIn(manager) };
  };
  const detail = (group: Kept) => ({
    ...summary(group),
    members: group.members,
    manages: kept.filter((one) => one.managedBy === group.id && one.id !== group.id).map(({ id, name }) => ({ id, name })),
    createdAt: at,
    createdBy: MAX,
    log: group.log,
  });
  const logged = (group: Kept, kind: string, detail: Record<string, unknown>) => group.log.unshift({ at: new Date().toISOString(), kind, by: MAX, detail });
  return (method: string, path: string, body: Record<string, string> | undefined, owns: (id: string) => { id: string; name: string }[]): Response | undefined => {
    if (path === '/me/groups') return json({ groups: kept.filter((one) => isIn(one) || summary(one).managedBy.isMember).map(summary) });
    if (path === '/groups' && method === 'GET') return every ? json({ groups: kept.map(summary) }) : json({ error: 'forbidden', permission: 'groups.all.manage' }, 403);
    if (path === '/groups' && method === 'POST' && body) {
      if (kept.some((one) => one.name.toLowerCase() === body.name!.toLowerCase())) return json({ error: 'name_taken' }, 409);
      const made: Kept = { id: 'g-new', name: body.name!, sentence: body.sentence ?? '', managedBy: body.managedBy === 'itself' ? 'g-new' : body.managedBy!, members: [member(me, 'Max Verstraete')], log: [] };
      kept = [...kept, made];
      logged(made, 'made', { name: made.name, managedBy: made.managedBy });
      logged(made, 'added', { email: me });
      return json({ group: detail(made) }, 201);
    }
    if (path.startsWith('/people?')) {
      const q = (new URLSearchParams(path.split('?')[1]).get('q') ?? '').toLowerCase();
      return json({ people: PEOPLE.filter((one) => one.name.toLowerCase().includes(q) || one.email.includes(q)) });
    }
    const [, id, members, email] = /^\/groups\/([^/]+)(\/members(?:\/([^/]+))?)?$/.exec(path) ?? [];
    const group = kept.find((one) => one.id === id);
    if (!id) return undefined;
    if (!group) return json({ error: 'not_found' }, 404);
    if (method !== 'GET' && !summary(group).mayChange) return json({ error: 'forbidden', managedBy: summary(group).managedBy }, 403);
    if (!members && method === 'GET') return json({ group: detail(group) });
    if (!members && method === 'PATCH' && body) {
      if (body.name) [group.name, group.log] = [body.name, [{ at, kind: 'renamed', by: MAX, detail: { from: group.name, to: body.name } }, ...group.log]];
      if (body.managedBy) {
        const to = body.managedBy === 'itself' ? group.id : body.managedBy;
        logged(group, 'managedBy', { from: summary(group).managedBy.name, to: kept.find((one) => one.id === to)?.name, toId: to });
        group.managedBy = to;
      }
      return json({ group: detail(group) });
    }
    if (!members && method === 'DELETE') {
      const manages = detail(group).manages.map((one) => one.name);
      const collections = owns(group.id).map((one) => one.name);
      if (manages.length || collections.length) return json({ error: 'still_owns', manages, collections: { count: collections.length, names: collections } }, 409);
      kept = kept.filter((one) => one !== group);
      return new Response(null, { status: 204 });
    }
    if (members && method === 'PUT' && body) {
      if (!/@(thenext)?immoscoop\.be$/.test(body.email!)) return json({ error: 'invalid_email' }, 400);
      if (!group.members.some((one) => one.email === body.email)) {
        group.members = [...group.members, member(body.email!, PEOPLE.find((one) => one.email === body.email)?.name ?? null, { addedAt: new Date().toISOString() })];
        logged(group, 'added', { email: body.email });
      }
      return json({ group: detail(group) }, 201);
    }
    if (members && email && method === 'DELETE') {
      group.members = group.members.filter((one) => one.email !== decodeURIComponent(email));
      logged(group, 'removed', { email: decodeURIComponent(email) });
      return json({ group: detail(group) });
    }
    return undefined;
  };
}

function serve({
  signedIn = true,
  settings = {} as Record<string, unknown>,
  as = 'businessAnalyst' as StartingGroup,
  permissions = undefined as Permissions | undefined,
  groups = [] as string[],
  weekly = {} as Record<string, unknown>,
  queries = [] as Record<string, unknown>[],
  lenses = [] as Record<string, unknown>[],
  conversations = [] as Record<string, unknown>[],
  learned = [] as Record<string, unknown>[],
  waiting = [SAVED_SEARCHES] as Record<string, unknown>[],
  /** The release of the Domain Model registry gives; empty when the collector says no version. */
  modelRelease = '0.0.70',
  /** What Weekly lead volume relates to, for its Entities. */
  related = [] as Record<string, unknown>[],
  creditWith = {} as Partial<typeof CREDIT>,
  excelKeys = [] as Record<string, unknown>[],
  everyKey = [] as Record<string, unknown>[],
  users = USERS as Record<string, unknown>[],
  writable = undefined as string[] | undefined,
  /** The path at which the session ends while the User works: it answers 401, and so does every renewal after it. */
  sessionEndsAt = undefined as string | undefined,
  /** The Groups of Data Hub, for the page Groups; without it, Data is the one Group of the User. */
  world = undefined as ReturnType<typeof groupWorld> | undefined,
  /**
   * Slack, by address: the name of the account that has it, the Google address of the User among them (FR-LN-07);
   * without it, the Slack app of Data Hub is not set up here (OP-UX-78). The code it sends is always 123456.
   */
  slack = undefined as Record<string, string> | undefined,
} = {}): Saved[] {
  const calls: Saved[] = [];
  // The Users and Permission groups as identity keeps them, changed by what the page asks (TR-PL-07).
  const people = structuredClone(users) as (typeof MAX_USER)[];
  let permissionGroups = startingGroups() as (ReturnType<typeof startingGroups>[number] & { permissions: Permissions })[];
  const counted = () => permissionGroups.map((group) => ({ ...group, users: people.filter((user) => user.permissionGroup.id === group.id).length }));
  const tools = (permissions ?? STARTING_GROUPS[as].permissions)['admin.open'];
  const mayAdmin = (tool: string) => tools.on && (tools.values.tools as string[]).includes(tool);
  // Credit leads as catalogue keeps it, with its folders, changed by what the page asks (FR-CO-38 to FR-CO-41).
  let credit = { ...CREDIT, ...creditWith };
  /** The queries the User hid from their panel (DEC-UX-138). */
  const hiddenQueries = new Set<string>();
  // The Messages as catalogue keeps them, changed by what the page asks.
  const talk = conversations.map((message) => ({ replies: [], replyCount: 0, unread: false, mine: false, ...message })) as Record<string, unknown>[];
  // The Source Job of dbt-prod as registry keeps it, changed by what the page asks (FR-AR-18).
  let sourceJob = { ...SOURCE_JOB_TILE };
  // Weekly lead volume as catalogue keeps it, changed by what the page asks.
  let resource: Record<string, unknown> = { ...WEEKLY_DETAIL, ...weekly };
  // The address by which catalogue finds the User in Slack, and the code it sent, changed by what the page asks.
  let slackKept: { email: string; confirmedAt: string } | null = null;
  let slackCode: { email: string; triesLeft: number } | null = null;
  const slackState = () => {
    const address = slackKept?.email ?? ME.email;
    return slack
      ? { on: true, google: ME.email, address, confirmedAt: slackKept?.confirmedAt ?? null, name: slack[address] ?? null }
      : { on: false, google: ME.email, address: ME.email, confirmedAt: null, name: null };
  };
  const PUBLICATION = { publishedAt: '2026-10-28T09:00:00Z', publishedBy: 'Max Verstraete', confirmedAt: '2026-10-28T09:00:00Z', confirmedBy: 'Max Verstraete' };
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = input.replace(CONFIG.identityUrl, '').replace(CONFIG.catalogueUrl, '').replace(CONFIG.registryUrl, '').replace(CONFIG.queryUrl, '');
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (path === '/auth/token') {
      return signedIn ? json({ access_token: 'token', expires_in: 3600 }) : json({ error: 'no_session' }, 401);
    }
    calls.push({ method, path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) });
    if (sessionEndsAt !== undefined && path === sessionEndsAt) {
      signedIn = false;
      return json({ error: 'unauthorized' }, 401);
    }
    if (path === '/me') {
      return json({ ...ME, groups, permissionGroup: { id: `pg-${as}`, name: STARTING_GROUPS[as].name }, permissions: permissions ?? STARTING_GROUPS[as].permissions });
    }
    // What the services allowed the Data Team, they allow Admin now (FR-PL-15).
    const dataTeam = as === 'admin';
    // catalogue, as it tells what an Owner Unit holds that the User sees (FR-UM-18).
    const ownedBy = (id: string) => [credit, LISTINGS].filter((collection) => collection.ownerUnit.id === id).map(({ id, name, icon, visibility }) => ({ id, name, icon, visibility }));
    const [, ownerUnit] = /^\/owner-units\/([^/]+)\/collections$/.exec(path) ?? [];
    if (ownerUnit) return json({ collections: ownedBy(decodeURIComponent(ownerUnit)) });
    const answered = world?.(method, path, init.body ? (JSON.parse(init.body as string) as Record<string, string>) : undefined, ownedBy);
    if (answered) return answered;
    if (path === '/collections' && method === 'GET') {
      return json({ collections: [credit, LISTINGS] });
    }
    if (path === '/collections/c1/folders' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; parentId: string | null };
      const made = { id: 'f-new', name: body.name, description: '', parentId: body.parentId, createdBy: 'Max Verstraete', createdAt: '2026-10-31T08:00:00Z' };
      credit = { ...credit, folders: [...credit.folders, made] };
      return json(made, 201);
    }
    // A Resource taken out of Credit leads: it leaves its folder with it (DEC-UX-212).
    const [, takenOut] = /^\/resources\/([^/]+)\/collection$/.exec(path) ?? [];
    if (takenOut && method === 'DELETE' && credit.resources.some((item) => item.id === takenOut)) {
      credit = { ...credit, resources: credit.resources.filter((item) => item.id !== takenOut) };
      if (resource.id === takenOut) resource = { ...resource, collectionId: null };
      return new Response(null, { status: 204 });
    }
    const [, folderId] = /^\/collections\/c1\/folders\/([^/]+)$/.exec(path) ?? [];
    if (folderId && method === 'PATCH') {
      const changes = JSON.parse(init.body as string) as { name?: string; description?: string };
      credit = { ...credit, folders: credit.folders.map((folder) => (folder.id === folderId ? { ...folder, ...changes } : folder)) };
      return json(credit.folders.find((folder) => folder.id === folderId));
    }
    if (folderId && method === 'DELETE') {
      const holds = credit.folders.filter((folder) => folder.parentId === folderId).length + credit.resources.filter((item) => item.folderId === folderId).length;
      if (holds > 0) return json({ error: 'not_empty', holds }, 409);
      credit = { ...credit, folders: credit.folders.filter((folder) => folder.id !== folderId) };
      return new Response(null, { status: 204 });
    }
    const [, kind, itemId] = /^\/collections\/c1\/places\/(resource|lens|folder)\/([^/]+)$/.exec(path) ?? [];
    if (kind && itemId && method === 'PUT') {
      const to = (JSON.parse(init.body as string) as { folderId: string | null }).folderId;
      if (kind === 'resource') credit = { ...credit, resources: credit.resources.map((item) => (item.id === itemId ? { ...item, folderId: to } : item)) };
      if (kind === 'folder') credit = { ...credit, folders: credit.folders.map((folder) => (folder.id === itemId ? { ...folder, parentId: to } : folder)) };
      if (kind === 'lens') credit = { ...credit, lensFolders: Object.fromEntries([...Object.entries(credit.lensFolders).filter(([id]) => id !== itemId), ...(to ? [[itemId, to]] : [])]) };
      return new Response(null, { status: 204 });
    }
    if (path === '/collections' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; ownerUnit: string };
      return json({ ...CREDIT, ...body, id: 'c-new', ownerUnit: DATA, resources: [], lastChange: null }, 201);
    }
    if (path === '/collections/c1') {
      if (method === 'PATCH') credit = { ...credit, ...JSON.parse(init.body as string) };
      return json(credit);
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
    // registry, as it keeps the Source Jobs and every delivery of the webhook (FR-AR-18, FR-AR-19).
    if (path === '/admin/source-jobs' && method === 'GET') {
      return json({ projects: [sourceJob], webhookUrl: 'https://registry.test/webhooks/dbt-cloud' });
    }
    if (path === '/admin/source-jobs/9367/jobs') {
      return json({ environment: { id: '1', name: 'UAT' }, jobs: DBT_JOBS });
    }
    // A dbt project not followed yet: its jobs of every environment, but no CI job and none without the docs (DEC-AR-10).
    if (path === '/admin/source-jobs/15890/jobs') {
      return json({
        environment: null,
        jobs: [
          { id: '802114', name: 'UAT - Deploy - Merge build', projectId: '15890', environmentId: '5', environmentName: 'UAT', kind: 'merge', generatesDocs: true, lastRun: null, current: false, notChoosable: null },
          { id: '802131', name: 'PROD - Daily export', projectId: '15890', environmentId: '6', environmentName: 'Production', kind: 'scheduled', generatesDocs: false, lastRun: null, current: false, notChoosable: 'noDocs' },
        ],
      });
    }
    if (path === '/admin/dbt-projects') {
      return json({ projects: [{ id: '9367', name: 'dbt-prod', following: true }, { id: '15890', name: 'dbt-marketing', following: false }] });
    }
    if (path === '/admin/source-jobs' && method === 'POST') {
      const { projectId, jobId } = JSON.parse(init.body as string) as { projectId: string; jobId: string };
      return json({ ...SOURCE_JOB_TILE, projectId, projectName: 'dbt-marketing', job: { id: jobId, name: 'UAT - Deploy - Merge build', environmentName: 'UAT', kind: 'merge', generatesDocs: true }, setBy: 'Max Verstraete', setAt: new Date().toISOString(), lastSet: null }, 201);
    }
    if (path === '/admin/source-jobs/9367' && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (path === '/admin/source-jobs/9367' && method === 'PUT') {
      const { jobId } = JSON.parse(init.body as string) as { jobId: string };
      const job = DBT_JOBS.find((candidate) => candidate.id === jobId)!;
      sourceJob = { ...sourceJob, job: { id: job.id, name: job.name, environmentName: job.environmentName, kind: job.kind, generatesDocs: job.generatesDocs }, setBy: 'Max Verstraete', setAt: new Date().toISOString() };
      return json(sourceJob);
    }
    if (path === '/admin/deliveries') {
      return json({ deliveries: DELIVERIES, toLookAt: 2 });
    }
    const again = /^\/runs\/(\d+)\/reprocess$/.exec(path);
    if (again && method === 'POST') {
      return json({ runId: again[1], status: 'pending' }, 202);
    }
    if (path === '/domain-model') {
      return json({
        domain: 'immoscoop',
        version: '0.1.0',
        release: modelRelease,
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
        domainModel: { release: modelRelease },
      });
    }
    if (path === '/groups') {
      return dataTeam ? json({ groups: [summaryOf(DATA), summaryOf(SALES, { isMember: false, managedBy: { id: 'g2', name: 'Sales', isMember: false } })] }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources?collection=none') {
      return dataTeam ? json({ resources: waiting }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/withdrawn') {
      return dataTeam ? json({ resources: WITHDRAWN }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources/r1' && dataTeam) {
      return json({ resource: SAVED_SEARCHES });
    }
    if (path === '/resources/r2') {
      const changes = method === 'PATCH' ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      resource = { ...resource, card: { ...(resource.card as object), ...changes } };
      return json({ resource });
    }
    const gapOn = /^\/resources\/r2\/gaps(?:\/([^/]+))?$/.exec(path);
    if (gapOn) {
      // Its Known Gaps, one by one, with who added them and where each holds (FR-RC-21, FR-RC-24).
      const card = resource.card as { knownGaps: { id: string; text: string; scope: unknown; addedBy: string | null; addedAt: string | null }[] };
      const body = init.body ? (JSON.parse(init.body as string) as { text: string; scope?: unknown }) : undefined;
      const added = { id: `gap-${card.knownGaps.length + 1}`, text: body?.text ?? '', scope: body?.scope ?? null, addedBy: 'Max Verstraete', addedAt: '2026-11-04T09:00:00Z' };
      const changed = (gap: (typeof card.knownGaps)[number]) => ({ ...gap, text: body?.text ?? '', ...(body && 'scope' in body ? { scope: body.scope ?? null } : {}) });
      const knownGaps =
        method === 'POST' ? [...card.knownGaps, added] : method === 'PATCH' ? card.knownGaps.map((gap) => (gap.id === gapOn[1] ? changed(gap) : gap)) : card.knownGaps.filter((gap) => gap.id !== gapOn[1]);
      resource = { ...resource, card: { ...card, knownGaps } };
      return method === 'DELETE' ? new Response(null, { status: 204 }) : json({ gap: knownGaps.find((gap) => gap.id === (gapOn[1] ?? added.id)) }, method === 'POST' ? 201 : 200);
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
      return json({ related });
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
      return json({ lenses: lenses.filter((candidate) => !candidate.gone).map(({ steps: _steps, parameters: _parameters, ...item }) => item) });
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
    // Deleted, for good: its address says so to whoever saw it (FR-LE-18).
    if (lens && path === `/lenses/${lens.id as string}` && method === 'DELETE') {
      lens.gone = { at: '2026-11-04T10:00:00Z', byName: 'Max Verstraete', reason: (JSON.parse(init.body as string) as { reason: string }).reason };
      return json({ lens: { id: lens.id, name: lens.name, collectionId: lens.collectionId }, told: lens.usedBy ?? 0 });
    }
    if (lens?.gone && path === `/lenses/${lens.id as string}`) {
      return json({ error: 'deleted', message: 'This Lens was deleted.', lens: { id: lens.id, name: lens.name, collectionId: lens.collectionId, deleted: lens.gone } }, 410);
    }
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
    const listed = () =>
      queries.map(({ id, name, kind, ownerName, resources: on, lastRunAt, createdAt, request, broken, through }) => ({
        id: id as string,
        name: name as string,
        kind: (kind as string | undefined) ?? 'query',
        ownerName,
        resources: on,
        lastRunAt: lastRunAt as string | null,
        createdAt: createdAt as string,
        runs: lastRunAt ? 1 : 0,
        request: request ?? null,
        hidden: hiddenQueries.has(id as string),
        broken: (broken as Record<string, string> | null | undefined) ?? null,
        through: (through as string | null | undefined) ?? null,
      }));
    // What the panel shows a query as, until a chip adds the rest (DEC-UX-137).
    const shownAs = (item: ReturnType<typeof listed>[number]) => (item.hidden ? 'hidden' : item.kind === 'preview' ? 'previews' : item.kind === 'lens' ? 'lenses' : 'queries');
    if ((path === '/queries' || path.startsWith('/queries?')) && method === 'GET') {
      const params = new URLSearchParams(path.split('?')[1] ?? '');
      const show = params.get('show');
      const from = params.get('from');
      const to = params.get('to');
      const words = params.get('q')?.toLowerCase();
      const found = listed()
        .filter((item) => show === null || shownAs(item) === 'queries' || show.split(',').includes(shownAs(item)))
        .filter((item) => !from || new Date(item.lastRunAt ?? item.createdAt) >= new Date(from))
        .filter((item) => !to || new Date(item.lastRunAt ?? item.createdAt) < new Date(to))
        .filter((item) => !words || item.name.toLowerCase().includes(words));
      return json({ queries: found.slice(0, Number(params.get('limit') ?? 200)) });
    }
    if (path.startsWith('/queries/days?') && method === 'GET') {
      const timeZone = new URLSearchParams(path.split('?')[1]).get('tz') ?? 'UTC';
      const days = new Map<string, Record<string, number>>();
      for (const item of listed()) {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(item.lastRunAt ?? item.createdAt));
        const counts = days.get(day) ?? { queries: 0, previews: 0, lenses: 0, hidden: 0 };
        counts[shownAs(item)] = (counts[shownAs(item)] ?? 0) + 1;
        days.set(day, counts);
      }
      return json({ days: [...days].map(([day, counts]) => ({ day, ...counts })).toSorted((a, b) => b.day.localeCompare(a.day)) });
    }
    const hiding = /^\/queries\/([^/]+)\/hidden$/.exec(path);
    if (hiding) {
      if (method === 'PUT') hiddenQueries.add(hiding[1] as string);
      else hiddenQueries.delete(hiding[1] as string);
      return json({ hidden: method === 'PUT' });
    }
    // What is added to a query comes as CTEs at its start (FR-SR-59); a power user finds tables Data Hub knows (FR-SR-58).
    if (path === '/queries/ctes' && method === 'POST') {
      const asked = JSON.parse(init.body as string) as { sql: string; resources: string[]; tables: string[] };
      const names = [...asked.resources.map((id) => ({ r5: 'listings', r6: 'saved_searches' })[id] ?? id), ...asked.tables.map((key) => key.split('.').at(-1) as string)];
      const ctes = names.map((name) => `${name} as (\n    select\n        *\n    from\n        \`p.d.${name}\`\n)`);
      return json({ sql: `with\n\n${ctes.join(',\n\n')}\n\n${asked.sql}`, ctes });
    }
    // What dbt and BigQuery know of a table outside Data Hub (FR-SR-62).
    if (path.startsWith('/outside-table?key=')) {
      const key = 'immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads';
      return json({
        table: {
          key, fullName: key, name: 'stg_oltp__leads', layer: 'staging', resourceType: 'model', projectName: 'dbt-prod', materialized: 'incremental',
          description: 'One row per lead as the OLTP database keeps it.',
          bigquery: { type: 'TABLE', bytes: 3_100_000_000, rows: 4_800_000, partitions: 1412, modifiedAt: '2026-11-14T06:14:00.000Z' },
          partition: { field: 'created_date', unit: 'day', required: true },
          clusterBy: ['lead_source'],
          columns: [
            { name: 'created_date', type: 'DATE', description: 'Day it came in.', from: 'dbt', partition: true, cluster: null },
            { name: 'lead_source', type: 'STRING', description: 'Source system code.', from: 'bigquery', partition: false, cluster: 1 },
            { name: 'lead_id', type: 'STRING', description: '', from: null, partition: false, cluster: null },
          ],
        },
      });
    }
    if (path.startsWith('/known-tables/search?')) {
      const key = 'immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads';
      return json({
        tables: [
          { key, fullName: key, name: 'stg_oltp__leads', resourceType: 'model', layer: 'staging', projectId: '9367', projectName: 'dbt-prod', resource: false, partition: { field: 'created_date', unit: 'day' }, description: 'One row per lead as the OLTP database keeps it.', columns: [{ name: 'lead_id', dataType: 'STRING', description: 'Id of the lead.' }, { name: 'created_date', dataType: 'DATE', description: 'Day it came in.' }] },
          { key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume', fullName: 'x', name: 'weekly_lead_volume', resourceType: 'model', layer: 'mart', projectId: '9367', projectName: 'dbt-prod', resource: true, partition: null, description: '', columns: [] },
        ],
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
      // What it ran before no longer finds a column: the query is Broken now, until a change no longer reads it (FR-SR-53).
      const lost = (query.loses ?? query.broken) as { name: string } | undefined;
      if (lost && body.sql.includes(lost.name)) {
        query.broken = lost;
        return json({ preflight: { ...preflightOf(body.sql), runnable: false, bytes: null, range: null, problems: [{ kind: 'invalid', message: `Unrecognized name: ${lost.name}` }] }, broken: lost });
      }
      query.broken = null;
      return json({ preflight: preflightOf(body.sql, body.parameters), broken: null });
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
    // semgraph, as Charts reads it: its charts, one described, and its examples as it draws them (TR-PF-34).
    if (path.startsWith(`${CONFIG.semgraphUrl}/semgraphs?locale=`)) {
      return json(SEMGRAPH_CHARTS);
    }
    const [, described] = /^https:\/\/semgraph\.test\/semgraphs\/([^/?]+)\?locale=/.exec(path) ?? [];
    if (described) {
      const chart = SEMGRAPH_DESCRIBED[described];
      return chart ? json(chart) : json({ outcome: 'invalid', issues: [{ level: 'inputError', code: 'unknownSemgraph' }] }, 404);
    }
    const [, exampleName] = /^https:\/\/semgraph\.test\/semgraphs\/[^/]+\/examples\/([^/?]+)\?theme=/.exec(path) ?? [];
    if (exampleName === 'unique-without-aggregation') {
      return json({ outcome: 'refused', issues: [{ level: 'refusal', code: 'uniqueAggregationRequired', message: 'Zeg hoe ze geteld zijn.' }] }, 422);
    }
    if (exampleName) {
      const headers: Record<string, string> = { 'content-type': 'image/svg+xml' };
      if (exampleName === 'window-10') headers['semgraph-deviations'] = 'windowNotMultipleOf7';
      if (exampleName === 'few-leads') headers['semgraph-cautions'] = 'fewObservations.mean';
      return new Response(`<svg xmlns="http://www.w3.org/2000/svg"><title>${exampleName}</title></svg>`, { headers });
    }
    // identity, as it keeps the Excel keys of the User (FR-PL-01, FR-PL-02).
    if (path === '/me/excel-keys' && method === 'GET') {
      return json({ keys: excelKeys });
    }
    if (path === '/me/excel-keys' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string };
      const key = { id: `k-${excelKeys.length + 1}`, name: body.name, createdAt: '2026-10-31T08:00:00Z', lastUsedAt: null, expiresAt: '2027-10-31T08:00:00Z', revokedAt: null, revokedBy: null };
      excelKeys.unshift(key);
      return json({ key, secret: 'dhx_once-and-never-again-0123456' }, 201);
    }
    const keyOn = /^\/me\/excel-keys\/([^/]+)$/.exec(path);
    if (keyOn && method === 'DELETE') {
      const key = excelKeys.find((candidate) => candidate.id === keyOn[1]);
      if (!key) return json({ error: 'not_found' }, 404);
      Object.assign(key, { revokedAt: '2026-10-31T09:00:00Z', revokedBy: 'Max Verstraete' });
      return new Response(null, { status: 204 });
    }
    // identity, as the Data Team sees every Excel key and revokes any (FR-PL-03).
    if (path === '/excel-keys' && method === 'GET') {
      return dataTeam ? json({ keys: everyKey }) : json({ error: 'forbidden' }, 403);
    }
    // identity, as Admin sees the Users and their Permission groups (TR-PL-07).
    if (path === '/users' && method === 'GET') {
      return mayAdmin('users') ? json({ users: people }) : json({ error: 'forbidden', permission: 'admin.open' }, 403);
    }
    const [, userId, moving] = /^\/users\/([^/]+)(\/permission-group)?$/.exec(path) ?? [];
    if (userId && !moving && method === 'GET') {
      const user = people.find((one) => one.googleId === userId);
      const history = userId === '2' ? [{ at: '2026-10-14T09:00:00Z', from: 'pg-businessAnalyst', to: 'pg-lensUser', by: 'Ruth Aerts' }, { at: '2026-09-02T08:00:00Z', from: null, to: 'pg-businessAnalyst', by: null }] : [];
      return user ? json({ user, history }) : json({ error: 'not_found' }, 404);
    }
    if (userId && moving && method === 'PUT') {
      const user = people.find((one) => one.googleId === userId);
      const to = permissionGroups.find((group) => group.id === (JSON.parse(init.body as string) as { groupId: string }).groupId);
      if (!user || !to) return json({ error: 'not_found' }, 404);
      if (userId === ME.sub) return json({ error: 'own_group' }, 403);
      if (user.permissionGroup.id === 'pg-admin' && people.filter((one) => one.permissionGroup.id === 'pg-admin').length === 1) return json({ error: 'last_admin' }, 409);
      user.permissionGroup = { id: to.id, name: to.name };
      return json({ user });
    }
    if (path === '/permission-groups' && method === 'GET') {
      return mayAdmin('permissionGroups') || mayAdmin('users') ? json({ groups: counted() }) : json({ error: 'forbidden', permission: 'admin.open' }, 403);
    }
    if (path === '/permission-groups' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; sentence: string; from: string | null };
      const from = permissionGroups.find((group) => group.id === body.from);
      const made = { ...startingGroups()[2]!, id: 'pg-new', name: body.name, sentence: body.sentence, isDefault: false, locked: false, updatedBy: 'Max Verstraete', permissions: structuredClone(from ? from.permissions : NO_PERMISSIONS) };
      permissionGroups = [...permissionGroups, made];
      return json({ group: made }, 201);
    }
    const [, groupId, makesDefault] = /^\/permission-groups\/([^/]+)(\/default)?$/.exec(path) ?? [];
    const group = permissionGroups.find((one) => one.id === groupId);
    if (group && !makesDefault && method === 'PATCH') {
      if (group.locked) return json({ error: 'locked' }, 409);
      Object.assign(group, JSON.parse(init.body as string), { updatedAt: '2026-11-06T10:00:00Z', updatedBy: 'Max Verstraete' });
      return json({ group: counted().find((one) => one.id === group.id) });
    }
    if (group && makesDefault && method === 'PUT') {
      permissionGroups.forEach((one) => (one.isDefault = one.id === group.id));
      return json({ group });
    }
    if (group && method === 'DELETE') {
      const moveTo = permissionGroups.find((one) => one.id === (JSON.parse(init.body as string) as { moveTo: string }).moveTo);
      if (group.locked) return json({ error: 'locked' }, 409);
      if (!moveTo || moveTo.locked || moveTo.id === group.id) return json({ error: 'invalid_request' }, 400);
      people.filter((user) => user.permissionGroup.id === group.id).forEach((user) => (user.permissionGroup = { id: moveTo.id, name: moveTo.name }));
      if (group.isDefault) moveTo.isDefault = true;
      permissionGroups = permissionGroups.filter((one) => one.id !== group.id);
      return new Response(null, { status: 204 });
    }
    const anyKey = /^\/excel-keys\/([^/]+)$/.exec(path);
    if (anyKey && method === 'DELETE') {
      const key = everyKey.find((candidate) => candidate.id === anyKey[1]);
      if (!key) return json({ error: 'not_found' }, 404);
      Object.assign(key, { revokedAt: new Date().toISOString(), revokedBy: 'Max Verstraete', revokedById: '1' });
      return new Response(null, { status: 204 });
    }
    if (path === '/me/groups') {
      return json({ groups: [summaryOf(DATA)] });
    }
    if (path.startsWith('/me/settings/') && (method === 'PUT' || method === 'DELETE')) {
      return new Response(null, { status: 204 });
    }
    if (path === '/me/slack' && method === 'GET') return json(slackState());
    if (path === '/me/slack' && method === 'DELETE') {
      slackKept = null;
      return json(slackState());
    }
    if (path === '/me/slack/lookup' || path === '/me/slack/code') {
      const { email } = JSON.parse(init.body as string) as { email: string };
      const name = slack?.[email];
      if (!name) return json({ error: 'not_found' }, 404);
      if (path === '/me/slack/lookup') return json({ name });
      slackCode = { email, triesLeft: 5 };
      return json({ name, expiresAt: '2026-11-11T20:10:00Z' }, 202);
    }
    if (path === '/me/slack/confirm') {
      const { code } = JSON.parse(init.body as string) as { code: string };
      if (!slackCode) return json({ error: 'no_code' }, 409);
      if (code !== '123456') {
        slackCode.triesLeft -= 1;
        return json({ error: 'wrong_code', triesLeft: slackCode.triesLeft }, 400);
      }
      slackKept = slackCode.email === ME.email ? null : { email: slackCode.email, confirmedAt: '2026-11-11T20:05:00Z' };
      slackCode = null;
      return json(slackState());
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
      const listed = new URLSearchParams(path.split('?')[1]).get('view') === 'unread' ? talk.filter((message) => message.unread) : talk;
      return json({ messages: listed, counts: { forYou: talk.length, unread: talk.filter((message) => message.unread).length, written: 0, kinds, on } });
    }
    const onObject = /^\/messages\/on\/(\w+)\/([^/]+)$/.exec(path);
    if (onObject) {
      const messages = talk.filter((message) => (message.subject as { kind: string; id: string }).kind === onObject[1] && (message.subject as { id: string }).id === onObject[2]);
      return json({ messages, ...(writable ? { kinds: writable } : {}) });
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
    // Closed with an optional line why, and reopened (FR-CV-16, MSG-CNV-07).
    if (message && path === `/messages/${message.id as string}/close` && method === 'POST') {
      const body = JSON.parse(init.body as string) as { text: string };
      message.state = 'closed';
      (message.replies as unknown[]).push({ id: 'c-1', type: 'MSG-CNV-07', kind: 'closing', writer: { id: '1', name: 'Max Verstraete', as: 'owner' }, params: { writer: 'Max Verstraete', ...(body.text ? { text: body.text } : {}) }, createdAt: '2026-10-29T11:00:00Z', mine: true });
      return json({ message });
    }
    if (message && path === `/messages/${message.id as string}/reopen` && method === 'POST') {
      message.state = 'open';
      return json({ message });
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

  it('wears the ribbon of uat on the sign-in, and its name at the start of the title of the tab; prod wears none (DEC-UX-203)', async () => {
    serve({ signedIn: false });
    open('/collections');
    const uat = render(App, { config: { ...CONFIG, environment: 'uat' } });
    expect((await screen.findByRole('note', { name: 'Dit is Data Hub uat, om in te testen: niet prod' })).textContent).toBe('uat');
    expect(document.title.startsWith('uat · Data Hub')).toBe(true);
    uat.unmount();

    serve({ signedIn: false });
    render(App, { config: { ...CONFIG, environment: 'prod' } });
    await screen.findByRole('link', { name: /Aanmelden met Google/ });
    expect(screen.queryByRole('note', { name: /Data Hub/ })).toBeNull();
    expect(document.title.startsWith('Data Hub')).toBe(true);
  });

  it('shows the sign-in on a background of the set, picked at random, without a photo or its story (DEC-UX-173)', async () => {
    serve({ signedIn: false });
    // The last of the set by day: Tide, a painted scene; no photo is left in the set (DEC-UX-208).
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(App, { config: CONFIG });
    await screen.findByRole('link', { name: /Aanmelden met Google/ });
    random.mockRestore();
    expect(document.querySelector('.picture')).toBeNull();
    expect(screen.queryByRole('figure')).toBeNull();
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
  it('shows the sign-in, not a loader, when the session ends while the User works, and returns to the page after', async () => {
    serve({ sessionEndsAt: '/collections' });
    open('/collections');
    render(App, { config: CONFIG });
    const signIn = await screen.findByRole('link', { name: /Aanmelden met Google/ });
    expect(signIn.getAttribute('href')).toBe('/auth/login?next=%2Fcollections');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('opens on Collections, with the rail and its panel', async () => {
    serve();
    open('/');
    render(App, { config: CONFIG });
    const collections = await screen.findByRole('link', { name: 'Collections' });
    expect(collections.getAttribute('aria-current')).toBe('page');
    expect(location.pathname).toBe('/collections');
    expect(screen.getByRole('complementary', { name: 'Collections' }).inert).toBe(false);
    expect(screen.getByRole('link', { name: 'Mijn pagina' }).textContent).toBe('MV');
    expect(document.title).toBe('local · Data Hub — Collections');
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
    // Charts opens on its first chart (DEC-UX-182).
    await vi.waitFor(() => expect(location.pathname).toBe('/charts/movingWindowAverage'));
    expect(screen.getByRole('complementary', { name: 'Grafieken' }).inert).toBe(false);
    expect(await within(screen.getByRole('main')).findByRole('heading', { level: 1, name: 'Voortschrijdend gemiddelde' })).toBeTruthy();
  });

  it('follows the system; its switch shows where it goes and holds for the session only (DEC-UX-172)', async () => {
    let systemChanged: ((event: { matches: boolean }) => void) | undefined;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        if (query.includes('prefers-color-scheme')) systemChanged = listener;
      },
      removeEventListener() {},
    }));
    const calls = serve();
    render(App, { config: CONFIG });
    expect(document.documentElement.dataset.theme).toBe('light');
    // By day the moon, which goes to dark.
    const toDark = await screen.findByRole('button', { name: 'Naar donker' });
    const moon = toDark.innerHTML;
    await fireEvent.click(toDark);
    expect(document.documentElement.dataset.theme).toBe('dark');
    // At once: every transition is off until the new colours are on screen (DEC-UX-149).
    expect(document.documentElement.classList.contains('theme-switching')).toBe(true);
    await vi.waitFor(() => expect(document.documentElement.classList.contains('theme-switching')).toBe(false));
    // By night the sun, which goes back to light; nothing is remembered.
    expect(screen.getByRole('button', { name: 'Naar licht' }).innerHTML).not.toBe(moon);
    expect(calls.some((call) => call.path.startsWith('/me/settings/theme'))).toBe(false);
    // A change of the system wins over the switch.
    systemChanged?.({ matches: true });
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    systemChanged?.({ matches: false });
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('opens My page behind the initials, where the language of Data Hub is chosen (DEC-UX-85)', async () => {
    const calls = serve();
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Mijn pagina' }));
    expect(location.pathname).toBe('/me');
    expect(screen.getByRole('heading', { level: 1, name: 'Max Verstraete' })).toBeTruthy();
    // The tile Your groups: the Groups the User is in, each the way to it on Groups (DEC-UX-200).
    const data = await screen.findByRole('link', { name: /^Data/ });
    expect(data.getAttribute('href')).toBe('/groups/g1');
    expect(data.textContent).toContain('1 lid · beheert zichzelf, dus jij beheert hem');
    expect(screen.getByRole('link', { name: 'Groups' }).getAttribute('href')).toBe('/groups');
    expect(screen.getByRole('link', { name: 'Nieuwe Group' }).getAttribute('href')).toBe('/groups/new');
    expect(screen.queryByRole('complementary', { hidden: true })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/language', body: { value: 'en' } });
  });

  it('shows the Slack account Data Hub finds by the Google address, and takes another one only with a code sent there (FR-LN-07, OP-LN-08)', async () => {
    const calls = serve({ settings: { language: 'en' }, slack: { 'max@thenextimmoscoop.be': 'Max Verstraete', 'max@immoscoop.be': 'Max V.' } });
    open('/me');
    render(App, { config: CONFIG });
    const tile = within((await screen.findByText('Slack', { selector: '.label' })).closest('section')!);
    expect(await tile.findByText('in Slack, by max@thenextimmoscoop.be, your Google account')).toBeTruthy();
    expect(tile.getByText('Found')).toBeTruthy();

    // An address no one in Slack has is said in the tile.
    await fireEvent.click(tile.getByRole('button', { name: 'Another address' }));
    const field = tile.getByRole('textbox', { name: 'Your address in Slack' });
    // No password manager offers itself on it (DEC-UX-211).
    expect(field.hasAttribute('data-1p-ignore')).toBe(true);
    expect(field.getAttribute('data-lpignore')).toBe('true');
    await fireEvent.input(field, { target: { value: 'nobody@immoscoop.be' } });
    await fireEvent.click(tile.getByRole('button', { name: 'Look it up' }));
    expect(await tile.findByText('No one in Slack has this address. Check it in your profile in Slack.')).toBeTruthy();

    // One someone has is named, and nothing changes until the code sent there is typed.
    await fireEvent.input(field, { target: { value: 'max@immoscoop.be' } });
    await fireEvent.click(tile.getByRole('button', { name: 'Look it up' }));
    expect(await tile.findByText('has this address in Slack')).toBeTruthy();
    expect(tile.getByText('Max V.')).toBeTruthy();
    expect(calls.some((call) => call.path === '/me/slack/code')).toBe(false);
    await fireEvent.click(tile.getByRole('button', { name: 'Send the code' }));
    expect(await tile.findByText('Data Hub sent a code to Max V. in Slack. Type it here: it holds for 10 minutes.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/me/slack/code', body: { email: 'max@immoscoop.be', language: 'en' } });

    const code = tile.getByRole('textbox', { name: 'Code' });
    await fireEvent.input(code, { target: { value: '000000' } });
    await fireEvent.click(tile.getByRole('button', { name: 'Confirm' }));
    expect(await tile.findByText('That code is not right. 4 tries left.')).toBeTruthy();
    await fireEvent.input(code, { target: { value: '123456' } });
    await fireEvent.click(tile.getByRole('button', { name: 'Confirm' }));
    expect(await tile.findByText('in Slack, by max@immoscoop.be, which you confirmed on 11 November')).toBeTruthy();
    expect(tile.getByText('Confirmed')).toBeTruthy();

    await fireEvent.click(tile.getByRole('button', { name: 'Back to your Google address' }));
    expect(await tile.findByText('in Slack, by max@thenextimmoscoop.be, your Google account')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'DELETE', path: '/me/slack' });
  });

  it('says so when Slack has no one by the Google address (EC-LN-01)', async () => {
    serve({ settings: { language: 'en' }, slack: {} });
    open('/me');
    render(App, { config: CONFIG });
    const tile = within((await screen.findByText('Slack', { selector: '.label' })).closest('section')!);
    expect(
      tile.getByText(
        'Data Hub does not find you in Slack by max@thenextimmoscoop.be, so your notifications come by e-mail alone. Is your Slack account on another address? Slack shows it in your profile.',
      ),
    ).toBeTruthy();
    expect(tile.getByRole('textbox', { name: 'Your address in Slack' })).toBeTruthy();
    expect(tile.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows no tile Slack where the Slack app of Data Hub is not set up (OP-UX-78)', async () => {
    const calls = serve({ settings: { language: 'en' } });
    open('/me');
    render(App, { config: CONFIG });
    expect(await screen.findByText('Language', { selector: '.label' })).toBeTruthy();
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'GET', path: '/me/slack' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Slack', { selector: '.label' })).toBeNull();
  });

  it('keeps a background per theme (DEC-UX-108)', async () => {
    const calls = serve({ settings: { language: 'en' } });
    open('/me/background');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('radio', { name: /Tide/ }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/background.light', body: { value: 'tide' } });
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Tide');
  });

  it('lists the Excel keys of the User on My page, makes one shown only once, and revokes one after asking (FR-PL-01, FR-PL-02)', async () => {
    const calls = serve({
      settings: { language: 'en' },
      excelKeys: [{ id: 'k-old', name: 'Old laptop', createdAt: '2025-11-20T08:00:00Z', lastUsedAt: null, expiresAt: '2026-11-20T08:00:00Z', revokedAt: null, revokedBy: null }],
    });
    open('/me/keys');
    render(App, { config: CONFIG });
    const table = within(await screen.findByRole('table', { name: 'Excel keys' }));
    const old = (await table.findByText('Old laptop')).closest('tr')!;
    expect(within(old).getByText('not yet')).toBeTruthy();
    // It expires within a month: its date in the warning colour.
    expect(old.querySelector('.soon')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'New Excel key' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New Excel key' }));
    await fireEvent.click(sheet.getByRole('button', { name: 'Make the key' }));
    expect(sheet.getByText('A name has 1 to 80 characters.')).toBeTruthy();
    await fireEvent.input(sheet.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Excel on my laptop' } });
    await fireEvent.click(sheet.getByRole('button', { name: 'Make the key' }));
    expect(await sheet.findByText('dhx_once-and-never-again-0123456')).toBeTruthy();
    expect(sheet.getByText('You see it only now.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/me/excel-keys', body: { name: 'Excel on my laptop' } });
    await fireEvent.click(sheet.getByRole('button', { name: 'Done' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Once closed, the key itself is gone for good: only its name is in the list.
    expect(await table.findByText('Excel on my laptop')).toBeTruthy();
    expect(screen.queryByText('dhx_once-and-never-again-0123456')).toBeNull();

    // Revoke asks first, in the place of the row.
    await fireEvent.click(within(table.getByText('Old laptop').closest('tr')!).getByRole('button', { name: 'Revoke' }));
    expect(table.getByText('Revoke “Old laptop”?')).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await fireEvent.click(table.getAllByRole('button', { name: 'Revoke' }).find((button) => button.closest('tr')?.classList.contains('confirm'))!);
    expect(calls).toContainEqual({ method: 'DELETE', path: '/me/excel-keys/k-old' });
    // It stays in the list, struck through.
    await vi.waitFor(() => expect(table.getByText('Old laptop').closest('tr')!.classList.contains('revoked')).toBe(true));
    const revoked = table.getByText('Old laptop').closest('tr')!;
    expect(within(revoked).getByText(/^revoked /)).toBeTruthy();
    expect(within(revoked).queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('shows three dots where a page will show, while it is read (DEC-UX-165)', async () => {
    serve();
    // catalogue takes its time with the Resource: it does not answer during the test.
    const answer = globalThis.fetch;
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => (input === `${CONFIG.catalogueUrl}/resources/r2` ? new Promise(() => {}) : answer(input, init)));
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('progressbar', { name: 'Laden…' })).toBeTruthy();
    expect(main.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows one page for what does not exist or may not be seen (DEC-UX-32)', async () => {
    serve();
    open('/collections/secret');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
  });
});

describe('the web app, for the Data Team', () => {
  it('shows the Resources without a Collection on top of the panel of Collections, folded until unfolded (FR-SR-35, DEC-UX-16, DEC-UX-133)', async () => {
    serve({ as: 'admin' });
    open('/collections');
    render(App, { config: CONFIG });
    const toggle = await screen.findByRole('button', { name: 'Toon wat Zonder Collection bevat' });
    expect(screen.getByText('Zonder Collection')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /Saved searches/ })).toBeNull();
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: /Saved searches/ }).getAttribute('href')).toBe('/resources/r1');
  });

  it('unfolds Without a Collection when one of its Resources is open (DEC-UX-133)', async () => {
    serve({ as: 'admin' });
    open('/resources/r1');
    render(App, { config: CONFIG });
    expect((await screen.findByRole('link', { name: /Saved searches/ })).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Toon wat Zonder Collection bevat' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the page of a waiting Resource: where it came from, its description and its maturity (FR-SR-07, FR-SR-09)', async () => {
    serve({ as: 'admin' });
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('button', { name: 'Toon wat Zonder Collection bevat' }));
    await fireEvent.click(await screen.findByRole('link', { name: /Saved searches/ }));
    expect(location.pathname).toBe('/resources/r1');
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Saved searches' })).toBeTruthy();
    expect(main.getByText(SAVED_SEARCHES.key)).toBeTruthy();
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Nog in geen Collection.');
    expect(notice.textContent).toContain('Hij kwam binnen op 21 okt via de exposure datahub_savedSearches in immoscoop_dataplatform_sql.');
    // Its Overview opens on its Summary (FR-RC-19).
    expect(main.getByText('One row per saved search.')).toBeTruthy();
    expect(await main.findByText('Geregistreerd via de exposure datahub_savedSearches')).toBeTruthy();
    await fireEvent.click(main.getByRole('tab', { name: 'Maturiteit' }));
    // Every Level explained: where it stands, and what the next one takes (FR-MR-16).
    expect(main.getByText(/Geregistreerd op 21 okt 2026, via de exposure datahub_savedSearches/)).toBeTruthy();
    expect(main.getByText(/Vraagt een beschrijving in dbt van de tabel en van minstens één veld.*Nu heeft de tabel er een, en 0 van zijn 2 velden/)).toBeTruthy();
    expect(document.title).toBe('local · Data Hub — Saved searches');
    expect(screen.getByRole('link', { name: /Saved searches/ }).getAttribute('aria-current')).toBe('page');
  });

  it('adds a waiting Resource to a Collection from its own page: the Collection first, then its grain (FR-CO-31, DEC-UX-131)', async () => {
    const calls = serve({ as: 'admin' });
    open('/resources/r1');
    render(App, { config: CONFIG });
    const notice = within(await screen.findByRole('status'));
    await fireEvent.click(await notice.findByRole('button', { name: /Aan een Collection toevoegen/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Saved searches aan een Collection toevoegen' }));
    expect(sheet.getByText('Nog geen Collection gekozen')).toBeTruthy();
    const next = sheet.getByRole('button', { name: /Volgende: grain en relaties/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await fireEvent.click(sheet.getByRole('radio', { name: /Credit leads/ }));
    expect(sheet.getByText('In Credit leads · daarna zijn grain en relaties')).toBeTruthy();
    await fireEvent.click(next);

    // The second step is the one of the page of a Collection, with this Resource chosen.
    const second = within(await screen.findByRole('dialog', { name: 'Grain en relaties van Saved searches' }));
    await fireEvent.input(await second.findByRole('textbox', { name: 'Wat één rij is, in woorden' }), { target: { value: 'saved search' } });
    await fireEvent.click(second.getByRole('button', { name: 'Resource toevoegen' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const added = calls.find((call) => call.method === 'POST' && call.path === '/collections/c1/resources');
    expect((added?.body as { resources: { id: string }[] }).resources.map((one) => one.id)).toEqual(['r1']);
    // The page reads again what it now relates to, for its Entities, and its Log: nothing is left as it was before (FR-RC-09).
    await vi.waitFor(() => {
      const later = calls.slice(calls.indexOf(added!) + 1).map((call) => `${call.method} ${call.path}`);
      expect(later).toContain('GET /resources/r1/related');
      expect(later).toContain('GET /resources/r1/log');
    });
  });

  it('shows the page for what may not be seen to anyone else (FR-SR-31, DEC-UX-32)', async () => {
    serve();
    open('/resources/r1');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    expect(screen.queryByText('Zonder Collection')).toBeNull();
  });
});

const WITHDRAWN = [
  {
    id: 'w1',
    displayName: 'Credit lead creations (flat)',
    key: 'immoscoop-dataplatform-398214.colleciones_dbt.mrt_immoscoop__creditLead__create__flatEvent',
    project: 'Colleciónes',
    collection: { id: 'c1', name: 'Credit leads' },
    level: 2,
    withdrawnAt: '2026-11-12T08:12:00Z',
    run: '59772257',
  },
  {
    id: 'w2',
    displayName: 'Lead source',
    key: 'immoscoop-dataplatform-398214.colleciones_dbt.mrt_immoscoop__leadSource__currentState',
    project: 'Colleciónes',
    collection: null,
    level: 1,
    withdrawnAt: '2026-11-11T19:40:00Z',
    run: '59751424',
  },
];

describe('Admin, for the Data Team', () => {
  it('lists every withdrawn Resource in Withdrawn, also without a Collection, filters them and opens one (FR-SR-55, DEC-UX-213)', async () => {
    serve({ as: 'admin' });
    open('/admin/withdrawn');
    render(App, { config: { ...CONFIG, environment: 'uat' } });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Withdrawn' })).toBeTruthy();
    const table = within(await main.findByRole('table', { name: 'Withdrawn' }));
    expect(table.getByText('Credit lead creations (flat)')).toBeTruthy();
    expect(table.getByText('immoscoop-dataplatform-398214.colleciones_dbt.mrt_immoscoop__leadSource__currentState')).toBeTruthy();
    expect(table.getByText('run 59772257')).toBeTruthy();
    // The panel of Admin counts them.
    const panel = within(screen.getByRole('complementary', { name: 'Admin' }));
    await vi.waitFor(() => expect(panel.getByRole('link', { name: /Withdrawn/ }).textContent).toContain('2'));

    // Without a Collection: only Lead source, which shows in no other list.
    await fireEvent.click(main.getByRole('radio', { name: /Zonder Collection 1/ }));
    expect(table.queryByText('Credit lead creations (flat)')).toBeNull();
    expect(table.getByText('Lead source')).toBeTruthy();
    await fireEvent.click(main.getByRole('radio', { name: /Alle 2/ }));
    await fireEvent.input(main.getByRole('searchbox'), { target: { value: 'creditlead' } });
    expect(table.queryByText('Lead source')).toBeNull();

    // A row opens the Resource.
    await fireEvent.click(table.getByText('Credit lead creations (flat)'));
    await vi.waitFor(() => expect(location.pathname).toBe('/resources/w1'));
  });

  it('keeps Withdrawn from whoever may not open it (DEC-UX-130)', async () => {
    serve();
    open('/admin/withdrawn');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
  });

  const UAT: Config = { ...CONFIG, environment: 'uat' };

  it('is not in the rail of anyone else, and its address shows the page for what may not be seen (DEC-UX-130)', async () => {
    const calls = serve();
    open('/admin/webhooks');
    render(App, { config: UAT });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    const rail = within(screen.getByRole('navigation', { name: 'Hoofdnavigatie' }));
    expect(rail.getByRole('link', { name: 'Learning Centre' })).toBeTruthy();
    expect(rail.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(calls.some((call) => call.path.startsWith('/admin/'))).toBe(false);
  });

  it('sits in the rail after the Learning Centre, a little apart, and opens on Webhooks (DEC-UX-130, OP-UX-51, OP-UX-52)', async () => {
    serve({ as: 'admin' });
    open('/admin');
    render(App, { config: UAT });
    const rail = within(await screen.findByRole('navigation', { name: 'Hoofdnavigatie' }));
    const admin = await rail.findByRole('link', { name: 'Admin' });
    await vi.waitFor(() => expect(location.pathname).toBe('/admin/webhooks'));
    expect(admin.getAttribute('aria-current')).toBe('page');
    expect(admin.classList.contains('apart')).toBe(true);
    const links = rail.getAllByRole('link').map((link) => link.getAttribute('aria-label'));
    expect(links.indexOf('Admin')).toBe(links.indexOf('Learning Centre') + 1);
    const panel = within(screen.getByRole('complementary', { name: 'Admin' }));
    expect(panel.getByText('Voor het Data Team: wat Data Hub uat voedt, wie er bij kan, en wat elke User mag.')).toBeTruthy();
    const tool = panel.getByRole('link', { name: /Webhooks/ });
    expect(tool.getAttribute('aria-current')).toBe('page');
    // The deliveries to look at: one refused, one failed.
    await vi.waitFor(() => expect(tool.textContent).toContain('2'));
    expect(screen.getByRole('heading', { level: 1, name: 'Webhooks' })).toBeTruthy();
    expect(document.title).toBe('uat · Data Hub — Webhooks');
  });

  it('shows the Source Job of each dbt project, and changes it to a job of this environment in a sheet (FR-AR-18)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/webhooks');
    render(App, { config: UAT });
    const tile = within(await screen.findByRole('region', { name: 'immoscoop_dataplatform_sql' }));
    expect(tile.getByText('daily UAT build')).toBeTruthy();
    expect(tile.getByText('322951')).toBeTruthy();
    expect(tile.getByText('Gepland')).toBeTruthy();
    expect(tile.getByText('Maakt de docs')).toBeTruthy();
    expect(tile.getByText(/Laatste set: run 58101536, .*, verwerkt/)).toBeTruthy();
    expect(tile.getByText('Overgenomen uit de configuratie van Data Hub uat')).toBeTruthy();
    expect(screen.getByText('https://registry.test/webhooks/dbt-cloud')).toBeTruthy();

    await fireEvent.click(tile.getByRole('button', { name: 'Wijzig' }));
    const sheet = within(screen.getByRole('dialog', { name: 'De Source Job van immoscoop_dataplatform_sql' }));
    expect(((await sheet.findByRole('radio', { name: /^daily UAT build/ })) as HTMLInputElement).checked).toBe(true);
    const make = sheet.getByRole('button', { name: 'Maak er de Source Job van' }) as HTMLButtonElement;
    expect(make.disabled).toBe(true);
    // A CI job, or a job of another environment, cannot be chosen, and says why.
    expect((sheet.getByRole('radio', { name: /^CI\/CD - UAT/ }) as HTMLInputElement).disabled).toBe(true);
    expect(sheet.getByText(/Een CI-job: hij bouwt pull requests/)).toBeTruthy();
    expect((sheet.getByRole('radio', { name: /^CI\/CD - prod/ }) as HTMLInputElement).disabled).toBe(true);
    expect(sheet.getByText('Een job van een andere omgeving, die een andere Data Hub leest.')).toBeTruthy();
    // Nor can a job that does not generate the docs (DEC-UX-166).
    expect((sheet.getByRole('radio', { name: /^UAT - Hourly freshness/ }) as HTMLInputElement).disabled).toBe(true);
    expect(sheet.getByText('Hij maakt geen docs: zijn runs hebben geen catalog.')).toBeTruthy();
    await fireEvent.input(sheet.getByRole('searchbox', { name: 'Zoek een job op naam of ID' }), { target: { value: '352118' } });
    expect(sheet.queryByRole('radio', { name: /^daily UAT build/ })).toBeNull();
    await fireEvent.click(sheet.getByRole('radio', { name: /^UAT - Deploy - Merge build/ }));
    await fireEvent.click(make);

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toContainEqual({ method: 'PUT', path: '/admin/source-jobs/9367', body: { jobId: '352118' } });
    const changed = within(screen.getByRole('region', { name: 'immoscoop_dataplatform_sql' }));
    expect(changed.getByText('UAT - Deploy - Merge build')).toBeTruthy();
    expect(changed.getByText('Merge')).toBeTruthy();
    expect(changed.getByText(/^Ingesteld door Max Verstraete/)).toBeTruthy();
  });

  it('follows a dbt project of the account with one of its jobs, and stops following one after asking (DEC-AR-10, DEC-UX-166)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/webhooks');
    render(App, { config: UAT });
    await screen.findByRole('region', { name: 'immoscoop_dataplatform_sql' });

    await fireEvent.click(screen.getByRole('button', { name: 'Volg een dbt project' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Volg een dbt project' }));
    // Only the dbt projects Data Hub does not follow yet.
    const projects = within(await sheet.findByRole('radiogroup', { name: 'dbt projecten' }));
    expect(projects.queryByRole('radio', { name: /dbt-prod/ })).toBeNull();
    const follow = sheet.getByRole('button', { name: 'Volg het' }) as HTMLButtonElement;
    expect(follow.disabled).toBe(true);
    await fireEvent.click(projects.getByRole('radio', { name: /^dbt-marketing/ }));
    expect(await sheet.findByText('De jobs van dbt-marketing')).toBeTruthy();
    expect(((await sheet.findByRole('radio', { name: /^PROD - Daily export/ })) as HTMLInputElement).disabled).toBe(true);
    await fireEvent.click(sheet.getByRole('radio', { name: /^UAT - Deploy - Merge build/ }));
    await fireEvent.click(follow);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toContainEqual({ method: 'POST', path: '/admin/source-jobs', body: { projectId: '15890', jobId: '802114' } });
    const added = within(screen.getByRole('region', { name: 'dbt-marketing' }));
    expect(added.getByText(/^Ingesteld door Max Verstraete/)).toBeTruthy();

    // Stopping asks first, in the place of the tile, and says the Resources stay.
    const tile = within(screen.getByRole('region', { name: 'immoscoop_dataplatform_sql' }));
    await fireEvent.click(tile.getByRole('button', { name: 'Niet meer volgen' }));
    const asking = within(screen.getByRole('region', { name: 'immoscoop_dataplatform_sql niet meer volgen?' }));
    expect(asking.getByText(/Zijn Resources blijven zoals ze zijn, op zijn laatste versie/)).toBeTruthy();
    await fireEvent.click(asking.getByRole('button', { name: 'Annuleer' }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await fireEvent.click(within(screen.getByRole('region', { name: 'immoscoop_dataplatform_sql' })).getByRole('button', { name: 'Niet meer volgen' }));
    await fireEvent.click(within(screen.getByRole('region', { name: 'immoscoop_dataplatform_sql niet meer volgen?' })).getByRole('button', { name: 'Niet meer volgen' }));
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: /^immoscoop_dataplatform_sql/ })).toBeNull());
    expect(calls).toContainEqual({ method: 'DELETE', path: '/admin/source-jobs/9367' });
    expect(screen.getByRole('region', { name: 'dbt-marketing' })).toBeTruthy();
  });

  it('lists every delivery with what Data Hub did, and processes a failed set again (FR-AR-19, FR-AR-14)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/webhooks');
    render(App, { config: UAT });
    const list = within(await screen.findByRole('region', { name: 'Leveringen' }));
    const items = await list.findAllByRole('button', { pressed: false });
    expect(items).toHaveLength(3);
    // The newest opens first: recorded, but its set failed.
    const opened = within(screen.getByRole('region', { name: 'De geopende levering' }));
    expect(opened.getByRole('heading', { name: 'Opgenomen, mislukt' })).toBeTruthy();
    expect(opened.getByText('De verwerking mislukte: The run has no catalog.json.')).toBeTruthy();
    expect(opened.getByText('De Current Version van immoscoop_dataplatform_sql blijft de vorige')).toBeTruthy();
    await fireEvent.click(opened.getByRole('button', { name: 'Opnieuw verwerken' }));
    expect(await opened.findByText('Data Hub haalt de run opnieuw op en verwerkt hem; de lijst toont hoe het liep.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/runs/58141207/reprocess' });

    // An ignored delivery says why, and what the Data Admin can do.
    await fireEvent.click(list.getByRole('button', { name: /^Genegeerd/ }));
    const ignored = within(screen.getByRole('region', { name: 'De geopende levering' }));
    expect(ignored.getByText('Deze job is geen Source Job van Data Hub uat.')).toBeTruthy();
    expect(ignored.getByText(/haal de job uit de webhook Data Hub uat in dbt Cloud/)).toBeTruthy();
    expect(ignored.queryByRole('button', { name: 'Opnieuw verwerken' })).toBeNull();

    // The filter shows one kind: a refused delivery reads nothing of the job or the run.
    await fireEvent.click(list.getByRole('radio', { name: 'Geweigerd 1' }));
    expect(list.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(list.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    const refused = within(screen.getByRole('region', { name: 'De geopende levering' }));
    expect(list.getByText('Onbekende afzender')).toBeTruthy();
    expect(refused.getByRole('heading', { name: 'Geweigerd' })).toBeTruthy();
    expect(refused.getByText('De handtekening past niet bij het geheim van Data Hub uat.')).toBeTruthy();
    expect(refused.getByText(/zet het in datahub-dbt-webhook-secret/)).toBeTruthy();
  });

  it('lists every Excel key with its User, finds one, and revokes it after asking; its User is told by identity (FR-PL-03, MSG-KEY-02)', async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString();
    const calls = serve({
      as: 'admin',
      settings: { language: 'en' },
      everyKey: [
        { id: 'k-1', name: 'Monthly KBC report', createdAt: '2026-09-02T08:00:00Z', lastUsedAt: '2026-10-31T08:12:00Z', expiresAt: later, revokedAt: null, revokedBy: null, revokedById: null, user: { id: 'an', name: 'An Claes', email: 'an.claes@immoscoop.be' } },
        { id: 'k-2', name: 'Sales dashboard, shared drive', createdAt: '2025-11-10T08:00:00Z', lastUsedAt: '2026-10-10T08:00:00Z', expiresAt: soon, revokedAt: null, revokedBy: null, revokedById: null, user: { id: 'karel', name: 'Karel Leys', email: 'karel.leys@immoscoop.be' } },
        { id: 'k-3', name: 'Old laptop', createdAt: '2026-01-20T08:00:00Z', lastUsedAt: '2026-08-31T08:00:00Z', expiresAt: '2027-01-20T08:00:00Z', revokedAt: '2026-09-02T08:00:00Z', revokedBy: 'Dirk Vos', revokedById: 'dirk', user: { id: 'dirk', name: 'Dirk Vos', email: 'dirk.vos@immoscoop.be' } },
      ],
    });
    open('/admin/keys');
    render(App, { config: UAT });
    expect(await screen.findByRole('heading', { level: 1, name: 'Excel keys' })).toBeTruthy();
    const table = within(await screen.findByRole('table', { name: 'Excel keys' }));
    // The active keys, newest last used on top; the revoked one only under Revoked.
    const rows = () => table.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(rows()[0]).toContain('Monthly KBC report');
    expect(rows()[1]).toContain('Sales dashboard, shared drive');
    expect(table.queryByText('Old laptop')).toBeNull();
    const panel = within(screen.getByRole('complementary', { name: 'Admin' }));
    await vi.waitFor(() => expect(panel.getByRole('link', { name: /Excel keys/ }).textContent).toContain('2'));

    await fireEvent.click(screen.getByRole('radio', { name: /Expiring within a month/ }));
    expect(rows()).toHaveLength(1);
    expect(table.getByText('Sales dashboard, shared drive').closest('tr')!.querySelector('.soon')).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: /Revoked/ }));
    expect(table.getByText(/^revoked 2 Sep.* by Dirk Vos$/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: /Active/ }));
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search a User or a key' }), { target: { value: 'karel' } });
    expect(rows()).toHaveLength(1);

    await fireEvent.click(table.getByRole('button', { name: 'Revoke' }));
    expect(table.getByText('Revoke “Sales dashboard, shared drive” of Karel Leys?')).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await fireEvent.click(table.getAllByRole('button', { name: 'Revoke' }).find((button) => button.closest('tr')?.classList.contains('confirm'))!);
    expect(calls).toContainEqual({ method: 'DELETE', path: '/excel-keys/k-2' });
    // It stays in its place, struck through, with who revoked it.
    await vi.waitFor(() => expect(table.getByText('Sales dashboard, shared drive').closest('tr')!.classList.contains('revoked')).toBe(true));
    expect(table.getByText('revoked today by you')).toBeTruthy();
    await vi.waitFor(() => expect(panel.getByRole('link', { name: /Excel keys/ }).textContent).toContain('1'));
  });
});

describe('the Permissions of the User (FR-PL-14)', () => {
  const UAT: Config = { ...CONFIG, environment: 'uat' };

  it('shows Admin to a User with admin.open, with only the tools chosen, and opens on the first of them', async () => {
    const permissions = structuredClone(STARTING_GROUPS.businessAnalyst.permissions);
    permissions['admin.open'] = { on: true, values: { tools: ['users'] } };
    serve({ permissions });
    open('/admin');
    render(App, { config: UAT });
    const rail = within(await screen.findByRole('navigation', { name: 'Hoofdnavigatie' }));
    expect(await rail.findByRole('link', { name: 'Admin' })).toBeTruthy();
    await vi.waitFor(() => expect(location.pathname).toBe('/admin/users'));
    const panel = within(screen.getByRole('complementary', { name: 'Admin' }));
    expect(panel.getByRole('link', { name: /Users/ }).getAttribute('aria-current')).toBe('page');
    expect(panel.queryByRole('link', { name: /Webhooks/ })).toBeNull();
    expect(panel.queryByRole('link', { name: /Excel keys/ })).toBeNull();
    expect(panel.queryByRole('link', { name: /Permission groups/ })).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeTruthy();
  });

  it('shows a tool of Admin that was not chosen as what may not be seen', async () => {
    const permissions = structuredClone(STARTING_GROUPS.businessAnalyst.permissions);
    permissions['admin.open'] = { on: true, values: { tools: ['users'] } };
    const calls = serve({ permissions });
    open('/admin/webhooks');
    render(App, { config: UAT });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    expect(calls.some((call) => call.path.startsWith('/admin/'))).toBe(false);
  });

  it('gives a Business analyst Query, and no Admin', async () => {
    serve();
    open('/collections');
    render(App, { config: CONFIG });
    const rail = within(await screen.findByRole('navigation', { name: 'Hoofdnavigatie' }));
    expect(rail.getByRole('link', { name: 'Query' })).toBeTruthy();
    expect(rail.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('gives a Lens user no Query: not in the rail, not at its address, not on the page of a Resource (DEC-PL-07)', async () => {
    serve({ as: 'lensUser' });
    open('/query');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    const rail = within(screen.getByRole('navigation', { name: 'Hoofdnavigatie' }));
    expect(rail.queryByRole('link', { name: 'Query' })).toBeNull();
    expect(rail.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(rail.getByRole('link', { name: 'Collections' })).toBeTruthy();
  });

  it('shows a Lens user a Resource without Query, Preview or a new Collection', async () => {
    serve({ as: 'lensUser' });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' })).toBeTruthy();
    expect(main.queryByRole('link', { name: /^Query$/ })).toBeNull();
    expect(main.queryByRole('tab', { name: 'Voorbeeld' })).toBeNull();
    expect(main.queryByRole('tab', { name: 'Geschiedenis' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nieuwe Collection' })).toBeNull();
  });

  it('reads the Permissions again when a service refuses for one the User no longer has (EC-PL-01)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/users');
    render(App, { config: UAT });
    await screen.findByRole('table', { name: 'Users' });
    const before = calls.filter((call) => call.path === '/me').length;
    // Another Admin took Users away meanwhile: identity refuses, with the Permission it takes.
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const path = input.replace(CONFIG.identityUrl, '');
      calls.push({ method: init.method ?? 'GET', path });
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (path === '/auth/token') return json({ access_token: 'renewed', expires_in: 3600 });
      if (path === '/me') return json({ ...ME, permissionGroup: { id: 'pg-businessAnalyst', name: 'Business analyst' }, permissions: STARTING_GROUPS.businessAnalyst.permissions });
      return json({ error: 'forbidden', message: 'admin.open', permission: 'admin.open' }, 403);
    });
    await fireEvent.click(screen.getByRole('table', { name: 'Users' }).querySelector('tr[aria-label="An Claes"]')!);
    const sheet = within(await screen.findByRole('dialog', { name: 'An Claes' }));
    await fireEvent.click(sheet.getByRole('radio', { name: /Business analyst/ }));
    await fireEvent.click(sheet.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls.filter((call) => call.path === '/me').length).toBe(before + 1));
    expect(await screen.findByText(/Data Hub weigerde dit: het vraagt de Permission “Admin openen”/)).toBeTruthy();
    const rail = within(screen.getByRole('navigation', { name: 'Hoofdnavigatie' }));
    await vi.waitFor(() => expect(rail.queryByRole('link', { name: 'Admin' })).toBeNull());
  });
});

describe('the flags the services send per object (FR-PL-14, DEC-PL-03)', () => {
  const ONLY_GAPS = { description: false, behaviour: false, pitfalls: false, availableSince: false, gaps: true, keyFields: false, entityMapping: false };

  it('lets a User describe a Resource only where catalogue says, and publish or deprecate it only as it says', async () => {
    serve({ groups: ['g1'], weekly: { canEdit: true, canDescribe: ONLY_GAPS, canPublish: false, canDeprecate: false, canAssign: false, canRemove: false } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    // Of its Owner Unit, yet not to publish: catalogue says so.
    expect(main.queryByRole('button', { name: /Publiceren/ })).toBeNull();
    expect(main.queryByRole('tab', { name: 'Gevarenzone' })).toBeNull();
    await fireEvent.click(main.getByRole('tab', { name: 'Beschrijving' }));
    expect(main.queryByRole('button', { name: 'Bewerken' })).toBeNull();
    await fireEvent.click(main.getByRole('tab', { name: 'Known Behaviour' }));
    expect(main.queryByRole('button', { name: 'Bewerken' })).toBeNull();
  });

  it('offers only the kinds of Message the User may write, and no reply where they may not (DEC-PL-04)', async () => {
    serve({ as: 'lensUser', writable: ['question', 'signal'], conversations: [{ ...QUESTION, subject: { kind: 'resource', id: 'r2', name: 'Weekly lead volume', collection: null, exists: true }, mayReply: false }] });
    open('/resources/r2/messages');
    render(App, { config: CONFIG });
    const sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    await vi.waitFor(() => expect(sheet.getAllByRole('radio').map((radio) => radio.textContent?.trim()).slice(0, 2)).toEqual(['Question', 'Signal']));
    expect(sheet.queryByRole('radio', { name: 'Remark' })).toBeNull();
    expect(await sheet.findByText('Will KBC follow-up be published this month?')).toBeTruthy();
    expect(sheet.queryByRole('button', { name: /Antwoorden/ })).toBeNull();
  });
});

describe('Users, in Admin', () => {
  const UAT: Config = { ...CONFIG, environment: 'uat' };
  const rowsOf = () => [...screen.getByRole('table', { name: 'Users' }).querySelectorAll('tbody tr')] as HTMLElement[];
  const row = (name: string) => screen.getByRole('table', { name: 'Users' }).querySelector(`tr[aria-label="${name}"]`) as HTMLElement;

  it('lists every User with their Permission group, Groups and use, found by a search and a filter (FR-PL-06)', async () => {
    serve({ as: 'admin' });
    open('/admin/users');
    render(App, { config: UAT });
    await screen.findByRole('table', { name: 'Users' });
    expect(screen.getByText(/Een nieuwe User krijgt/).textContent).toContain('Lens user, de standaard');
    // The last signed in on top; who can no longer sign in greyed.
    expect(rowsOf().map((one) => one.getAttribute('aria-label'))).toEqual(['Max Verstraete', 'An Claes', 'Elif Yilmaz', 'Bram De Smet']);
    expect(row('Max Verstraete').textContent).toContain('jij');
    expect(row('Max Verstraete').textContent).toContain('Admin');
    // Their Groups, by name, each the way to it on Groups (DEC-UX-200).
    expect(row('An Claes').textContent).toContain('Sales, Marketing');
    expect(within(row('An Claes')).getByRole('link', { name: 'Marketing' }).getAttribute('href')).toBe('/groups/g9');
    expect(row('Elif Yilmaz').textContent).toContain('nieuw');
    expect(row('Elif Yilmaz').textContent).toContain('de standaard');
    expect(row('Bram De Smet').classList.contains('gone')).toBe(true);
    expect(row('Bram De Smet').textContent).toContain('kan niet aanmelden');
    expect(within(row('Elif Yilmaz')).getByRole('img', { name: 'Niet in Claude' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('radio', { name: 'Lens user 2' }));
    expect(rowsOf().map((one) => one.getAttribute('aria-label'))).toEqual(['An Claes', 'Elif Yilmaz']);
    await fireEvent.click(screen.getByRole('radio', { name: 'Alle 4' }));
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Zoek een User op naam of adres' }), { target: { value: 'bram.desmet' } });
    expect(rowsOf().map((one) => one.getAttribute('aria-label'))).toEqual(['Bram De Smet']);
    const panel = within(screen.getByRole('complementary', { name: 'Admin' }));
    await vi.waitFor(() => expect(panel.getByRole('link', { name: /Users/ }).textContent).toContain('4'));
  });

  it('changes the Permission group of a User after showing what they gain and lose (FR-PL-07, FR-PL-11)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/users');
    render(App, { config: UAT });
    await screen.findByRole('table', { name: 'Users' });
    await fireEvent.click(row('An Claes'));
    let sheet = within(await screen.findByRole('dialog', { name: 'An Claes' }));
    expect(sheet.getByText('an.claes@immoscoop.be')).toBeTruthy();
    expect(sheet.getByText(/gewijzigd op Groups/).closest('dd')?.textContent).toContain('Sales, Marketing');
    expect(sheet.getByRole('link', { name: 'Sales' }).getAttribute('href')).toBe('/groups/g2');
    expect(await sheet.findByText('Van Business analyst naar Lens user, door Ruth Aerts')).toBeTruthy();
    expect(sheet.getByText('Business analyst, de standaard, bij hun eerste aanmelding')).toBeTruthy();
    expect(sheet.getByText('A change takes effect within 15 minutes, in the web app, in Claude and in Excel.'.length ? 'Een wijziging werkt binnen 15 minuten, in de webapp, in Claude en in Excel.' : '')).toBeTruthy();
    expect((sheet.getByRole('button', { name: 'Bewaren' }) as HTMLButtonElement).disabled).toBe(true);
    expect(sheet.getByRole('radio', { name: /Lens user/ }).closest('label')?.textContent).toContain('nu');

    // Another group: what changes shows before it is saved.
    await fireEvent.click(sheet.getByRole('radio', { name: /Business analyst/ }));
    expect(sheet.getByText('Wat er verandert voor An Claes')).toBeTruthy();
    const gains = [...document.querySelectorAll('.changes li.gain')].map((line) => line.textContent ?? '');
    expect(gains.some((line) => line.includes('Queries maken en uitvoeren'))).toBe(true);
    expect(gains.find((line) => line.includes('Hoe een resultaat Claude bereikt'))).toContain('In Claude: Claude leest de rijen en werkt ermee');
    expect(document.querySelectorAll('.changes li.loss')).toHaveLength(0);
    expect(document.querySelector('.changes li.stays')?.textContent).toContain('Hun Groups, en dus de Collections die ze bezitten, veranderen niet.');

    await fireEvent.click(sheet.getByRole('button', { name: 'Bewaren' }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/users/2/permission-group', body: { groupId: 'pg-businessAnalyst' } });
    expect(await screen.findByText('An Claes zit nu in Business analyst. Het werkt binnen 15 minuten.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'An Claes' })).toBeNull();
    expect(row('An Claes').textContent).toContain('Business analyst');
    expect(row('An Claes').textContent).toContain('door jou gewijzigd');

    // Back to Lens user: now they lose what they gained.
    await fireEvent.click(row('An Claes'));
    sheet = within(await screen.findByRole('dialog', { name: 'An Claes' }));
    await fireEvent.click(sheet.getByRole('radio', { name: /Lens user/ }));
    const losses = [...document.querySelectorAll('.changes li.loss')].map((line) => line.textContent ?? '');
    expect(losses.some((line) => line.includes('Queries maken en uitvoeren'))).toBe(true);
    const claude = losses.find((line) => line.includes('Hoe een resultaat Claude bereikt'));
    expect(claude).toContain('Enkel in een kaart');
    expect(document.querySelector('.changes li.loss del')).toBeTruthy();
  });

  it('keeps the own Permission group locked, with why (FR-PL-08)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/users');
    render(App, { config: UAT });
    await screen.findByRole('table', { name: 'Users' });
    await fireEvent.click(row('Max Verstraete'));
    const sheet = within(await screen.findByRole('dialog', { name: 'Max Verstraete' }));
    expect(sheet.getByText(/Je kan je eigen Permission group niet wijzigen, zodat niemand zichzelf per vergissing Admin afneemt/)).toBeTruthy();
    expect(sheet.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
    expect(sheet.queryByRole('button', { name: 'Bewaren' })).toBeNull();
    await fireEvent.click(sheet.getAllByRole('button', { name: 'Sluiten' }).at(-1)!);
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
  });

  it('says so when the last User of Admin would leave it (FR-PL-08)', async () => {
    serve({ as: 'admin', users: [{ ...MAX_USER, permissionGroup: { id: 'pg-businessAnalyst', name: 'Business analyst' } }, { ...AN_USER, permissionGroup: { id: 'pg-admin', name: 'Admin' } }] });
    open('/admin/users');
    render(App, { config: UAT });
    await screen.findByRole('table', { name: 'Users' });
    await fireEvent.click(row('An Claes'));
    const sheet = within(await screen.findByRole('dialog', { name: 'An Claes' }));
    await fireEvent.click(sheet.getByRole('radio', { name: /Lens user/ }));
    await fireEvent.click(sheet.getByRole('button', { name: 'Bewaren' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Admin houdt minstens één User, zodat iemand Data Hub altijd kan beheren, en dit is de laatste. Geef eerst een andere User Admin.');
    expect(screen.getByRole('dialog', { name: 'An Claes' })).toBeTruthy();
  });
});

describe('Permission groups, in Admin', () => {
  const UAT: Config = { ...CONFIG, environment: 'uat' };
  const opened = () => within(screen.getByRole('region', { name: 'De geopende Permission group' }));

  it('shows a group with its Permissions by part, its values while yes, and saves every change at once (FR-PL-05, FR-PL-09)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    const list = within(await screen.findByRole('region', { name: 'Permission groups' }));
    expect(list.getByRole('button', { name: /^Lens user/ }).textContent).toContain('Standaard voor nieuwe Users');
    await fireEvent.click(list.getByRole('button', { name: /^Lens user/ }));
    expect(opened().getByRole('heading', { level: 2, name: 'Lens user' })).toBeTruthy();
    expect(opened().getAllByRole('region').map((part) => part.getAttribute('aria-label'))).toEqual(['Collections en Resources', 'Groups', 'Query', 'Lenses', 'Berichten', 'Claude, via de MCP', 'Excel', 'Admin']);
    expect(screen.queryByText(/nog niet bewaard/)).toBeNull();

    // Yes shows its values; the change is marked and counted.
    const manage = opened().getByRole('radiogroup', { name: 'Collections beheren' });
    expect(opened().queryByRole('radiogroup', { name: 'Welke Collections' })).toBeNull();
    await fireEvent.click(within(manage).getByRole('radio', { name: 'Ja' }));
    expect(within(opened().getByRole('radiogroup', { name: 'Welke Collections' })).getAllByRole('radio')).toHaveLength(2);
    expect(manage.closest('.permission')?.textContent).toContain('gewijzigd');
    expect(screen.getByText(/1 wijziging, nog niet bewaard\. Bewaard werkt ze binnen 15 minuten voor de 2 Users van Lens user\./)).toBeTruthy();
    await fireEvent.input(opened().getByRole('spinbutton', { name: 'Hoogstens zoveel keys' }), { target: { value: '5' } });
    expect(screen.getByText(/2 wijzigingen, nog niet bewaard/)).toBeTruthy();
    expect(opened().getByText('was geen grens')).toBeTruthy();
    expect(list.getByRole('button', { name: /^Lens user/ }).textContent).toContain('2 wijzigingen');

    await fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/permission-groups/pg-lensUser');
    const sent = (patch?.body as { permissions: Permissions }).permissions;
    expect(sent['collections.manage']).toEqual({ on: true, values: { reach: 'theirs' } });
    expect(sent['excel.keys'].values.most).toBe(5);
    expect(sent['queries.make'].on).toBe(false);
    await vi.waitFor(() => expect(screen.queryByText(/nog niet bewaard/)).toBeNull());
  });

  it('discards the changes not saved', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    await screen.findByRole('region', { name: 'De geopende Permission group' });
    await fireEvent.click(within(opened().getByRole('radiogroup', { name: 'Over aanvragen beslissen' })).getByRole('radio', { name: 'Ja' }));
    expect(screen.getByText(/1 wijziging, nog niet bewaard/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Verwerpen' }));
    expect(screen.queryByText(/nog niet bewaard/)).toBeNull();
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('shows Admin locked: every Permission at its widest, never changed, never deleted (FR-PL-08)', async () => {
    serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    const list = within(await screen.findByRole('region', { name: 'Permission groups' }));
    await fireEvent.click(list.getByRole('button', { name: /^Admin/ }));
    expect(opened().getByText(/Admin kan alles, en houdt dat/)).toBeTruthy();
    expect(opened().queryAllByRole('radio')).toHaveLength(0);
    expect(opened().queryByRole('button', { name: 'Admin' })).toBeNull();
    expect(opened().getAllByText('Ja').length).toBeGreaterThan(10);
    expect(opened().queryByRole('button', { name: /verwijderen/ })).toBeNull();
    expect(opened().getByRole('button', { name: /Dupliceren/ })).toBeTruthy();
  });

  it('deletes a group, its Users going to the group chosen, which becomes the default (FR-PL-10)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    const list = within(await screen.findByRole('region', { name: 'Permission groups' }));
    await fireEvent.click(list.getByRole('button', { name: /^Lens user/ }));
    await fireEvent.click(opened().getByRole('button', { name: 'Lens user verwijderen…' }));
    expect(opened().getByText('Lens user verwijderen?')).toBeTruthy();
    const where = within(opened().getByRole('radiogroup', { name: 'Waar zijn Users naartoe gaan' }));
    expect((where.getByRole('radio', { name: /Admin: Users komen er één voor één bij/ }) as HTMLInputElement).disabled).toBe(true);
    expect((where.getByRole('radio', { name: /^Business analyst/ }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(opened().getByRole('button', { name: 'Verwijder en verplaats 2 Users' }));
    expect(calls).toContainEqual({ method: 'DELETE', path: '/permission-groups/pg-lensUser', body: { moveTo: 'pg-businessAnalyst' } });
    await vi.waitFor(() => expect(list.queryByRole('button', { name: /^Lens user/ })).toBeNull());
    expect(list.getByRole('button', { name: /^Business analyst/ }).textContent).toContain('Standaard voor nieuwe Users');
    expect(opened().getByRole('heading', { level: 2, name: 'Business analyst' })).toBeTruthy();
  });

  it('makes a new group as a copy of another, without Users (FR-PL-10)', async () => {
    const calls = serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    await screen.findByRole('region', { name: 'De geopende Permission group' });
    await fireEvent.click(screen.getByRole('button', { name: 'Nieuwe Permission group' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Nieuwe Permission group' }));
    expect(sheet.getByText('Ze begint zonder Users. Voeg ze toe op Users, één voor één.')).toBeTruthy();
    await fireEvent.input(sheet.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Sales leads' } });
    await fireEvent.input(sheet.getByRole('textbox', { name: 'In één zin, wat ze toelaat' }), { target: { value: 'Lenses on leads' } });
    await fireEvent.click(sheet.getByRole('radio', { name: /^Lens user/ }));
    await fireEvent.click(sheet.getByRole('button', { name: 'Maak ze' }));
    expect(calls).toContainEqual({ method: 'POST', path: '/permission-groups', body: { name: 'Sales leads', sentence: 'Lenses on leads', from: 'pg-lensUser' } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sales leads' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Nieuwe Permission group' })).toBeNull();
  });

  it('leads from a group to its Users, filtered on it', async () => {
    serve({ as: 'admin' });
    open('/admin/permission-groups');
    render(App, { config: UAT });
    const list = within(await screen.findByRole('region', { name: 'Permission groups' }));
    await fireEvent.click(list.getByRole('button', { name: /^Lens user/ }));
    await fireEvent.click(opened().getByRole('link', { name: 'bekijk ze op Users' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/admin/users'));
    await screen.findByRole('table', { name: 'Users' });
    expect((screen.getByRole('radio', { name: 'Lens user 2' }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
    expect(rowsOf().map((one) => one.getAttribute('aria-label'))).toEqual(['An Claes', 'Elif Yilmaz']);
  });

  const rowsOf = () => [...screen.getByRole('table', { name: 'Users' }).querySelectorAll('tbody tr')] as HTMLElement[];
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

    // All or Yours is the first choice of the filter next to the search (DEC-UX-161).
    const filter = panel.getByRole('button', { name: /^Filter/ });
    await fireEvent.click(filter);
    await fireEvent.click(panel.getByRole('radio', { name: /^Van jou/ }));
    expect(panel.queryByRole('link', { name: /Listings/ })).toBeNull();
    expect(panel.getByRole('link', { name: /Credit leads/ })).toBeTruthy();
    await fireEvent.click(filter);
    expect(panel.getByText('Welke Collections:')).toBeTruthy();
    await fireEvent.click(panel.getByRole('button', { name: 'Terug naar Alle' }));
    expect(panel.getByRole('link', { name: /Listings/ })).toBeTruthy();
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
    // The head shows who owns it and who sees it, not how many Resources it holds nor when it was made (DEC-UX-145).
    expect(main.queryByText(/^Aangemaakt op/)).toBeNull();
    expect(main.queryByText(/^\d+ Resources?$/)).toBeNull();
    expect(main.getByRole('region', { name: 'Vraagt aandacht' }).textContent).toContain(
      '1 Resource is nog niet gepubliceerd: Weekly lead volume. Tot de Owner hem publiceert, zien enkel Data en het Data Team hem.',
    );
    const row = within(main.getByRole('table', { name: 'Resources' })).getByRole('link', { name: /Weekly lead volume/ }).closest('tr')!;
    expect(row.textContent).toContain('2 · Described');
    expect(row.textContent).toContain('Toegevoegd aan de Collection Credit leads door Dirk Vos');
    expect(main.getByText('Collection aangemaakt door An Claes')).toBeTruthy();
    expect(document.title).toBe('local · Data Hub — Credit leads');
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
      body: { name: 'Search behaviour', description: 'What visitors search for.', icon: 'binoculars', ownerUnit: 'g1', visibility: 'public', intro: '' },
    });
  });

  it('edits a Collection in place, and sends only what changed (FR-CO-30)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Alles bewerken/ }));
    // Only Groups the User is in, by name, with the way to Groups where they are kept (DEC-UX-200).
    const groupsLink = main.getByRole('link', { name: 'Groups' });
    expect(groupsLink.getAttribute('href')).toBe('/groups');
    expect(groupsLink.parentElement?.textContent).toBe('Enkel Groups waar je zelf in zit, bijgehouden in Data Hub op Groups. De Owner Unit staat in voor de Resources van de Collection.');
    expect([...(main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(['Data']);
    // It still holds a Resource, so it cannot be dissolved (FR-CO-10).
    expect((main.getByRole('button', { name: 'Opheffen' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(main.getByRole('textbox', { name: /Beschrijving/ }), { target: { value: 'Every credit lead.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1', body: { description: 'Every credit lead.' } }));
  });

  it('changes the name or description of a Collection with a click on it, as a query does, and only for who may (DEC-UX-162)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const heading = await main.findByRole('heading', { level: 1, name: 'Credit leads' });
    await fireEvent.click(within(heading).getByRole('button'));
    // Both turn into fields; only what changed is sent.
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Credit leads in' } });
    expect(main.getByRole('textbox', { name: 'Beschrijving' })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1', body: { name: 'Credit leads in' } }));
    expect(await main.findByRole('heading', { level: 1, name: 'Credit leads in' })).toBeTruthy();
    // An empty description is not saved: a Collection keeps one.
    await fireEvent.click(within(main.getByRole('heading', { level: 1, name: 'Credit leads in' })).getByRole('button'));
    await fireEvent.input(main.getByRole('textbox', { name: 'Beschrijving' }), { target: { value: ' ' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    expect(await main.findByRole('alert')).toBeTruthy();
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
  });

  it('shows a colleague the name and description of a Collection as plain text (DEC-UX-162)', async () => {
    serve({ creditWith: { canManage: false } });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const heading = await main.findByRole('heading', { level: 1, name: 'Credit leads' });
    expect(within(heading).queryByRole('button')).toBeNull();
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
    // Its Summary says what it is and how to query it cheaply (FR-RC-19).
    expect(main.getByText('One row per week and lead source.')).toBeTruthy();
    expect(main.getByText(/Filter eerst op week_start/)).toBeTruthy();
    // Querying, a part of its own: its size and partitions, from BigQuery (FR-SR-39).
    await fireEvent.click(main.getByRole('tab', { name: 'Bevragen' }));
    expect(main.getByText(/op week_start, een partitie per dag/)).toBeTruthy();
    expect(await main.findByText(/312 partities/)).toBeTruthy();
    expect(main.getByText('6,2 GB in totaal, ongeveer 20 MB per dag')).toBeTruthy();
    // Its tile takes the width of the part.
    expect(main.getByText('Partities en clustering').closest('section')?.getAttribute('style')).toContain('grid-column: 1 / -1');
    const tabs = within(main.getByRole('tablist', { name: 'Weekly lead volume' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Overzicht', 'Kolommen', 'Lineage', 'Geschiedenis', 'Voorbeeld']);
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
    const tabs = within(other.getByRole('tablist', { name: 'Weekly lead volume' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Overzicht', 'Kolommen', 'Lineage', 'Voorbeeld']);
  });

  it('lets its Owner edit what Data Hub keeps about it in place, and the fields (FR-RC-15, FR-RC-16)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    // Each part is edited on its own page: the Business Description in Markdown (FR-RC-20).
    await fireEvent.click(main.getByRole('tab', { name: 'Beschrijving' }));
    await fireEvent.click(main.getByRole('button', { name: 'Voeg een Business Description toe' }));
    expect(main.getByRole('toolbar', { name: /Business Description/ })).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: 'Business Description' }), { target: { value: 'The credit leads **we send** to KBC.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/resources/r2', body: { businessDescription: 'The credit leads **we send** to KBC.' } }));
    expect((await main.findByText('we send')).tagName).toBe('STRONG');
    await fireEvent.click(main.getByRole('tab', { name: 'Known Behaviour' }));
    await fireEvent.click(main.getByRole('button', { name: /Bewerken/ }));
    // Intended use and pitfalls are Markdown too, each in the Markdown editor (FR-RC-23).
    expect(main.getByRole('toolbar', { name: /Beoogd gebruik/ })).toBeTruthy();
    expect(main.getByRole('toolbar', { name: /Valkuilen/ })).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: 'Beoogd gebruik' }), { target: { value: 'Weekly **trends**.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/resources/r2', body: { intendedUse: 'Weekly **trends**.', pitfalls: '', reliableSince: null } }));
    expect((await main.findByText('trends')).tagName).toBe('STRONG');

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

  it('opens its Overview on the Summary: every part in the order to read it, with its weight and the curated Q&A (FR-RC-19, FR-RC-22, DEC-RC-17, DEC-RC-18)', async () => {
    const on = { kind: 'resource', id: 'r2', name: 'Weekly lead volume', collection: { id: 'c1', name: 'Credit leads' }, exists: true };
    const said = (id: string, kind: string, name: string, as: string | null, text: string, state: string | null, replies: unknown[] = []) => ({
      id,
      type: 'MSG-CNV-01',
      kind,
      subject: on,
      writer: { id, name, as },
      params: { text, writer: name },
      state,
      createdAt: '2026-10-28T10:00:00Z',
      lastAt: '2026-10-28T10:00:00Z',
      replies,
      replyCount: replies.length,
    });
    const answer = { id: 'a1', type: 'MSG-CNV-02', kind: 'reply', writer: { id: '1', name: 'Max Verstraete', as: 'owner' }, params: { text: 'Partner leads come in from 2024.' }, createdAt: '2026-10-29T08:00:00Z', mine: true };
    serve({
      groups: ['g1'],
      conversations: [
        said('m10', 'remark', 'Karel Peeters', null, 'Handy for the weekly review.', null),
        said('m11', 'question', 'Ruth Aerts', null, 'Why no partner leads in 2023?', 'answered', [answer]),
        said('m12', 'signal', 'Ines Claes', null, 'Zero app leads last week.', 'open'),
      ],
    });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const parts = within(await main.findByRole('tablist', { name: 'Delen van het Overzicht' }));
    expect(parts.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false']);
    // Its parts in the order to read them, each with its weight; a part with nothing in it is left out.
    const summary = within(main.getByRole('tabpanel', { name: 'Samenvatting' }));
    await summary.findByText('Zero app leads last week.', { exact: false });
    const read = summary.getAllByRole('listitem').filter((item) => item.querySelector('h3'));
    expect(read.map((item) => [item.querySelector('.number')?.textContent, item.querySelector('h3')?.textContent, item.querySelector('.side .weight')?.textContent])).toEqual([
      ['1', 'Wat het is', 'Eerst lezen'],
      ['2', 'Hoe je het goedkoop bevraagt', 'Voor je bevraagt'],
      ['3', 'De velden', 'Voor je bevraagt'],
      ['4', 'Q&A van de Owner en het Data Team', 'Bij het interpreteren'],
      ['5', 'Waar het staat', 'Context'],
      ['6', 'Wat collega’s opmerkten', 'Context'],
    ]);
    // The Q&A: the open Signal first, then what the Owner answered; what no one answered yet is Context.
    const qa = within(read[3]!).getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(qa).toHaveLength(2);
    expect(qa[0]).toContain('Zero app leads last week.');
    expect(qa[1]).toContain('Why no partner leads in 2023?');
    expect(qa[1]).toContain('Partner leads come in from 2024.');
    expect(within(read[5]!).getByText(/Handy for the weekly review\./)).toBeTruthy();
    expect(within(read[3]!).getByRole('link', { name: /Berichten/ }).getAttribute('href')).toBe('/resources/r2/messages');
    // Each part leads to where it comes from.
    await fireEvent.click(within(read[1]!).getByRole('button', { name: /Bevragen/ }));
    expect(parts.getByRole('tab', { name: 'Bevragen' }).getAttribute('aria-selected')).toBe('true');
  });

  it('goes straight to what its Owner Unit fills in from the quick window: a Known Gap, the intended use, a key field (DEC-UX-258)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('tab', { name: /^Known Gaps/ }, { timeout: 3000 });
    await quickDo('een known gap toevoegen');
    const adding = within(await main.findByRole('form', { name: 'Een nieuwe Known Gap' }));
    await vi.waitFor(() => expect(document.activeElement).toBe(adding.getByRole('textbox', { name: WHY })));
    await quickDo('het beoogde gebruik bijwerken');
    await vi.waitFor(() => expect((document.activeElement as HTMLElement | null)?.id).toBe('intended-use'));
    await fireEvent.click(main.getByRole('button', { name: 'Annuleren' }));
    await quickDo('een sleutelveld toevoegen');
    await vi.waitFor(() => expect((document.activeElement as HTMLElement | null)?.getAttribute('data-pick')).toBe('keyFields'));
  });

  it('lets its Owner Unit add, change and remove a Known Gap one at a time, with who added it (FR-RC-21)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('tab', { name: /^Known Gaps/ }));
    expect(main.getByText('Geen Known Gaps vastgelegd.')).toBeTruthy();
    // The line at the bottom opens the form; its why is plain text, and it holds everywhere until narrowed down.
    await fireEvent.click(main.getByRole('button', { name: /^Voeg een Known Gap toe/ }));
    const adding = within(main.getByRole('form', { name: 'Een nieuwe Known Gap' }));
    expect((adding.getByRole('button', { name: 'Voeg toe' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(adding.getByRole('textbox', { name: WHY }), { target: { value: 'No partner leads before 2024.' } });
    await fireEvent.click(adding.getByRole('button', { name: 'Voeg toe' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/gaps', body: { text: 'No partner leads before 2024.', scope: null } }));
    expect(await main.findByText('No partner leads before 2024.')).toBeTruthy();
    expect(main.queryByRole('form', { name: 'Een nieuwe Known Gap' })).toBeNull();
    expect(main.getByText('Toegevoegd door Max Verstraete · 4 nov 2026')).toBeTruthy();
    expect(main.getByRole('tab', { name: /^Known Gaps/ }).textContent).toContain('1');
    await fireEvent.click(main.getByRole('button', { name: 'Wijzig deze Known Gap' }));
    const changing = within(main.getByRole('form', { name: 'Wijzig deze Known Gap' }));
    await fireEvent.input(changing.getByRole('textbox', { name: WHY }), { target: { value: 'No partner leads before March 2024.' } });
    await fireEvent.click(changing.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/resources/r2/gaps/gap-1', body: { text: 'No partner leads before March 2024.', scope: null } }));
    expect(await main.findByText('No partner leads before March 2024.')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Verwijder deze Known Gap' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/gaps/gap-1' }));
    expect(await main.findByText('Geen Known Gaps vastgelegd.')).toBeTruthy();
  });

  it('narrows a Known Gap down to a period, fields and rows, shown as chips, in the Summary and on its fields (FR-RC-24, FR-RC-25, FR-RC-26)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('tab', { name: /^Known Gaps/ }));
    await fireEvent.click(main.getByRole('button', { name: /^Voeg een Known Gap toe/ }));
    const form = within(main.getByRole('form', { name: 'Een nieuwe Known Gap' }));
    await fireEvent.input(form.getByRole('textbox', { name: WHY }), { target: { value: 'No partner leads before March 2024.' } });
    // A period is a from and a to, with no field of its own (DEC-UX-178); it needs a start, an end or both.
    await fireEvent.click(form.getByRole('button', { name: 'Periode' }));
    expect(form.queryByRole('combobox', { name: 'Op het veld' })).toBeNull();
    expect(form.getByRole('status').textContent).toBe('Een periode heeft een begin, een einde of beide.');
    expect((form.getByRole('button', { name: 'Voeg toe' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(form.getByLabelText('Tot'), { target: { value: '2024-02-29' } });
    // Fields, chosen from the Resource.
    await fireEvent.click(form.getByRole('button', { name: 'Velden' }));
    await fireEvent.change(form.getByRole('combobox', { name: 'Voeg een veld toe' }), { target: { value: 'lead_source' } });
    // Rows: a field with one of some values, typed.
    await fireEvent.click(form.getByRole('button', { name: 'Rijen' }));
    await fireEvent.change(form.getByRole('combobox', { name: 'Veld' }), { target: { value: 'lead_source' } });
    expect(form.getByRole('status').textContent).toBe('Voeg minstens één waarde toe, of kies leeg.');
    await fireEvent.input(form.getByRole('textbox', { name: 'Voeg een waarde toe' }), { target: { value: 'partner' } });
    await fireEvent.keyDown(form.getByRole('textbox', { name: 'Voeg een waarde toe' }), { key: 'Enter' });
    expect(form.getByRole('button', { name: 'Verwijder partner' })).toBeTruthy();
    // Each kind goes with its ×, and comes back with its button.
    await fireEvent.click(form.getByRole('button', { name: 'Verwijder de velden' }));
    expect(form.queryByRole('region', { name: 'Velden' })).toBeNull();
    await fireEvent.click(form.getByRole('button', { name: 'Velden' }));
    await fireEvent.change(form.getByRole('combobox', { name: 'Voeg een veld toe' }), { target: { value: 'lead_source' } });
    await fireEvent.click(form.getByRole('button', { name: 'Voeg toe' }));
    const scope = { period: { from: null, to: '2024-02-29' }, fields: ['lead_source'], rows: { field: 'lead_source', is: 'oneOf', values: ['partner'] } };
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/gaps', body: { text: 'No partner leads before March 2024.', scope } }));
    // On its line, where it holds as chips.
    const line = (await main.findByText('No partner leads before March 2024.')).closest('li')!;
    expect(line.textContent).toContain('Periode tot 29 feb 2024');
    expect(line.textContent).not.toContain('week_start');
    expect(line.textContent).toContain('Velden lead_source');
    expect(line.textContent).toContain('Rijen lead_source is partner');
    // Changing it keeps its scope, and can take a kind away.
    await fireEvent.click(main.getByRole('button', { name: 'Wijzig deze Known Gap' }));
    const changing = within(main.getByRole('form', { name: 'Wijzig deze Known Gap' }));
    expect((changing.getByLabelText('Tot') as HTMLInputElement).value).toBe('2024-02-29');
    await fireEvent.click(changing.getByRole('button', { name: 'Verwijder de rijen' }));
    await fireEvent.click(changing.getByRole('button', { name: 'Bewaren' }));
    const narrower = { period: scope.period, fields: scope.fields };
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/resources/r2/gaps/gap-1', body: { text: 'No partner leads before March 2024.', scope: narrower } }));
    // In the Summary, as a line under its text.
    await fireEvent.click(main.getByRole('tab', { name: /^Samenvatting/ }));
    const summary = within(main.getByRole('tabpanel', { name: 'Samenvatting' }));
    const inSummary = (await summary.findByText('No partner leads before March 2024.', { exact: false })).textContent;
    expect(inSummary).toContain('tot 29 feb 2024');
    expect(inSummary).not.toContain('week_start');
    // On the field it names, under Columns, with the way back to it.
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    const marker = main.getByRole('button', { name: 'Known Gap' });
    expect(marker.closest('tr')?.textContent).toContain('lead_source');
    expect(marker.getAttribute('title')).toBe('Known Gap: No partner leads before March 2024. (tot 29 feb 2024 · velden lead_source)');
    await fireEvent.click(marker);
    expect(main.getByRole('tab', { name: /^Known Gaps/ }).getAttribute('aria-selected')).toBe('true');
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
    expect(main.getByText(/gepubliceerd op 28 okt 2026 door Max Verstraete/)).toBeTruthy();
    await fireEvent.click(main.getByRole('tab', { name: 'Maturiteit' }));
    expect(main.getByText('Gepubliceerd op 28 okt 2026 door Max Verstraete, zijn eerste Confirmation; laatst bevestigd op 28 okt 2026 door Max Verstraete.')).toBeTruthy();
    expect(main.queryByText('Publicatie')).toBeNull();
  });

  it('warns everyone of a change since its last Confirmation, until its Owner Unit marks it seen (FR-MR-12, DEC-UX-64)', async () => {
    const calls = serve({
      groups: ['g1'],
      weekly: { published: true, level: 3, changes: [{ field: 'week_start', change: 'added', old: null, new: 'DATE', at: '2026-10-27T08:00:00Z' }] },
    });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // The warning on top, and its Summary, under where it stands.
    const [warning, ...summary] = await main.findAllByText(/het veld week_start werd toegevoegd op 27 okt 2026/);
    expect(warning?.textContent).toContain('Het Level blijft 3 · Confirmed; de Owner is verwittigd.');
    expect(summary).toHaveLength(1);
    expect(main.getByRole('img', { name: 'Gewijzigd sinds de laatste Confirmation' })).toBeTruthy();
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    expect(main.getByText('Nieuw')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /^Markeer als gezien/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/resources/r2/changes/seen' }));
    await vi.waitFor(() => expect(main.queryAllByText(/het veld week_start werd toegevoegd/)).toHaveLength(0));
  });

  it('lets its Owner Unit deprecate it once published in the Danger zone, which explains it first, and take that away (FR-SR-50, DEC-UX-176)', async () => {
    const calls = serve({ groups: ['g1'], weekly: { published: true, level: 3 } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    // No longer in the header: in the Danger zone, the last part of its Overview.
    expect(main.queryByRole('button', { name: /Als deprecated markeren/ })).toBeNull();
    await fireEvent.click(main.getByRole('tab', { name: 'Gevarenzone' }));
    const danger = within(main.getByRole('tabpanel', { name: 'Gevarenzone' }));
    expect(danger.getByText(/Niets wordt verborgen of geblokkeerd/)).toBeTruthy();
    const button = danger.getByRole('button', { name: /Als deprecated markeren/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await fireEvent.input(danger.getByRole('textbox', { name: 'Waarom hij deprecated is' }), { target: { value: 'Replaced by the figures with partner leads' } });
    await fireEvent.click(button);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/resources/r2/deprecation', body: { reason: 'Replaced by the figures with partner leads', insteadOf: null } }));
    expect(await main.findAllByText(/door Max Verstraete op 28 okt 2026: Replaced by the figures with partner leads\./)).toHaveLength(2);
    expect(main.getByText('Deprecated', { selector: '.chip' })).toBeTruthy();
    // The line on top leads back to it, from any tab.
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    await fireEvent.click(main.getByRole('button', { name: 'Gevarenzone' }));
    expect(main.getByRole('tab', { name: 'Gevarenzone' }).getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(within(main.getByRole('tabpanel', { name: 'Gevarenzone' })).getByRole('button', { name: /Wegnemen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/deprecation' }));
    await vi.waitFor(() => expect(main.queryByText(/Replaced by the figures/)).toBeNull());
  });

  it('lets a Data Admin take it out of its Collection in the Danger zone, explained first (DEC-UX-212)', async () => {
    const calls = serve({ as: 'admin' });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Gevarenzone' }));
    const danger = within(main.getByRole('tabpanel', { name: 'Gevarenzone' }));
    expect(danger.getByRole('heading', { name: 'Uit de Collection halen' })).toBeTruthy();
    expect(danger.getByText(/Haal Weekly lead volume uit Credit leads/)).toBeTruthy();
    expect(danger.getByText(/Alleen het Data Team ziet hem nog, onder Zonder Collection/)).toBeTruthy();
    await fireEvent.click(danger.getByRole('button', { name: /Uit Credit leads halen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/collection' }));
    // Out of its Collection, the button has done its work.
    await vi.waitFor(() => expect(danger.queryByRole('button', { name: /Uit Credit leads halen/ })).toBeNull());
  });

  it('shows each identity in full, the Entity with its identifier, in Entities and Columns (DEC-UX-216)', async () => {
    const mapping = { field: 'lead_source', kind: 'is', relationType: null, identity: 'leadSource.leadSourceId', subject: null, origin: 'name', inDomainModel: true };
    serve({
      groups: ['g1'],
      weekly: { details: { ...WEEKLY_DETAIL.details, mappings: [mapping] } },
      related: [{ ...mapping, resources: [{ id: 'r9', displayName: 'Lead sources', level: 3, field: 'lead_source_id' }] }],
    });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Entities' }));
    const entities = within(main.getByRole('tabpanel', { name: 'Entities' }));
    expect(await entities.findByText('leadSource.leadSourceId')).toBeTruthy();
    await fireEvent.click(main.getByRole('tab', { name: 'Kolommen' }));
    expect(await main.findByText('leadSource.leadSourceId')).toBeTruthy();
  });

  it('keeps its Danger zone from who is not in its Owner Unit or the Data Team (DEC-UX-176)', async () => {
    serve({ groups: [], weekly: { published: true, level: 3, collectionId: 'c2' } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    expect(main.queryByRole('tab', { name: 'Gevarenzone' })).toBeNull();
  });

  it('lets a Data Admin change its grain and relations with Edit relations (DEC-UX-107)', async () => {
    const calls = serve({ as: 'admin' });
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

  it('walks its lineage one step at a time, the Resource in the middle, on a canvas that pans and zooms (FR-SR-54, DEC-UX-100, DEC-UX-152)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Lineage' }));
    // The canvas loads when the tab opens.
    const upstream = await main.findByRole('button', { name: /int_leads/ }, { timeout: 5000 });
    expect(main.getByText('lead_share')).toBeTruthy();
    expect(main.getByRole('button', { name: 'Inzoomen' })).toBeTruthy();
    const edges = () => [...document.querySelectorAll('.svelte-flow__edge')];
    expect(edges().length).toBeGreaterThan(0);
    expect(edges().filter((edge) => edge.classList.contains('on'))).toHaveLength(0);
    // Only its direct models at first; a click adds what is next to it, a column further out.
    expect(main.queryByText('stg_leads')).toBeNull();
    await fireEvent.click(upstream);
    expect(upstream.getAttribute('aria-expanded')).toBe('true');
    expect(main.getByText('stg_leads')).toBeTruthy();
    // The curve to the open model is marked.
    await vi.waitFor(() => expect(edges().filter((edge) => edge.classList.contains('on'))).toHaveLength(1));
    await fireEvent.click(main.getByRole('button', { name: /Terug naar zijn directe modellen/ }));
    expect(main.queryByText('stg_leads')).toBeNull();
  });
});

describe('Groups, kept in Data Hub (FR-UM-12 to FR-UM-19)', () => {
  const opened = () => within(screen.getByRole('region', { name: 'De geopende Group' }));
  /** The Group opened, once it is read. */
  const ready = () => screen.findByRole('region', { name: 'De geopende Group' });
  const list = () => within(screen.getByRole('region', { name: 'Groups' }));
  const fact = (label: string) => [...opened().getAllByRole('definition')].find((dd) => dd.previousElementSibling?.textContent === label)?.textContent?.replace(/\s+/g, ' ').trim();

  it('puts the cursor in the search of Groups when the quick window goes there (DEC-UX-256)', async () => {
    serve({ world: groupWorld() });
    open('/me');
    render(App, { config: CONFIG });
    await screen.findByRole('heading', { level: 1 }, { timeout: 3000 });
    await quickDo('groups');
    await vi.waitFor(() => expect(location.pathname).toBe('/groups'));
    await vi.waitFor(() => expect((document.activeElement as HTMLInputElement | null)?.getAttribute('type')).toBe('search'), { timeout: 3000 });
    expect(document.activeElement?.closest('main')).toBeTruthy();
  });

  it('lists the Groups the User is in or manages, each with a tag, and opens the first, which they manage (FR-UM-18)', async () => {
    const calls = serve({ world: groupWorld() });
    open('/groups');
    render(App, { config: CONFIG });
    await screen.findByRole('heading', { level: 1, name: 'Groups' });
    expect(within(screen.getByRole('navigation', { name: 'Waar je bent' })).getByRole('link', { name: 'Mijn pagina' }).getAttribute('href')).toBe('/me');
    await vi.waitFor(() => expect(list().getAllByRole('link').map((link) => link.querySelector('b')?.textContent)).toEqual(['Broker team', 'Marketing', 'Sales management']));
    expect(list().getByRole('link', { name: /^Broker team/ }).textContent).toContain('Bezit nog niets · 3 leden');
    expect(list().getByRole('link', { name: /^Broker team/ }).textContent).toContain('Je beheert hem, via Sales management');
    expect(list().getByRole('link', { name: /^Marketing/ }).textContent).toContain('Je zit erin');
    expect(list().getByRole('link', { name: /^Sales management/ }).textContent).toContain('Beheert Broker team · 2 leden');
    expect(list().getByRole('link', { name: /^Sales management/ }).textContent).toContain('Hij beheert zichzelf');
    // Every Group is no choice without Manage every group.
    expect(screen.queryByRole('radiogroup', { name: 'Welke Groups' })).toBeNull();

    await ready();
    expect(await opened().findByRole('button', { name: 'Broker team' })).toBeTruthy();
    expect(fact('Beheerd door')).toBe('Sales management · je zit erin, dus jij beheert Broker team');
    expect(fact('Owner Unit van')).toBe('geen Collection');
    expect(fact('Beheert')).toBe('geen andere Group');
    expect(opened().getByText('Bram De Smet').closest('.member')?.classList.contains('gone')).toBe(true);
    expect(opened().getByText('Elif Yilmaz en Karel Leys toegevoegd, door jou')).toBeTruthy();
    expect(opened().getByText('Gemaakt door jou, beheerd door Sales management')).toBeTruthy();
    // The search finds a Group by a colleague in it.
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Zoek een Group, of een collega in een Group' }), { target: { value: 'elif' } });
    await vi.waitFor(() => expect(list().getAllByRole('link').map((link) => link.querySelector('b')?.textContent)).toEqual(['Broker team']));
    expect(calls).toContainEqual({ method: 'GET', path: '/owner-units/g-br/collections' });
  });

  it('adds a colleague suggested while typing, takes one out, and refuses an address of another domain (FR-UM-15)', async () => {
    const calls = serve({ world: groupWorld() });
    open('/groups/g-br');
    render(App, { config: CONFIG });
    await ready();
    const field = await opened().findByRole('textbox', { name: 'Voeg een collega toe, op naam of adres' });
    await fireEvent.focus(field);
    await fireEvent.input(field, { target: { value: 'jo' } });
    await fireEvent.click(await opened().findByRole('button', { name: /Jonas Peeters/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/groups/g-br/members', body: { email: 'jonas.peeters@immoscoop.be' } }));
    expect((await opened().findByText('toegevoegd door jou')).closest('.member')?.textContent).toContain('Jonas Peeters');
    expect(opened().getByText('Jonas Peeters toegevoegd, door jou')).toBeTruthy();

    await fireEvent.click(opened().getByRole('button', { name: 'Haal Karel Leys uit Broker team' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/groups/g-br/members/karel.leys%40immoscoop.be' }));
    await vi.waitFor(() => expect(opened().queryByRole('button', { name: 'Haal Karel Leys uit Broker team' })).toBeNull());

    await fireEvent.input(field, { target: { value: 'someone@gmail.com' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    expect((await opened().findByRole('alert')).textContent).toBe('Enkel een adres van de domeinen van Immoscoop kan toegevoegd worden.');
  });

  it('shows a Group the User is only in read-only, with two members of the Group that manages it to ask (FR-UM-18)', async () => {
    serve({ world: groupWorld() });
    open('/groups/g-mk');
    render(App, { config: CONFIG });
    await ready();
    expect(await opened().findByText('Marketing leads beheert deze Group: vraag een van zijn leden, An Claes of Jonas Peeters, om een collega toe te voegen of eruit te halen.')).toBeTruthy();
    expect(opened().getByRole('heading', { level: 2, name: 'Marketing' })).toBeTruthy();
    expect(fact('Leden')).toBe('3, jij erbij');
    expect(fact('Beheerd door')).toBe('Marketing leads · je zit er niet in');
    expect(opened().getByRole('link', { name: 'Marketing leads' }).getAttribute('href')).toBe('/groups/g-ml');
    expect(opened().queryByRole('textbox')).toBeNull();
    expect(opened().queryByRole('button', { name: /Haal/ })).toBeNull();
    expect(opened().queryByText('Geschiedenis')).toBeNull();
    expect(opened().queryByRole('button', { name: /verwijderen/ })).toBeNull();
  });

  it('hands a Group over to itself only after saying the User will no longer manage it (FR-UM-14)', async () => {
    const calls = serve({ world: groupWorld() });
    open('/groups/g-br');
    render(App, { config: CONFIG });
    await ready();
    const choice = within(await opened().findByRole('radiogroup', { name: 'Beheerd door' }));
    expect(choice.getByRole('radio', { name: /Sales management/ }).closest('label')?.textContent).toContain('nu');
    expect(opened().getByText(/Kies je Broker team zelf, dan beheer je hem niet meer, want je zit er niet in./)).toBeTruthy();
    await fireEvent.click(choice.getByRole('radio', { name: /Broker team zelf/ }));
    expect(opened().getByRole('alert').textContent).toContain('Zodra Broker team zichzelf beheert, beheer jij hem niet meer, want je zit er niet in.');
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
    await fireEvent.click(opened().getByRole('button', { name: 'Draag hem over' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/groups/g-br', body: { managedBy: 'itself' } }));
    expect(await opened().findByText(/Broker team beheert zichzelf: vraag een van zijn leden, Elif Yilmaz of Karel Leys/)).toBeTruthy();
    expect(opened().queryByRole('radiogroup', { name: 'Beheerd door' })).toBeNull();
  });

  it('deletes a Group that owns and manages nothing once confirmed, and says why another cannot be (FR-UM-16)', async () => {
    const calls = serve({ world: groupWorld() });
    open('/groups/g-sm');
    render(App, { config: CONFIG });
    await ready();
    expect(await opened().findByText('Sales management beheert Broker team. Kies eerst een andere Group om Broker team te beheren, dan kan hij verwijderd worden.')).toBeTruthy();
    expect((opened().getByRole('button', { name: 'Sales management verwijderen…' }) as HTMLButtonElement).disabled).toBe(true);

    await fireEvent.click(list().getByRole('link', { name: /^Broker team/ }));
    await vi.waitFor(() => expect(opened().getByRole('button', { name: 'Broker team' })).toBeTruthy());
    expect(await opened().findByText('Broker team bezit en beheert niets, dus hij kan verwijderd worden: zijn 3 leden gaan eruit, en zijn geschiedenis blijft.')).toBeTruthy();
    await fireEvent.click(opened().getByRole('button', { name: 'Broker team verwijderen…' }));
    expect(opened().getByText('Broker team verwijderen?')).toBeTruthy();
    await fireEvent.click(opened().getByRole('button', { name: 'Verwijder hem' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/groups/g-br' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/groups'));
    await vi.waitFor(() => expect(list().queryByRole('link', { name: /^Broker team/ })).toBeNull());
  });

  it('makes a Group in a sheet, managed by a Group the User is in, and renews the Access Token (FR-UM-13, FR-UM-19)', async () => {
    const calls = serve({ world: groupWorld() });
    open('/groups');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Nieuwe Group' }));
    expect(location.pathname).toBe('/groups/new');
    const sheet = within(await screen.findByRole('dialog', { name: 'Nieuwe Group' }));
    expect(sheet.getAllByRole('radio').map((radio) => radio.closest('label')?.querySelector('.title')?.textContent)).toEqual(['Marketing', 'Sales management', 'De nieuwe Group zelf']);
    expect((sheet.getByRole('radio', { name: /^Marketing/ }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.input(sheet.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Marketing' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Maak hem' }));
    expect(await sheet.findByText('Een andere Group heeft deze naam.')).toBeTruthy();

    await fireEvent.input(sheet.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Mortgage advisors' } });
    expect(sheet.getByRole('radio', { name: /Mortgage advisors zelf/ })).toBeTruthy();
    await fireEvent.click(sheet.getByRole('radio', { name: /^Sales management/ }));
    const before = calls.filter((call) => call.path === '/me').length;
    await fireEvent.click(screen.getByRole('button', { name: 'Maak hem' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/groups/g-new'));
    await ready();
    expect(calls).toContainEqual({ method: 'POST', path: '/groups', body: { name: 'Mortgage advisors', sentence: '', managedBy: 'g-sm' } });
    // Its maker is in it now: their next Access Token carries it, and who they are is read again.
    await vi.waitFor(() => expect(calls.filter((call) => call.path === '/me').length).toBe(before + 1));
    expect(await opened().findByRole('button', { name: 'Mortgage advisors' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Nieuwe Group' })).toBeNull();
  });

  it('shows every Group with Manage every group, the others apart, and says how the User changes one they are not in (DEC-UX-201)', async () => {
    serve({ as: 'admin', world: groupWorld({ every: true }) });
    open('/groups');
    render(App, { config: CONFIG });
    const which = within(await screen.findByRole('radiogroup', { name: 'Welke Groups' }));
    expect(which.getByRole('radio', { name: 'Van jou 3' }).getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(which.getByRole('radio', { name: 'Alle 4' }));
    expect(list().getByText('Andere Groups')).toBeTruthy();
    await fireEvent.click(list().getByRole('link', { name: /^Marketing leads/ }));
    await vi.waitFor(() => expect(opened().getByRole('heading', { level: 2, name: 'Marketing leads' })).toBeTruthy());
    expect(await opened().findByText(/Je zit niet in Marketing leads, en ook niet in de Group die hem beheert. Je kan hem wijzigen omdat je Permission group/)).toBeTruthy();
    const choice = within(opened().getByRole('radiogroup', { name: 'Beheerd door' }));
    expect(choice.getAllByRole('radio').map((radio) => radio.closest('label')?.querySelector('.title')?.firstChild?.textContent?.trim())).toEqual(['Marketing leads zelf', 'Marketing', 'Sales management', 'Broker team']);
    expect(opened().getByText(/Met Elke Group beheren kan je elke Group kiezen/)).toBeTruthy();
  });

  it('leads from the Owner Unit of a Collection to its Group', async () => {
    serve({ groups: ['g1'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect((await main.findByRole('link', { name: 'Owner: Data' })).getAttribute('href')).toBe('/groups/g1');
  });
});

describe('the web app, for the Data Team, with Collections', () => {
  it('hands a Collection to any Group (FR-CO-35)', async () => {
    serve({ as: 'admin' });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Alles bewerken/ }));
    const owner = main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement;
    await vi.waitFor(() => expect([...owner.options].map((option) => option.value)).toEqual(['g1', 'g2']));
    expect(main.getByText(/Elke Group van Data Hub/)).toBeTruthy();
    expect(owner.options[0]?.textContent).toBe('Data');
  });

  it('adds a Resource while the Domain Model says no version, recording none rather than an empty one', async () => {
    const calls = serve({ as: 'admin', modelRelease: '' });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click((await main.findAllByRole('button', { name: /Resources toevoegen/ }))[0]!);
    const sheet = within(screen.getByRole('dialog', { name: 'Een Resource toevoegen aan Credit leads' }));
    await fireEvent.click(sheet.getByRole('radio', { name: /Saved searches/ }));
    await fireEvent.click(sheet.getByRole('button', { name: /Volgende: grain en relaties/ }));
    const second = within(await screen.findByRole('dialog', { name: 'Grain en relaties van Saved searches' }));
    expect(await second.findByText(/zoals het op prod draait; het zegt zijn versie niet/)).toBeTruthy();
    await fireEvent.input(second.getByRole('textbox', { name: 'Wat één rij is, in woorden' }), { target: { value: 'saved search' } });
    await fireEvent.click(second.getByRole('button', { name: 'Resource toevoegen' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const added = calls.find((call) => call.method === 'POST' && call.path === '/collections/c1/resources')?.body as { resources: { release: unknown }[] };
    expect(added.resources[0]?.release).toBeNull();
  });

  it('adds a Resource without a Collection from the page of a Collection, one at a time, in a sheet of two steps (FR-CO-31, FR-CO-33, FR-CO-34, DEC-UX-132)', async () => {
    const reviews = { ...SAVED_SEARCHES, id: 'r9', displayName: 'Agency reviews', name: 'agency_reviews', exposures: ['datahub_agencyReviews'] };
    const calls = serve({ as: 'admin', waiting: [SAVED_SEARCHES, reviews] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click((await main.findAllByRole('button', { name: /Resources toevoegen/ }))[0]!);
    const sheet = within(screen.getByRole('dialog', { name: 'Een Resource toevoegen aan Credit leads' }));
    expect(sheet.getByText(/^Kwam binnen op 21 okt\.? via de exposure datahub_savedSearches$/)).toBeTruthy();
    expect(sheet.queryByRole('checkbox')).toBeNull();
    expect(sheet.getByText('Nog geen Resource gekozen')).toBeTruthy();
    const next = sheet.getByRole('button', { name: /Volgende: grain en relaties/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    // Choosing another Resource replaces the first: one at a time.
    await fireEvent.click(sheet.getByRole('radio', { name: /Agency reviews/ }));
    await fireEvent.click(sheet.getByRole('radio', { name: /Saved searches/ }));
    expect(sheet.getAllByRole('radio', { checked: true }).map((radio) => radio.closest('label')?.textContent)).toEqual([expect.stringContaining('Saved searches')]);
    expect(sheet.getByText('Saved searches · daarna zijn grain en relaties')).toBeTruthy();
    await fireEvent.click(next);

    // Step 2: what dbt and the Domain Model propose, each with where it came from.
    const second = within(await screen.findByRole('dialog', { name: 'Grain en relaties van Saved searches' }));
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
    expect((second.getByRole('button', { name: 'Resource toevoegen' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(identity, { target: { value: 'filter.filterId' } });
    expect(second.getByText(/zit nog niet in het Domain Model/)).toBeTruthy();
    await fireEvent.input(second.getByRole('textbox', { name: 'Wat één rij is, in woorden' }), { target: { value: 'saved search' } });
    await fireEvent.click(second.getByRole('button', { name: 'Resource toevoegen' }));
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

/** Opens the quick window, types words and does the first row that may be done, as Enter does. */
async function quickDo(words: string): Promise<void> {
  await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
  const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
  await fireEvent.input(quick.getByRole('combobox'), { target: { value: words } });
  await fireEvent.keyDown(quick.getByRole('combobox'), { key: 'Enter' });
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snelvenster' })).toBeNull());
}
/** The row of the quick window with this title, as it shows when nothing is typed. */
async function quickRow(title: string): Promise<HTMLElement> {
  await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
  const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
  const row = quick.getAllByRole('option').find((option) => option.querySelector('.title')?.textContent === title);
  if (!row) throw new Error(`No row ${title}`);
  return row;
}
const closeQuick = async () => {
  await fireEvent.keyDown(screen.getByRole('combobox', { name: 'Snelvenster' }), { key: 'Escape' });
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snelvenster' })).toBeNull());
};

describe('Query', () => {
  it('labels a query made through Claude in the panel (DEC-CL-11, FR-CL-22)', async () => {
    serve({ queries: [{ ...QUERY, through: 'claude', lastRunAt: new Date().toISOString() }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    const item = (await panel.findByRole('link', { name: /Leads per source name/ }, { timeout: 3000 })).closest('.item')!;
    expect(within(item as HTMLElement).getByText('Claude').getAttribute('title')).toBe('Gemaakt via Claude');
  });

  it('shows no row of flagged queries while none is flagged, and flags the first from the quick window (DEC-UX-253)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 });
    expect(main.queryByRole('navigation', { name: 'Gemarkeerde queries' })).toBeNull();
    await quickDo('markeer deze query');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q1'] } }));
    const flags = within(await main.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    expect(await flags.findByRole('link', { name: /Leads per source name/ })).toBeTruthy();
  });

  it('keeps the head of a query light: its name on one line, no New query, no line where it started from (DEC-UX-250, DEC-UX-251, DEC-UX-252)', async () => {
    const long = 'Credit leads and e-mail addresses per window of 30 days, per partner and per source';
    serve({ queries: [{ ...QUERY, name: long, startedFrom: { id: 'q0', name: 'Credit leads per window', afterRun: 3 } }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const title = await main.findByRole('heading', { level: 1, name: long }, { timeout: 3000 });
    expect(title.classList.contains('one-line')).toBe(true);
    expect(title.querySelector('button')?.getAttribute('title')).toContain(long);
    const head = title.closest('header') as HTMLElement;
    expect(within(head).queryByRole('link', { name: /Nieuwe query/ })).toBeNull();
    expect(head.textContent).not.toMatch(/gestart vanuit/i);
    // Add a Resource is a small round icon, named on a hover, after the Resources on one line (DEC-UX-249).
    const add = main.getByRole('button', { name: 'Een Resource toevoegen' });
    expect(add.textContent?.trim()).toBe('');
    expect(add.getAttribute('title')).toBe('Een Resource toevoegen');
  });

  it('keeps flagged queries on top of Query, flags with Flag and jumps with Ctrl+1 to Ctrl+0 (DEC-UX-236, OP-UX-84, OP-UX-86)', async () => {
    const partners = { ...QUERY, id: 'q2', name: 'Partner share per week', lastRunAt: new Date().toISOString() };
    const calls = serve({ queries: [{ ...QUERY, lastRunAt: new Date().toISOString() }, partners], settings: { 'query.flagged': ['q2'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const flags = within(await main.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    expect((await flags.findByRole('link', { name: /Partner share per week/ })).getAttribute('href')).toBe('/query/q2');
    expect(flags.getByText('1')).toBeTruthy();
    // This query is not flagged yet: "Flag this query" in the row keeps it on top, as the second, with its key (DEC-UX-241).
    const add = await flags.findByRole('button', { name: /^Markeer deze query/ }, { timeout: 3000 });
    expect(add.textContent).toContain('Ctrl+2');
    // The head of a query has no Flag.
    expect(main.queryByRole('button', { name: 'Markeren' })).toBeNull();
    await fireEvent.click(add);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q2', 'q1'] } }));
    await vi.waitFor(() => expect(flags.queryByRole('button', { name: /^Markeer deze query/ })).toBeNull());
    expect((await flags.findByRole('link', { name: /Leads per source name/ })).getAttribute('aria-current')).toBe('page');
    // The panel shows the flag at the end of a flagged query.
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    expect(await panel.findAllByRole('img', { name: 'Gemarkeerd' })).toHaveLength(2);
    // Ctrl+1 opens the first; the one left stays as the User left it, what was typed in its SQL too (OP-UX-85).
    const editor = await main.findByRole('textbox', { name: /Leads per source name/ });
    await typeInEditor(editor, ' -- mine');
    await fireEvent.keyDown(document.body, { key: '1', code: 'Digit1', ctrlKey: true });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q2'));
    await main.findByRole('textbox', { name: /Partner share per week/ });
    // A keyboard that needs Shift for its digits, as AZERTY does, opens it by where the key is.
    await fireEvent.keyDown(document.body, { key: '&', code: 'Digit2', ctrlKey: true });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q1'));
    const back = await main.findByRole('textbox', { name: /Leads per source name/ });
    expect(back).toBe(editor);
    expect(back.textContent).toContain('-- mine');
    // The × on a tab unflags it.
    await fireEvent.click(flags.getByRole('button', { name: 'Partner share per week niet meer markeren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q1'] } }));
  });

  it('keeps the open query on screen, as the User left it, when it is unflagged (DEC-UX-236)', async () => {
    const partners = { ...QUERY, id: 'q2', name: 'Partner share per week' };
    const calls = serve({ queries: [{ ...QUERY }, partners], settings: { 'query.flagged': ['q1', 'q2'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const flags = within(await main.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    const editor = await main.findByRole('textbox', { name: /Leads per source name/ }, { timeout: 3000 });
    await typeInEditor(editor, ' -- mine');
    // Unflagged from the quick window: it leaves the row on top, and stays open as it was.
    await quickDo('niet meer markeren');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q2'] } }));
    await vi.waitFor(() => expect(flags.queryByRole('link', { name: /Leads per source name/ })).toBeNull());
    expect(main.getByRole('heading', { level: 1, name: 'Leads per source name' })).toBeTruthy();
    const still = main.getByRole('textbox', { name: /Leads per source name/ });
    expect(still).toBe(editor);
    expect(still.textContent).toContain('-- mine');
    // Flagged again from the row, and unflagged with the × on its tab: it stays open all the same.
    await fireEvent.click(await flags.findByRole('button', { name: /^Markeer deze query/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q2', 'q1'] } }));
    await fireEvent.click(await flags.findByRole('button', { name: 'Leads per source name niet meer markeren' }));
    await vi.waitFor(() => expect(flags.queryByRole('link', { name: /Leads per source name/ })).toBeNull());
    expect(main.getByRole('textbox', { name: /Leads per source name/ })).toBe(editor);
    expect(location.pathname).toBe('/query/q1');
  });

  it('lists what was done first, and Ctrl+1 to Ctrl+9 highlight a row without doing it (DEC-UX-242)', async () => {
    const named = (id: string, name: string) => ({ ...QUERY, id, name });
    const calls = serve({ queries: [named('q1', 'Leads per source name'), named('q2', 'Partner share per week'), named('q3', 'Listings per postal code')], settings: { 'query.flagged': ['q1', 'q2', 'q3'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 });
    await quickDo('verberg');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/queries/q1/hidden' }));
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    // Recently used on top, each row that can be done with its key.
    expect(quick.getAllByRole('presentation').map((group) => group.textContent)[0]).toBe('Recent gebruikt');
    const options = quick.getAllByRole('option');
    // Hidden, the same button is now Show this query again: Recently used keeps it.
    expect(options[0]?.textContent).toContain('Deze query weer tonen');
    expect(options[0]?.textContent).toContain('Ctrl+1');
    // The flagged queries show their own key in their line.
    expect(options.find((option) => option.querySelector('.title')?.textContent === 'Partner share per week')?.querySelector('.meta')?.textContent).toBe('Ctrl+2');
    // Ctrl+3 highlights the third, and does not open the third flagged query.
    const third = options.find((option) => option.textContent?.includes('Ctrl+3'));
    await fireEvent.keyDown(quick.getByRole('combobox'), { key: '3', code: 'Digit3', ctrlKey: true });
    expect(third?.getAttribute('aria-selected')).toBe('true');
    expect(location.pathname).toBe('/query/q1');
    expect(screen.queryByRole('dialog', { name: 'Snelvenster' })).toBeTruthy();
    // Enter does it.
    expect(third?.textContent).toContain('Maak er een Lens van');
    await fireEvent.keyDown(quick.getByRole('combobox'), { key: 'Enter' });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q1/lens'));
  });

  it('goes to the next and the previous flagged query from the quick window, round the row (DEC-UX-241)', async () => {
    const named = (id: string, name: string) => ({ ...QUERY, id, name });
    serve({ queries: [named('q1', 'Leads per source name'), named('q2', 'Partner share per week'), named('q3', 'Listings per postal code')], settings: { 'query.flagged': ['q1', 'q2', 'q3'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const flags = within(await main.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    await flags.findByRole('link', { name: /Listings per postal code/ }, { timeout: 3000 });
    const next = await quickRow('Volgende gemarkeerde query');
    expect(next.textContent).toContain('Partner share per week · Ctrl+2');
    await closeQuick();
    await quickDo('volgende gemarkeerde');
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q2'));
    // From the first, the previous one is the last, round the row.
    await quickDo('vorige gemarkeerde');
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q1'));
    await quickDo('vorige gemarkeerde');
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q3'));
  });

  it('moves a flagged query by dragging its tab, and its key with it (DEC-UX-236)', async () => {
    const named = (id: string, name: string) => ({ ...QUERY, id, name });
    const calls = serve({ queries: [named('q1', 'Leads per source name'), named('q2', 'Partner share per week'), named('q3', 'Listings per postal code')], settings: { 'query.flagged': ['q1', 'q2', 'q3'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const flags = within(await screen.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    const tab = async (name: string) => (await flags.findByRole('link', { name: new RegExp(name) })).closest('[role="listitem"]') as HTMLElement;
    const third = await tab('Listings per postal code');
    const first = await tab('Leads per source name');
    // The third onto the first: it becomes the first, and Ctrl+1 opens it.
    await fireEvent.dragStart(third);
    await fireEvent.dragOver(first);
    await fireEvent.drop(first);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.flagged', body: { value: ['q3', 'q1', 'q2'] } }));
    await fireEvent.keyDown(document.body, { key: '1', code: 'Digit1', ctrlKey: true });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q3'));
  });

  it('has no Flag in the row at ten flagged queries, and greys it in the quick window with why (OP-UX-84, DEC-UX-241)', async () => {
    const ten = Array.from({ length: 10 }, (_, at) => ({ ...QUERY, id: `f${at}`, name: `Flagged ${at}` }));
    serve({ queries: [QUERY, ...ten], settings: { 'query.flagged': ten.map((query) => query.id) } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const flags = within(await main.findByRole('navigation', { name: 'Gemarkeerde queries' }));
    await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 });
    await flags.findByRole('link', { name: /Flagged 9/ });
    expect(flags.queryByRole('button', { name: /^Markeer deze query/ })).toBeNull();
    const row = await quickRow('Markeer deze query');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.nextElementSibling?.textContent).toBe('Tien queries zijn gemarkeerd. Haal er eerst één weg.');
  });

  it('opens the quick window with Ctrl+K and Ctrl+Shift+P, with the commands of the query first, and does one (DEC-UX-237, OP-UX-87)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 });
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    const titles = () => quick.queryAllByRole('option').map((option) => option.querySelector('.title')?.textContent);
    // Fold all and Format have no button on the page: the quick window does them (DEC-UX-248).
    expect(main.queryByRole('button', { name: 'Alles dichtvouwen' })).toBeNull();
    expect(main.queryByRole('button', { name: 'Opmaken' })).toBeNull();
    // A command for every button of the page that does something to it, in the order of DEC-UX-239.
    expect(titles().slice(0, 13)).toEqual([
      'Uitvoeren',
      'Maak er een Lens van',
      'Markeer deze query',
      'Deze query hernoemen',
      'Alles dichtvouwen',
      'De SQL opmaken',
      'Een Parameter toevoegen',
      'Een Resource toevoegen',
      'Nieuwe query vanuit deze',
      'Lenses op deze Resources',
      'De geschiedenis tonen',
      'Deze query verbergen',
      'De query naast het resultaat',
    ]);
    // Add a table is for a power user only.
    expect(titles()).not.toContain('Een tabel toevoegen');
    // Escape closes it; Ctrl+Shift+P opens it again.
    await fireEvent.keyDown(quick.getByRole('combobox'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snelvenster' })).toBeNull());
    await fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const again = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    await fireEvent.input(again.getByRole('combobox'), { target: { value: 'verberg' } });
    await fireEvent.keyDown(again.getByRole('combobox'), { key: 'Enter' });
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/queries/q1/hidden' }));
    expect(screen.queryByRole('dialog', { name: 'Snelvenster' })).toBeNull();
  });

  it('shows the info of the word at the cursor from the quick window, as a double-click does (DEC-UX-238)', async () => {
    serve({ queries: [{ ...QUERY, sql: 'select\n    week_start\nfrom\n    `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`\n-- by\n    , week_start' }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const editor = await main.findByRole('textbox', { name: /Leads per source name/ }, { timeout: 3000 });
    await vi.waitFor(() => expect(editor.querySelector('.cm-explain')).toBeTruthy());
    // Not on such a word: no Show info.
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'Home', code: 'Home', ctrlKey: true });
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    let quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    expect(quick.queryByText('Info tonen')).toBeNull();
    await fireEvent.keyDown(quick.getByRole('combobox'), { key: 'Escape' });
    // At the end of week_start, the field: Show info comes first, and opens its descriptions.
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    const first = quick.getAllByRole('option')[0] as HTMLElement;
    expect(first.textContent).toContain('Info tonen');
    expect(first.textContent).toContain('het veld week_start, waar de cursor staat');
    await fireEvent.keyDown(quick.getByRole('combobox'), { key: 'Enter' });
    const explained = await screen.findByRole('dialog', { name: 'week_start' });
    expect(explained.textContent).toContain('Monday of the week');
  });

  it('runs from the quick window as Ctrl+Enter does, and above 100 MB leaves the approval to the red button (DEC-UX-239, DEC-UX-142)', async () => {
    const calls = serve({ queries: [{ ...QUERY }, { ...QUERY, id: 'q2', name: 'All weeks', sql: `${QUERY.sql}\n-- all weeks` }, { ...QUERY, id: 'q3', name: 'Every year', sql: `${QUERY.sql}\n-- every year` }], settings: { 'query.flagged': ['q1', 'q2', 'q3'] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await vi.waitFor(() => expect(main.getByRole('button', { name: /Uitvoeren/ }).hasAttribute('disabled')).toBe(false), { timeout: 3000 });
    const run = await quickRow('Uitvoeren');
    expect(run.textContent).toContain('leest 80 MB');
    expect(run.textContent).toContain('Ctrl+Enter');
    await closeQuick();
    await quickDo('uitvoer');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/runs', body: expect.objectContaining({ approve: false }) }));
    // Above 100 MB: Approve and run puts the focus on the red button, and approves nothing itself.
    await fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q2'));
    const approve = await vi.waitFor(() => {
      const button = main.getByRole('button', { name: /Goedkeuren en uitvoeren/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      return button;
    }, { timeout: 3000 });
    const row = await quickRow('Goedkeuren en uitvoeren');
    expect(row.textContent).toContain('Enter op zijn rode knop keurt hem goed');
    await closeQuick();
    await quickDo('goedkeur');
    await vi.waitFor(() => expect(document.activeElement).toBe(approve));
    expect(calls.some((call) => call.method === 'POST' && call.path === '/queries/q2/runs')).toBe(false);
    // Above 1 GB: Send to the Data Team opens the Request on its button, ready for a word, and sends nothing itself.
    await fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', ctrlKey: true });
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q3'));
    await vi.waitFor(() => expect((main.getByRole('button', { name: /Naar het Data Team sturen/ }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    await quickDo('data team');
    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'));
    expect(calls.some((call) => call.path === '/queries/q3/requests')).toBe(false);
  });

  it('does the other buttons of a query from the quick window: a Lens, rename, a Parameter, the filter, another set (DEC-UX-239)', async () => {
    const two = [QUERY.resources[0]!, { ...QUERY.resources[0]!, id: 'r9', displayName: 'Lead sources', key: 'immoscoop-dataplatform-398214.dbt_prod_leads.lead_sources', partition: null, clusterBy: [] }];
    const calls = serve({ queries: [{ ...QUERY, sql: 'select\n    week_start\nfrom\n    `immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume`', resources: two }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('link', { name: 'Maak er een Lens van' }, { timeout: 3000 });
    // The partition filter the Pre-flight asks for, with what it then reads.
    const filter = await vi.waitFor(async () => {
      const row = await quickRow('De partitiefilter toevoegen');
      return row;
    }, { timeout: 3000 });
    expect(filter.textContent).toContain('op week_start van Weekly lead volume; dan leest hij 82 MB');
    await closeQuick();
    await quickDo('partitie');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: expect.objectContaining({ sql: expect.stringContaining("where week_start >= '2026-10-01'") }) }));
    // Rename opens its name in place, ready to type.
    await quickDo('hernoem');
    const name = await main.findByRole('textbox', { name: 'Naam' });
    await vi.waitFor(() => expect(document.activeElement).toBe(name));
    await fireEvent.click(main.getByRole('button', { name: 'Annuleren' }));
    // Add a Parameter opens its window.
    await quickDo('parameter toev');
    await screen.findByRole('dialog', { name: /Parameter/ });
    // Remove a Resource: one for each, which starts a new query without it.
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    await quickDo('lead sources weghalen');
    await screen.findByRole('dialog', { name: /zonder|Zonder/ });
    // Make it a Lens goes to its flow.
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    await quickDo('lens van');
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q1/lens'));
  });

  it('switches the result and the history, and copies the Query ID, from the quick window (DEC-UX-239)', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    serve({ queries: [{ ...QUERY, lastRun: RUN, runs: 1, lastRunAt: RUN.startedAt }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByText(RUN.ref, {}, { timeout: 3000 });
    const copy = await quickRow('Kopieer de Query ID');
    expect(copy.textContent).toContain(`${RUN.ref}, van uitvoering 1`);
    await closeQuick();
    await quickDo('kopieer');
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(RUN.ref));
    await quickDo('geschiedenis');
    await vi.waitFor(() => expect(main.getByRole('radio', { name: /Geschiedenis/ }).getAttribute('aria-checked')).toBe('true'));
    await quickDo('resultaat tonen');
    await vi.waitFor(() => expect(main.getByRole('radio', { name: /Resultaat/ }).getAttribute('aria-checked')).toBe('true'));
  });

  it('greys Make it a Lens in the quick window on a Resource not published yet, with why (DEC-UX-239, DEC-UX-218)', async () => {
    serve({ queries: [{ ...QUERY, resources: [{ ...QUERY.resources[0]!, published: false }] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    await within(await screen.findByRole('main')).findByRole('group', { name: 'Maak er een Lens van' }, { timeout: 3000 });
    const lens = await quickRow('Maak er een Lens van');
    expect(lens.getAttribute('aria-disabled')).toBe('true');
    expect(lens.nextElementSibling?.textContent).toBe('Nog niet gepubliceerd: Weekly lead volume. Een Lens wordt alleen op gepubliceerde Resources gemaakt.');
  });

  it('goes to a Resource the User may see from the quick window, anywhere in Data Hub (DEC-UX-237, OP-UX-88)', async () => {
    serve({ queries: [{ ...QUERY }] });
    open('/collections');
    render(App, { config: CONFIG });
    await screen.findByRole('main');
    await vi.waitFor(() => expect(screen.getByRole('complementary', { name: 'Collections' }).textContent).toContain('Credit leads'));
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    await fireEvent.input(quick.getByRole('combobox'), { target: { value: 'weekly' } });
    const found = await quick.findByRole('option', { name: /Weekly lead volume/ });
    expect(found.textContent).toContain('Resource');
    await fireEvent.click(found);
    await vi.waitFor(() => expect(location.pathname).toBe('/resources/r2'));
  });

  it('reads the queries again with Refresh, such as those Claude made meanwhile (DEC-UX-163)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    await vi.waitFor(() => expect(calls.filter((call) => call.path.startsWith('/queries/days?'))).toHaveLength(1));
    await fireEvent.click(panel.getByRole('button', { name: 'De lijst van queries vernieuwen' }));
    await vi.waitFor(() => expect(calls.filter((call) => call.path.startsWith('/queries/days?'))).toHaveLength(2));
  });

  it('refreshes the queries and hides or shows the panel from the quick window, as their buttons do (DEC-UX-254)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    await screen.findByRole('complementary', { name: 'Query' });
    await vi.waitFor(() => expect(calls.filter((call) => call.path.startsWith('/queries/days?'))).toHaveLength(1));
    await quickDo('de queries vernieuwen');
    await vi.waitFor(() => expect(calls.filter((call) => call.path.startsWith('/queries/days?'))).toHaveLength(2));
    // The panel, by its other words too, such as "side menu".
    await quickDo('side menu');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/panel.open', body: { value: false } }));
    expect(screen.getByRole('complementary', { hidden: true }).inert).toBe(true);
    await quickDo('het paneel tonen');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/panel.open', body: { value: true } }));
  });

  it('offers to refresh the queries only on the screens of Query (DEC-UX-254)', async () => {
    serve();
    open('/collections');
    render(App, { config: CONFIG });
    await screen.findByRole('complementary', { name: 'Collections' });
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    const quick = within(await screen.findByRole('dialog', { name: 'Snelvenster' }));
    const titles = () => quick.queryAllByRole('option').map((option) => option.querySelector('.title')?.textContent);
    await fireEvent.input(quick.getByRole('combobox'), { target: { value: 'paneel' } });
    expect(titles()).toContain('Het paneel verbergen');
    await fireEvent.input(quick.getByRole('combobox'), { target: { value: 'vernieuwen' } });
    expect(titles()).not.toContain('De queries vernieuwen');
  });

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

  it('greys "Make it a lens" on a query that reads a Resource not published yet, and says which (DEC-LE-22, DEC-UX-218)', async () => {
    serve({ queries: [{ ...QUERY, lastRunAt: new Date().toISOString(), resources: [{ ...QUERY.resources[0]!, published: false }] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Leads per source name' }, { timeout: 3000 })).toBeTruthy();
    // No link to make it a Lens: the button is greyed, with why.
    expect(main.queryByRole('link', { name: 'Maak er een Lens van' })).toBeNull();
    const button = main.getByRole('button', { name: 'Maak er een Lens van' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    // On a hover or on focus, why: each Resource not published yet, with its Level (DEC-UX-232).
    const why = (document.getElementById(button.closest('[aria-describedby]')?.getAttribute('aria-describedby') ?? '')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(why).toMatch(/^Een Lens wordt alleen gemaakt op gepubliceerde Resources\. Nog niet gepubliceerd: Weekly lead volume.*Zijn Owner publiceert hem op zijn pagina; dan werkt deze knop\.$/);
    expect(button.closest('[aria-describedby]')?.getAttribute('tabindex')).toBe('0');
    // Under the question: which Resource is not published yet, with a link to it.
    const line = main.getByText(/Nog niet gepubliceerd:/, { selector: 'p.origin span' }).closest('p') as HTMLElement;
    expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe('Nog niet gepubliceerd: Weekly lead volume. Een Lens maak je enkel op gepubliceerde Resources.');
    expect(within(line).getByRole('link', { name: 'Weekly lead volume' }).getAttribute('href')).toBe('/resources/r2');
  });

  it('shows a table outside Data Hub as a quiet chip, and keeps a query that reads one from becoming a Lens (FR-SR-56, DEC-UX-220)', async () => {
    const sql = `${QUERY.sql.replace('lead_source', 'lead_source,\n    lead_id')}\n    and lead_id in (select lead_id from \`immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads\`)`;
    serve({ as: 'admin', queries: [{ ...QUERY, sql, lastRunAt: new Date().toISOString() }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // Next to its Resources: only the name of the table; its layer and that it is not a Resource on a hover (DEC-UX-243).
    const chip = (await main.findByText('stg_oltp__leads', { selector: '.chip .mono' }, { timeout: 3000 })).closest('.chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('stg_oltp__leads');
    expect(chip.title).toMatch(/^staging · een tabel die Data Hub kent uit een dbt-project dat het volgt/);
    // It runs, but cannot become a Lens: greyed, with why, and a line under the question.
    expect(await main.findByRole('button', { name: /Uitvoeren\s*80 MB/ })).toBeTruthy();
    const button = main.getByRole('button', { name: 'Maak er een Lens van' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const why = (document.getElementById(button.closest('[aria-describedby]')?.getAttribute('aria-describedby') ?? '')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(why).toBe('Een Lens wordt alleen gemaakt op gepubliceerde Resources. Hij leest een tabel buiten Data Hub: stg_oltp__leadsstaging Lees er een Resource in de plaats; dan werkt deze knop.');
    const line = main.getByText(/Leest een tabel buiten Data Hub:/).closest('p') as HTMLElement;
    expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe('Leest een tabel buiten Data Hub: stg_oltp__leads. Een Lens maak je enkel op gepubliceerde Resources, dus deze query kan er geen worden.');
  });

  it('lets a power user start a query from SQL, without Resources, and nobody else (FR-SR-56, DEC-UX-220)', async () => {
    serve({});
    open('/query/new');
    const { unmount } = render(App, { config: CONFIG });
    expect(await within(await screen.findByRole('main')).findByRole('textbox', { name: /Naam/ }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Of begin vanuit SQL, zonder Resources' })).toBeNull();
    unmount();

    const calls = serve({ as: 'admin' });
    open('/query/new');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: 'Of begin vanuit SQL, zonder Resources' }, { timeout: 3000 }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls).toContainEqual({ method: 'POST', path: '/queries', body: { name: expect.stringMatching(/^SQL, \d+ /), question: '', resources: [] } });
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
    // It opened formatted, as Format writes it (DEC-UX-233).
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/runs', body: { sql: formatBigQuery(`${QUERY.sql}-- all weeks\n`), parameters: [], approve: true } }));
  });

  it('shows a Broken query with what it misses and since when, Run off, and a red dot in the panel (FR-SR-53, DEC-UX-160)', async () => {
    const missing = { kind: 'column', name: 'lead_source', since: '2026-10-28T05:17:00Z' };
    serve({ queries: [{ ...QUERY, lastRunAt: new Date().toISOString(), broken: missing }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Deze query kan niet draaien.')).toBeTruthy();
    expect(main.getByText(/Hij leest de kolom lead_source, die sinds 28 okt\.? 2026 niet meer bestaat\. Wijzig de SQL/)).toBeTruthy();
    // Its Pre-flight still finds it missing: Run stays off, and says why.
    await vi.waitFor(() => expect(main.getByRole('button', { name: /Uitvoeren/ }).getAttribute('title')).toBe('Hij draait nu niet: wat hij leest, bestaat niet meer'), { timeout: 3000 });
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    expect(await panel.findByRole('img', { name: 'Resource · Broken: de kolom lead_source bestaat niet meer' })).toBeTruthy();
  });

  it('shows a query Broken as soon as its Pre-flight finds what it ran with gone, and the panel follows (FR-SR-52, FR-SR-53)', async () => {
    serve({ queries: [{ ...QUERY, lastRunAt: new Date().toISOString(), loses: { kind: 'table', name: 'weekly_lead_volume', since: '2026-10-31T09:00:00Z' } }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // A table of one of its Resources is named by that Resource.
    expect(await main.findByText('Deze query kan niet draaien.', {}, { timeout: 3000 })).toBeTruthy();
    expect(main.getByText(/Hij leest de tabel weekly_lead_volume, die sinds 31 okt\.? 2026 niet meer bestaat/)).toBeTruthy();
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    expect(await panel.findByRole('img', { name: /Resource · Broken/ })).toBeTruthy();
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

  it('hides a query for the User, shows it under Hidden, and reads a period only when it is opened (DEC-UX-137, DEC-UX-138, DEC-UX-139, DEC-UX-150)', async () => {
    const today = new Date().toISOString();
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const other = { ...QUERY, id: 'q2', name: 'Partner share per week', createdAt: today, lastRunAt: today };
    const older = { ...QUERY, id: 'q3', name: 'Weekly volume since 2024', createdAt: old, lastRunAt: old };
    const calls = serve({ queries: [{ ...QUERY, createdAt: today }, other, older] });
    open('/query/q1');
    render(App, { config: CONFIG });
    await screen.findByRole('main');
    const panel = within(await screen.findByRole('complementary', { name: 'Query' }));
    expect(await panel.findByRole('link', { name: /Partner share per week/ })).toBeTruthy();
    // An older period shows with how many it holds, folded, and is read once opened.
    const period = panel.getAllByRole('button', { expanded: false }).find((button) => button.textContent?.trim().endsWith('1')) as HTMLElement;
    expect(panel.queryByRole('link', { name: /Weekly volume since 2024/ })).toBeNull();
    const lists = () => calls.filter((call) => call.path.startsWith('/queries?') && call.path.includes('from=')).length;
    const before = lists();
    await fireEvent.click(period);
    expect(await panel.findByRole('link', { name: /Weekly volume since 2024/ })).toBeTruthy();
    expect(lists()).toBe(before + 1);
    // Hidden with its eye: gone from the list, counted under Hidden, shown there again.
    await fireEvent.click(panel.getByRole('button', { name: 'Partner share per week verbergen' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/queries/q2/hidden' }));
    await vi.waitFor(() => expect(panel.queryByRole('link', { name: /Partner share per week/ })).toBeNull());
    // The filter folds open next to the search, as a small form (DEC-UX-150).
    const filter = panel.getByRole('button', { name: /^Filter: toon ook/ });
    expect(filter.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(filter);
    expect(filter.getAttribute('aria-expanded')).toBe('true');
    const hidden = await panel.findByRole('checkbox', { name: /Verborgen.*1$/ });
    await fireEvent.click(hidden);
    expect(await panel.findByRole('link', { name: /Partner share per week/ })).toBeTruthy();
    // Folded, one line says what it adds, and takes it away again.
    await fireEvent.click(filter);
    const off = panel.getByRole('button', { name: 'Verborgen niet meer tonen' });
    expect(panel.getByText('Ook getoond:')).toBeTruthy();
    await fireEvent.click(panel.getByRole('button', { name: 'Partner share per week weer tonen' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/queries/q2/hidden' }));
    await fireEvent.click(off);
    expect(panel.queryByText('Ook getoond:')).toBeNull();
    await fireEvent.click(filter);
    expect((panel.getByRole('checkbox', { name: /Verborgen/ }) as HTMLInputElement).checked).toBe(false);
    expect((panel.getByRole('button', { name: 'Herstel' }) as HTMLButtonElement).disabled).toBe(true);
    // A search looks through every period.
    await fireEvent.input(panel.getByRole('searchbox'), { target: { value: 'since 2024' } });
    await vi.waitFor(() => expect(calls.some((call) => call.path.includes('q=since+2024'))).toBe(true));
  });

  it('hides the query that is open from the quick window, as its page has no button for it, and shows it again (DEC-UX-138, DEC-UX-246)', async () => {
    const calls = serve({ queries: [{ ...QUERY, createdAt: new Date().toISOString() }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('button', { name: /Uitvoeren/ }, { timeout: 3000 });
    expect(main.queryByRole('button', { name: /^Verbergen$/ })).toBeNull();
    await quickDo('deze query verbergen');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/queries/q1/hidden' }));
    await quickDo('deze query weer tonen');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/queries/q1/hidden' }));
  });

  it('shows a power user what dbt and BigQuery know of a table outside Data Hub, from Show info as a double-click does (FR-SR-62, DEC-UX-247)', async () => {
    const table = '`immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads`';
    const calls = serve({ as: 'admin', queries: [{ ...QUERY, sql: `${QUERY.sql}\n-- reads\n    , ${table}` }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const editor = await main.findByRole('textbox', { name: /Leads per source name/ }, { timeout: 3000 });
    // Its name has the dotted line of a word a double-click explains, and says what it opens.
    await vi.waitFor(() => expect([...editor.querySelectorAll('.cm-explain')].some((word) => word.getAttribute('title') === 'Dubbelklik voor wat dbt en BigQuery ervan weten')).toBe(true), { timeout: 3000 });
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    const row = await quickRow('Info tonen');
    expect(row.textContent).toContain('de tabel stg_oltp__leads, waar de cursor staat');
    await fireEvent.keyDown(screen.getByRole('combobox', { name: 'Snelvenster' }), { key: 'Enter' });
    const window = within(await screen.findByRole('dialog', { name: 'stg_oltp__leads' }));
    await window.findByText('One row per lead as the OLTP database keeps it.');
    expect(calls).toContainEqual({ method: 'GET', path: '/outside-table?key=immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads' });
    const facts = (window.getByText('Uit BigQuery, nu').closest('div') as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
    expect(facts).toContain('Tabel · incremental in dbt');
    expect(facts).toContain('created_date, per dag · BigQuery vraagt er een filter op');
    expect(facts).toContain('lead_source');
    expect(facts).toContain('immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads');
    // Its columns, the partition column first and marked; a description from BigQuery says so; filtered by words.
    const columns = () => [...document.querySelectorAll('.columns .column .mono')].map((name) => name.textContent);
    expect(columns()).toEqual(['created_date', 'lead_source', 'lead_id']);
    expect(window.getByText('Source system code.').closest('.text')?.textContent).toContain('BigQuery');
    await fireEvent.input(window.getByRole('searchbox', { name: 'Filter de kolommen' }), { target: { value: 'source' } });
    expect(columns()).toEqual(['lead_source']);
    expect(window.getByRole('button', { name: /Volledige naam kopiëren/ })).toBeTruthy();
  });

  it('checks what is typed once it pauses two seconds, a query that opens at once (DEC-UX-154)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('button', { name: /Uitvoeren\s*80 MB/ }, { timeout: 3000 });
    const checks = () => calls.filter((call) => call.path === '/queries/q1/preflight').length;
    const before = checks();
    // A change in the editor, as typing is: the Pre-flight waits, and the line keeps what it said, softer.
    await typeInEditor(main.getByRole('textbox', { name: /Leads per source name/ }), ' -- typed');
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(checks()).toBe(before);
    expect(main.getByText('Pre-flight').closest('.status')?.classList.contains('stale')).toBe(true);
    await vi.waitFor(() => expect(checks()).toBe(before + 1), { timeout: 3000 });
    await vi.waitFor(() => expect(main.getByText('Pre-flight').closest('.status')?.classList.contains('stale')).toBe(false));
  });

  it('checks at once on Ctrl+Enter after typing, and runs as soon as it may (DEC-UX-154, DEC-UX-142)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('button', { name: /Uitvoeren\s*80 MB/ }, { timeout: 3000 });
    const checks = () => calls.filter((call) => call.path === '/queries/q1/preflight').length;
    const before = checks();
    await typeInEditor(main.getByRole('textbox', { name: /Leads per source name/ }), ' -- typed');
    await fireEvent.keyDown(main.getByRole('textbox', { name: /Leads per source name/ }), { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => expect(checks()).toBe(before + 1), { timeout: 800 });
    await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/queries/q1/runs')).toBe(true));
  });

  it('runs the query with Ctrl+Enter in its editor, as its button does (DEC-UX-142)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const run = await main.findByRole('button', { name: /Uitvoeren\s*80 MB/ }, { timeout: 3000 });
    await vi.waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.keyDown(main.getByRole('textbox', { name: /Leads per source name/ }), { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/queries/q1/runs')).toBe(true));
  });

  it('puts the query next to the result or above it, as the User keeps it, with a divider that gives either more room (DEC-UX-143, DEC-UX-144)', async () => {
    const calls = serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const divider = await main.findByRole('separator', {}, { timeout: 3000 });
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(divider.getAttribute('aria-valuenow')).toBe('55');
    await fireEvent.keyDown(divider, { key: 'ArrowDown' });
    expect(divider.getAttribute('aria-valuenow')).toBe('60');
    await fireEvent.click(main.getByRole('button', { name: 'De query naast het resultaat' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/query.layout', body: { value: 'sideBySide' } }));
    expect(main.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
    expect(main.getByRole('button', { name: 'De query naast het resultaat' }).getAttribute('aria-pressed')).toBe('true');
    localStorage.removeItem('datahub.query.split.horizontal');
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
    const calls = serve({ as: 'admin', queries: [{ ...QUERY, mine: false, ownerName: 'An Claes', lastRun: RUN, lastRunAt: RUN.startedAt }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Een query van An Claes: je leest hem, enkel An Claes schrijft en voert hem uit.')).toBeTruthy();
    expect(main.queryByRole('button', { name: /Uitvoeren/ })).toBeNull();
    expect(main.queryByRole('button', { name: 'Opmaken' })).toBeNull();
    expect(main.getByText(/Uitgevoerd door Max Verstraete als q-20261029-4c2e1a/)).toBeTruthy();
    expect(calls.some((call) => call.path.endsWith('/preflight'))).toBe(false);
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    await fireEvent.click(panel.getByRole('button', { name: /^Filter/ }));
    await fireEvent.click(panel.getByRole('radio', { name: /^Alle/ }));
    await vi.waitFor(() => expect(calls.some((call) => call.path.startsWith('/queries/days?') && call.path.includes('all=true'))).toBe(true));
  });

  it('lets who made a query change its name and question in place; a name stays required (DEC-UX-119, FR-SR-45)', async () => {
    const today = new Date().toISOString();
    const preview = { ...QUERY, id: 'q-preview', kind: 'preview', name: 'Preview · Weekly lead volume', question: '', createdAt: today };
    const calls = serve({ queries: [{ ...QUERY, createdAt: today }, preview] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // A preview of a Resource is a query of the User, marked so in the panel once Previews is ticked (DEC-UX-137, DEC-UX-150).
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    expect(await panel.findByRole('link', { name: /Leads per source name/ })).toBeTruthy();
    expect(panel.queryByRole('link', { name: /Preview · Weekly lead volume/ })).toBeNull();
    await fireEvent.click(panel.getByRole('button', { name: /^Filter: toon ook/ }));
    await fireEvent.click(panel.getByRole('checkbox', { name: /Voorbeelden.*1$/ }));
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
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: { sql: `${formatBigQuery(plain)} where week_start >= '2026-10-01'`, parameters: [] } }), { timeout: 3000 });
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
    const problem = await main.findByText('@leadChannel staat in de query, maar is geen Parameter.', {}, { timeout: 3000 });
    expect((main.getByRole('button', { name: /Uitvoeren/ }) as HTMLButtonElement).disabled).toBe(true);
    // One line: what stops the query in place of the Pre-flight, which fades out (DEC-UX-154).
    const layerOf = (element: Element) => element.closest('.layer') as HTMLElement;
    expect(layerOf(problem).classList.contains('shown')).toBe(true);
    expect(layerOf(main.getByText('Pre-flight')).getAttribute('aria-hidden')).toBe('true');
    await fireEvent.click(main.getByRole('button', { name: 'Definieer hem' }));
    const window = within(await screen.findByRole('dialog', { name: '@leadChannel definiëren' }));
    expect(window.getByRole('radio', { name: /Keuze/ }).getAttribute('aria-checked')).toBe('true');
    await fireEvent.input(window.getByRole('textbox', { name: 'De lijst' }), { target: { value: 'Form\nPhone\nForm' } });
    await fireEvent.click(window.getByRole('button', { name: 'Toevoegen' }));
    // Kept, the Parameter closes its window (DEC-UX-219).
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: /@leadChannel/ })).toBeNull());
    const leadChannel = { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] };
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/preflight', body: { sql: formatBigQuery(withParameters), parameters: [dateFrom, leadChannel] } }), { timeout: 3000 });
    await vi.waitFor(() => expect((main.getByRole('button', { name: /Uitvoeren\s*80 MB/ }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    expect(layerOf(main.getByText('Pre-flight')).classList.contains('shown')).toBe(true);
    expect(layerOf(problem).getAttribute('aria-hidden')).toBe('true');
  });

  it('shows its history, previews a run read only, and applies it to the query (DEC-UX-74, DEC-UX-99)', async () => {
    const first = { ...RUN, ref: 'q-20261027-0b1d2e', number: 1, sql: withParameters, parameters: [dateFrom, { name: 'leadChannel', kind: 'choice', value: 'Phone', list: ['Form', 'Phone'] }], startedAt: '2026-10-27T09:14:00Z' };
    const second = { ...RUN, number: 2 };
    const calls = serve({ queries: [{ ...QUERY, lastRun: second, lastRunAt: new Date().toISOString(), runs: 2, history: [second, first] }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // The query that is open unfolds in the panel to its last runs, with its arrow (DEC-UX-140).
    const panel = within(screen.getByRole('complementary', { name: 'Query' }));
    const unfold = await panel.findByRole('button', { name: 'De laatste uitvoeringen' });
    expect(unfold.getAttribute('aria-expanded')).toBe('false');
    expect(panel.queryByRole('link', { name: /Uitvoering 1/ })).toBeNull();
    await fireEvent.click(unfold);
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
    const calls = serve({ queries: [{ ...QUERY, createdAt: new Date().toISOString(), sql: `${QUERY.sql}-- every year\n` }] });
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
    expect(calls).toContainEqual({ method: 'POST', path: '/queries/q1/requests', body: { sql: formatBigQuery(`${QUERY.sql}-- every year\n`), parameters: [], text: 'For the five-year review.' } });
    expect(await within(screen.getByRole('complementary', { name: 'Query' })).findByText('Naar het Data Team')).toBeTruthy();
  });

  it('adds several Resources at once to a new query, each as a CTE at the start of its SQL (FR-SR-59, DEC-UX-225)', async () => {
    const more = [
      { ...CREDIT.resources[0]!, id: 'r5', key: 'immoscoop-dataplatform-398214.dbt_prod_listings.listings', displayName: 'Listings', published: true },
      { ...CREDIT.resources[0]!, id: 'r6', key: 'immoscoop-dataplatform-398214.dbt_prod_search.saved_searches', displayName: 'Saved searches', published: true },
    ];
    const calls = serve({ queries: [{ ...QUERY }], creditWith: { resources: [CREDIT.resources[0]!, ...more] } });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: 'Een Resource toevoegen' }, { timeout: 3000 }));
    const dialog = await screen.findByRole('dialog', { name: 'Met één Resource meer' });
    const sheet = within(dialog);
    // It opens to find: the focus is in its search at once (DEC-UX-245).
    expect(document.activeElement).toBe(sheet.getByRole('searchbox'));
    await fireEvent.click(await sheet.findByRole('checkbox', { name: /Listings/ }));
    await fireEvent.click(sheet.getByRole('checkbox', { name: /Saved searches/ }));
    expect(dialog.getAttribute('aria-label') ?? within(dialog).getByRole('heading', { level: 2 }).textContent).toMatch(/Met 2 Resources meer/);
    // The CTEs that come at the start of the SQL, before the new query starts.
    expect(await sheet.findByText(/listings as \(/, {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: /De nieuwe query starten/ }));
    await vi.waitFor(() => expect(location.pathname).toBe('/query/q-made'));
    expect(calls).toContainEqual({ method: 'POST', path: '/queries/ctes', body: { sql: QUERY.sql, resources: ['r5', 'r6'], tables: [] } });
    const made = calls.find((call) => call.method === 'POST' && call.path === '/queries')?.body as { resources: string[]; sql: string };
    expect(made.resources).toEqual(['r2', 'r5', 'r6']);
    expect(made.sql).toMatch(/^with\n\nlistings as \([\s\S]*\),\n\nsaved_searches as \([\s\S]*\)\n\nselect\n    week_start/);
  });

  it('lets a power user find tables Data Hub knows and add the ones ticked as CTEs at the start of the SQL (FR-SR-58, FR-SR-59)', async () => {
    serve({ queries: [{ ...QUERY }] });
    open('/query/q1');
    const { unmount } = render(App, { config: CONFIG });
    expect(await within(await screen.findByRole('main')).findByRole('button', { name: 'Een Resource toevoegen' }, { timeout: 3000 })).toBeTruthy();
    // Nobody else has it.
    expect(screen.queryByRole('button', { name: /Zoek een tabel/ })).toBeNull();
    unmount();

    const calls = serve({ as: 'admin', queries: [{ ...QUERY }] });
    open('/query/q1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Zoek een tabel/ }, { timeout: 3000 }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Zoek een tabel' }));
    // It opens to find: the focus is in its search at once (DEC-UX-245).
    expect(document.activeElement).toBe(sheet.getByRole('searchbox'));
    // A table that is a Resource cannot be ticked: it starts a new query with it.
    expect(await sheet.findByRole('button', { name: 'Begin er een nieuwe query mee' }, { timeout: 3000 })).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: 'Kolommen van stg_oltp__leads' }));
    expect(sheet.getByText('Day it came in.')).toBeTruthy();
    await fireEvent.click(sheet.getByRole('checkbox', { name: 'stg_oltp__leads' }));
    expect(await sheet.findByText(/stg_oltp__leads as \(/)).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: /Voeg 1 tabel toe/ }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zoek een tabel' })).toBeNull());
    expect(calls).toContainEqual({ method: 'POST', path: '/queries/ctes', body: { sql: QUERY.sql, resources: [], tables: ['immoscoop-dataplatform-398214.dbt_prod_staging.stg_oltp__leads'] } });
    expect(calls.some((call) => call.path.startsWith('/known-tables/search?q='))).toBe(true);
    await vi.waitFor(() => expect(main.getByRole('textbox', { name: /SQL/ }).textContent).toContain('stg_oltp__leads as ('));
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

/** Credit leads with folders: Leads in at its top holds By source and Weekly lead volume; By source holds the Lens; Response is empty. */
const FOLDERED = {
  folders: [
    { id: 'f1', name: 'Leads in', description: '', parentId: null, createdBy: 'An Claes', createdAt: '2026-10-20T08:00:00Z' },
    { id: 'f2', name: 'By source', description: 'Leads by where they came from.', parentId: 'f1', createdBy: 'An Claes', createdAt: '2026-10-21T08:00:00Z' },
    { id: 'f3', name: 'Response', description: '', parentId: null, createdBy: 'Dirk Vos', createdAt: '2026-10-22T08:00:00Z' },
  ],
  resources: [{ ...CREDIT.resources[0]!, folderId: 'f1' }],
  lensFolders: { l1: 'f2' },
};

/** What a drag carries, as a browser gives it. */
const transfer = () => ({ effectAllowed: 'all', dropEffect: 'none', setData: () => undefined, setDragImage: () => undefined });

describe('Folders', () => {
  it('keeps what a Collection holds in folders: the panel unfolds them, its page shows only its top (FR-CO-38, DEC-UX-156)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const folders = within(await main.findByRole('table', { name: 'Mappen' }));
    expect(folders.getByText('Leads in').closest('tr')?.textContent).toContain('1 map · 1 Resource');
    expect(folders.getByText('Response').closest('tr')?.textContent).toContain('Leeg');
    expect(main.getByText(/Geen Resource staat bovenaan in Credit leads: de Resource zit in een map/)).toBeTruthy();
    expect(main.getByText(/Geen Lens staat bovenaan in Credit leads/)).toBeTruthy();

    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect(panel.getByRole('link', { name: 'Leads in' }).getAttribute('href')).toBe('/collections/c1/folders/f1');
    expect(panel.queryByRole('link', { name: /Weekly lead volume/ })).toBeNull();
    await fireEvent.click(panel.getByRole('button', { name: 'Toon wat Leads in bevat' }));
    expect(panel.getByRole('link', { name: /Weekly lead volume/ })).toBeTruthy();
    await fireEvent.click(panel.getByRole('button', { name: 'Toon wat By source bevat' }));
    expect(panel.getByRole('link', { name: /Leads per source, week by week/ }).getAttribute('href')).toBe('/lenses/l1');
  });

  it('opens a folder on a page of its own, with the path above it, and a row opens with a click (FR-CO-38, DEC-UX-157)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { name: 'By source', level: 1 })).toBeTruthy();
    const path = within(main.getByRole('navigation', { name: 'Waar je bent' }));
    expect(path.getByRole('link', { name: 'Credit leads' }).getAttribute('href')).toBe('/collections/c1');
    expect(path.getByRole('link', { name: 'Leads in' }).getAttribute('href')).toBe('/collections/c1/folders/f1');
    // The panel unfolds to the folder whose page is open.
    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect(panel.getByRole('link', { name: 'By source' }).getAttribute('aria-current')).toBe('page');
    await fireEvent.click(within(main.getByRole('table', { name: 'In deze map' })).getByText('Max Verstraete', { exact: false }));
    expect(location.pathname).toBe('/lenses/l1');
  });

  it('lets a Data Admin take a Resource in a folder out of the Collection, as on the page of the Collection (DEC-UX-212)', async () => {
    const calls = serve({ as: 'admin', groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const table = within(await screen.findByRole('table', { name: 'In deze map' }));
    await fireEvent.click(await table.findByRole('button', { name: 'Weekly lead volume uit de Collection halen' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/collection' }));
    await vi.waitFor(() => expect(table.queryByText('Weekly lead volume')).toBeNull());
    // The row opens nothing on the way: the page stays the folder.
    expect(location.pathname).toBe('/collections/c1/folders/f1');
  });

  it('shows no such button on the page of a folder to whoever may not remove Resources from a Collection', async () => {
    serve({ as: 'lensUser', groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const table = within(await screen.findByRole('table', { name: 'In deze map' }));
    expect(await table.findByText('Weekly lead volume')).toBeTruthy();
    expect(table.queryByRole('button', { name: /uit de Collection halen/ })).toBeNull();
  });

  it('lets its Owner Unit take a Resource that is not published out of the Collection, on the page of a folder (DEC-UX-214, FR-CO-43)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const table = within(await screen.findByRole('table', { name: 'In deze map' }));
    await fireEvent.click(await table.findByRole('button', { name: 'Weekly lead volume uit de Collection halen' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/resources/r2/collection' }));
  });

  it('tells its Owner Unit in the Danger zone that only the Data Team takes a published Resource out now (DEC-UX-214)', async () => {
    serve({ groups: ['g1'], weekly: { published: true, level: 3, canRemove: false } });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(main.getByRole('tab', { name: 'Gevarenzone' }));
    const danger = within(main.getByRole('tabpanel', { name: 'Gevarenzone' }));
    expect(danger.getByRole('heading', { name: 'Uit de Collection halen' })).toBeTruthy();
    expect(danger.getByText(/Weekly lead volume is gepubliceerd: collega’s kunnen erop rekenen, dus enkel het Data Team haalt hem nu uit Credit leads/)).toBeTruthy();
    expect(danger.queryByRole('button', { name: /Uit Credit leads halen/ })).toBeNull();
  });

  it('makes, renames and deletes folders, only an empty one, with a warning for one that is not (FR-CO-39)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Nieuwe map/ }));
    const name = main.getByRole('textbox', { name: 'Naam van de nieuwe map' });
    await fireEvent.input(name, { target: { value: 'Paid' } });
    await fireEvent.keyDown(name, { key: 'Enter' });
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/collections/c1/folders', body: { name: 'Paid', parentId: 'f1' } }));
    expect(await main.findByText('Paid')).toBeTruthy();

    // Delete stays on: on a folder that holds something it says so, and deletes nothing.
    await fireEvent.click(main.getByRole('button', { name: 'Verwijder de map, zodra ze leeg is' }));
    expect(await main.findByText('Leads in is niet leeg.')).toBeTruthy();
    expect(main.getByText(/Ze bevat nog 2 mappen · 1 Resource/)).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

    // Its name and description change in place, as those of a query do (DEC-UX-162, FR-CO-42): only what changed is sent.
    await fireEvent.click(within(main.getByRole('heading', { name: 'Leads in', level: 1 })).getByRole('button'));
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Leads coming in' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1/folders/f1', body: { name: 'Leads coming in' } }));
    expect(await main.findByRole('heading', { name: 'Leads coming in', level: 1 })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Een beschrijving toevoegen' }));
    await fireEvent.input(main.getByRole('textbox', { name: 'Beschrijving' }), { target: { value: 'Every lead as it comes in.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1/folders/f1', body: { description: 'Every lead as it comes in.' } }));
    expect(await main.findByText('Every lead as it comes in.')).toBeTruthy();
    // Escape puts it back without saving.
    await fireEvent.click(main.getByRole('button', { name: 'Every lead as it comes in.' }));
    await fireEvent.keyDown(main.getByRole('textbox', { name: 'Beschrijving' }), { key: 'Escape' });
    expect(main.queryByRole('textbox', { name: 'Beschrijving' })).toBeNull();

    // An empty folder goes, and its Collection opens.
    await fireEvent.click(within(screen.getByRole('complementary', { name: 'Collections' })).getByRole('link', { name: 'Response' }));
    expect(await main.findByRole('heading', { name: 'Response', level: 1 })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Verwijder de map, zodra ze leeg is' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/collections/c1/folders/f3' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/collections/c1'));
  });

  it('moves a Resource onto a folder by dragging its row, and says where it went (FR-CO-40, DEC-UX-157)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const table = within(await main.findByRole('table', { name: 'In deze map' }));
    const row = table.getByText('Weekly lead volume').closest('tr')!;
    const folder = table.getByText('By source').closest('tr')!;
    expect(row.getAttribute('draggable')).toBe('true');
    const dataTransfer = transfer();
    await fireEvent.dragStart(row, { dataTransfer });
    await fireEvent.dragOver(folder, { dataTransfer });
    expect(folder.classList.contains('drop')).toBe(true);
    await fireEvent.drop(folder, { dataTransfer });
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PUT', path: '/collections/c1/places/resource/r2', body: { folderId: 'f2' } }));
    const said = await screen.findByText(/Weekly lead volume verplaatst naar/);
    expect(said.closest('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Weekly lead volume verplaatst naar By source');
  });

  it('never lets a folder go into itself or into a folder inside it (FR-CO-40)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }], creditWith: FOLDERED });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    const leadsIn = (await panel.findByRole('link', { name: 'Leads in' })).closest('.folder')!;
    const bySource = panel.getByRole('link', { name: 'By source' }).closest('.folder')!;
    const dataTransfer = transfer();
    await fireEvent.dragStart(leadsIn, { dataTransfer });
    await fireEvent.dragOver(bySource, { dataTransfer });
    expect(bySource.classList.contains('drop')).toBe(false);
    await fireEvent.dragOver(panel.getByRole('link', { name: 'Response' }).closest('.folder')!, { dataTransfer });
    expect(panel.getByRole('link', { name: 'Response' }).closest('.folder')!.classList.contains('drop')).toBe(true);
    await fireEvent.dragEnd(leadsIn, { dataTransfer });
  });

  it('lets a colleague open folders, and drag nothing (FR-CO-39, DEC-CO-26)', async () => {
    serve({ groups: ['g2'], lenses: [{ ...LENS }], creditWith: { ...FOLDERED, canManage: false } });
    open('/collections/c1/folders/f1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const table = within(await main.findByRole('table', { name: 'In deze map' }));
    expect(table.getByText('Weekly lead volume').closest('tr')?.hasAttribute('draggable')).toBe(false);
    expect(main.queryByRole('button', { name: /Nieuwe map/ })).toBeNull();
    expect(main.queryByRole('button', { name: 'Verwijder de map, zodra ze leeg is' })).toBeNull();
  });

  it('shows the intro of a Collection as written, never as HTML, and edits it in Markdown (FR-CO-41, DEC-UX-158)', async () => {
    const intro = '### Start here\n**Weekly** volumes first; see [Leads in](/collections/c1/folders/f1).\n\n<b>not bold</b>';
    const calls = serve({ groups: ['g1'], creditWith: { intro } });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const about = within(await main.findByRole('region', { name: 'Over deze Collection' }));
    expect(about.getByRole('heading', { name: 'Start here', level: 3 })).toBeTruthy();
    expect(about.getByText('Weekly').tagName).toBe('STRONG');
    expect(about.getByRole('link', { name: 'Leads in' }).getAttribute('href')).toBe('/collections/c1/folders/f1');
    expect(about.getByText('<b>not bold</b>')).toBeTruthy();

    await fireEvent.click(about.getByRole('button', { name: /Bewerk de intro/ }));
    const field = (await main.findByRole('textbox', { name: 'Intro' })) as HTMLTextAreaElement;
    expect(field.value).toBe(intro);
    field.setSelectionRange(field.value.length, field.value.length);
    await fireEvent.click(main.getByRole('button', { name: 'Lijst' }));
    expect(field.value.endsWith('- <b>not bold</b>')).toBe(true);
    await fireEvent.click(main.getByRole('radio', { name: 'Voorbeeld' }));
    expect(main.getByRole('listitem').textContent).toBe('<b>not bold</b>');
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1', body: { intro: intro.replace('<b>not bold</b>', '- <b>not bold</b>') } }));
  });
});

describe('Lenses', () => {
  it('makes a Lens of a query, with what it does step by step, into a Collection its author owns (FR-LE-07, FR-LE-08, DEC-UX-121)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY, sql: `${QUERY.sql} where 1 = 1`, parameters: [{ name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' }] }] });
    open('/query/q1/lens');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Maak er een Lens van' })).toBeTruthy();
    // A flow of four steps, one at a time; on the right each with how far it is (DEC-UX-229).
    const steps = within(main.getByRole('navigation', { name: 'Stappen van de Lens' }));
    expect(main.getByRole('heading', { level: 2, name: 'Wat hij is' })).toBeTruthy();
    expect((await main.findByRole('textbox', { name: 'Naam' }) as HTMLInputElement).value).toBe('Leads per source name');
    await vi.waitFor(() => expect(steps.getByRole('button', { name: /Wat hij is.*Leads per source name · Credit leads/ })).toBeTruthy());
    await fireEvent.input(main.getByRole('textbox', { name: /Wat hij doet, stap voor stap/ }), { target: { value: 'Takes the weekly lead volume.\n\nAdds the sources.' } });
    // Within range: its author publishes it, from any step (FR-LE-08).
    expect(await main.findByText('Binnen de grenzen.')).toBeTruthy();

    await fireEvent.click(main.getByRole('button', { name: /Volgende: Tags/ }));
    const tag = main.getByRole('textbox', { name: 'Een tag toevoegen' });
    await fireEvent.input(tag, { target: { value: '#Leads' } });
    await fireEvent.keyDown(tag, { key: 'Enter' });
    expect(steps.getByRole('button', { name: /Tags.*1 tag/ })).toBeTruthy();

    // The Parameters come from the query, each with the name Users see; its default stands as its function (DEC-UX-75).
    await fireEvent.click(steps.getByRole('button', { name: /Parameters/ }));
    expect(((await main.findByRole('textbox', { name: 'Naam die Users zien van @dateFrom' })) as HTMLInputElement).value).toBe('Date from');
    expect(main.getByText('Begin van dit jaar')).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam die Users zien van @dateFrom' }), { target: { value: 'From' } });

    // Its fields: one named as a field of its Resources takes that description; another its author takes from its
    // Resources or writes; without one it still publishes (DEC-UX-227, FR-LE-19).
    expect(steps.getByRole('button', { name: /Zijn velden.*3 velden · 2 zonder beschrijving/ })).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Volgende: Zijn velden/ }));
    expect(main.getByText('Monday of the week')).toBeTruthy();
    const pick = main.getAllByRole('button', { name: /Neem er een van zijn Resources/ });
    await fireEvent.click(pick[0] as HTMLElement);
    await fireEvent.input(main.getByRole('searchbox', { name: 'Zoek in de velden van zijn Resources' }), { target: { value: 'monday' } });
    await fireEvent.click(main.getByRole('button', { name: /week_start.*Monday of the week/ }));
    expect(main.getByText(/Overgenomen van Weekly lead volume/)).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Schrijf er een' }));
    await fireEvent.input(main.getByRole('textbox', { name: 'Beschrijving van share' }), { target: { value: 'The share of the week, in percent.' } });
    expect(steps.getByRole('button', { name: /Zijn velden.*3 velden/ }).textContent).not.toContain('zonder beschrijving');
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
        fields: [
          { name: 'week_start', description: 'Monday of the week', from: { resourceId: 'r2', field: 'week_start' } },
          { name: 'leads', description: 'Monday of the week', from: { resourceId: 'r2', field: 'week_start' } },
          { name: 'share', description: 'The share of the week, in percent.', from: null },
        ],
        approve: false,
        text: '',
      },
    });
  });

  it('runs a Lens only when its User runs it, with the values they chose, and marks a result for old values (FR-LE-12, DEC-LE-12)', async () => {
    const fields = [
      { name: 'week_start', type: 'DATE', description: 'The Monday of the week.', from: { resourceId: 'r2', field: 'week_start' } },
      { name: 'leads', type: 'INT64', description: 'How many leads came in.', from: null },
    ];
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS, fields }] });
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
    // A field with a description shows it on a hover of the head of its column, with a dotted line under its name (DEC-UX-230).
    const head = within(main.getByRole('grid')).getByText('week_start');
    expect(head.getAttribute('title')).toBe('week_start: The Monday of the week.');
    expect(head.classList.contains('described')).toBe(true);
    await fireEvent.click(main.getByRole('button', { name: 'Standaard' }));
    expect(await main.findByText('De Parameters veranderden.')).toBeTruthy();
    // About tells what it does as its author wrote it, never its SQL (FR-LE-14, DEC-UX-121).
    await fireEvent.click(main.getByRole('tab', { name: 'Over' }));
    expect(main.getByText('Keeps one lead channel.')).toBeTruthy();
    expect(main.getByText('Geschreven door wie hem maakte, in gewone taal.')).toBeTruthy();
    expect(main.queryByText(/select/)).toBeNull();
    // Its fields, each with its type, its description and where that comes from (DEC-UX-230, FR-LE-19).
    const its = within(main.getByRole('table', { name: 'Zijn velden' }));
    expect(its.getByText('The Monday of the week.')).toBeTruthy();
    expect(its.getByText(/Van Weekly lead volume/)).toBeTruthy();
    expect(its.getByText('Geschreven door wie hem maakte')).toBeTruthy();
  });

  it('gives the address of a Lens for Excel, with the steps and a way to an Excel key (FR-PL-01, DEC-UX-159)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Open in Excel/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Open in Excel' }));
    expect(sheet.getByText('https://query.test/excel/lenses/l1')).toBeTruthy();
    expect(sheet.getByText(/hoogstens 10.000 rijen/)).toBeTruthy();
    expect(sheet.getByRole('link', { name: 'Nog geen key? Maak er een op Mijn pagina.' }).getAttribute('href')).toBe('/me/keys');
    await fireEvent.click(sheet.getByRole('button', { name: 'Klaar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('lists the Lenses of a Collection on its page and in the panel (FR-CO-28, FR-CO-36)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const table = within(await main.findByRole('table', { name: 'Lenses' }));
    expect(table.getByText('Max Verstraete')).toBeTruthy();
    const panel = within(screen.getByRole('complementary', { name: 'Collections' }));
    expect(panel.getByRole('link', { name: /Leads per source, week by week/ }).getAttribute('href')).toBe('/lenses/l1');
    // The row is no link: a click anywhere on it opens the Lens, so that a drag anywhere on it moves it (DEC-UX-157).
    await fireEvent.click(table.getByText('Max Verstraete'));
    expect(location.pathname).toBe('/lenses/l1');
  });

  it('shows the Collections with Resources, Lenses or both, as the filter next to the search says (DEC-UX-150, DEC-UX-151)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    const filter = await panel.findByRole('button', { name: 'Filter: welke Collections, en Resources, Lenses of beide' });
    await fireEvent.click(filter);
    const resources = panel.getByRole('checkbox', { name: /^Resources/ }) as HTMLInputElement;
    const lenses = panel.getByRole('checkbox', { name: /^Lenses/ }) as HTMLInputElement;
    expect(resources.checked && lenses.checked).toBe(true);
    // Only Lenses: the Collections that hold one, unfolded to them, and no Resources.
    await fireEvent.click(resources);
    expect(await panel.findByRole('link', { name: /Leads per source, week by week/ })).toBeTruthy();
    expect(panel.queryAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/resources/'))).toEqual([]);
    // One kind always stays.
    expect(lenses.disabled).toBe(true);
    // Folded, one line says what is left out, and its cross brings it back.
    await fireEvent.click(filter);
    expect(panel.getByText('Niet getoond:')).toBeTruthy();
    await fireEvent.click(panel.getByRole('button', { name: 'Resources weer tonen' }));
    expect(panel.queryByText('Niet getoond:')).toBeNull();
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

  it('changes the name of a Lens with a click on it, its other parts with Edit more (DEC-UX-162)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    const heading = await main.findByRole('heading', { level: 1, name: /Leads per source, week by week/ });
    await fireEvent.click(within(heading).getByRole('button'));
    // Its name alone: what it shows and its steps stay for Edit more.
    expect(main.queryByRole('textbox', { name: 'Beschrijving' })).toBeNull();
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Leads per source, per week' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/lenses/l1', body: { name: 'Leads per source, per week' } }));
    expect(await main.findByRole('heading', { level: 1, name: /Leads per source, per week/ })).toBeTruthy();
    expect(main.getByRole('link', { name: 'Meer bewerken' }).getAttribute('href')).toBe('/lenses/l1/edit');
  });

  it('deletes a Lens from its Edit: a small button under Save opens a sheet that says what it does (FR-LE-18, DEC-UX-185)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY }], lenses: [{ ...LENS, usedBy: 4 }] });
    open('/lenses/l1/edit');
    render(App, { config: CONFIG });
    const edit = within(await screen.findByRole('main'));
    await fireEvent.click(await edit.findByRole('button', { name: 'Deze lens verwijderen…' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Deze lens verwijderen' }));
    expect(sheet.getByText('Leads per source, week by week')).toBeTruthy();
    expect(sheet.getByText('4 collega’s gebruikten hem de voorbije 30 dagen,')).toBeTruthy();
    // "Behouden" closes it without deleting.
    await fireEvent.click(sheet.getByRole('button', { name: 'Behouden' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

    await fireEvent.click(edit.getByRole('button', { name: 'Deze lens verwijderen…' }));
    const again = within(await screen.findByRole('dialog', { name: 'Deze lens verwijderen' }));
    await fireEvent.input(again.getByRole('textbox', { name: 'Waarom je hem verwijdert · optioneel' }), { target: { value: ' Replaced by the weekly lens. ' } });
    await fireEvent.click(again.getByRole('button', { name: 'Voorgoed verwijderen' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/collections/c1'));
    expect(calls).toContainEqual({ method: 'DELETE', path: '/lenses/l1', body: { reason: 'Replaced by the weekly lens.' } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says at the address of a deleted Lens that it was deleted, by whom, when and why, and runs nothing (FR-LE-18)', async () => {
    serve({ groups: ['g1'], lenses: [{ ...LENS, gone: { at: '2026-11-04T10:00:00Z', byName: 'Max Verstraete', reason: 'Replaced by the weekly lens' } }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const gone = within(await screen.findByRole('main'));
    expect(await gone.findByText('Deze Lens werd verwijderd')).toBeTruthy();
    expect(gone.getByRole('heading', { level: 1, name: /Leads per source, week by week$/ })).toBeTruthy();
    expect(gone.getByText(/door Max Verstraete op 4 nov\.? 2026: Replaced by the weekly lens\. Hij draait niet meer, ook niet in Excel\./)).toBeTruthy();
    // The breadcrumb and a button lead to its Collection.
    expect(gone.getAllByRole('link', { name: 'Credit leads' }).map((link) => link.getAttribute('href'))).toEqual(['/collections/c1', '/collections/c1']);
    expect(gone.queryByRole('button', { name: /Run/ })).toBeNull();
    // It is listed nowhere.
    expect(within(screen.getByRole('complementary', { name: /Collections/ })).queryByText('Leads per source, week by week')).toBeNull();
  });

  it('edits a Lens in the same four steps, Its fields included, also of a Lens made before it had them (DEC-UX-231)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY }], lenses: [{ ...LENS }] });
    open('/lenses/l1/edit');
    render(App, { config: CONFIG });
    const edit = within(await screen.findByRole('main'));
    expect(await edit.findByRole('heading', { level: 1, name: 'De Lens bewerken' })).toBeTruthy();
    const steps = within(edit.getByRole('navigation', { name: 'Stappen van de Lens' }));
    expect(edit.getByRole('heading', { level: 2, name: 'Wat hij is' })).toBeTruthy();
    await fireEvent.click(steps.getByRole('button', { name: /Parameters.*2 Parameters/ }));
    expect(((await edit.findByRole('textbox', { name: 'Naam die Users zien van @dateFrom' })) as HTMLInputElement).value).toBe('From');
    // Made before its fields had descriptions: its columns from its Pre-flight, a field of its Resources of the same name gives its own.
    await fireEvent.click(steps.getByRole('button', { name: /Zijn velden/ }));
    expect(await edit.findByText('Monday of the week')).toBeTruthy();
    await vi.waitFor(() => expect(steps.getByRole('button', { name: /Zijn velden.*3 velden · 2 zonder beschrijving/ })).toBeTruthy());
    await fireEvent.click(edit.getAllByRole('button', { name: 'Schrijf er een' })[1] as HTMLElement);
    await fireEvent.input(edit.getByRole('textbox', { name: 'Beschrijving van share' }), { target: { value: 'The share of the week, in percent.' } });
    await fireEvent.click(edit.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/lenses/l1'));
    expect(calls.find((call) => call.method === 'PATCH' && call.path === '/lenses/l1')?.body).toMatchObject({
      fields: [
        { name: 'week_start', description: 'Monday of the week', from: { resourceId: 'r2', field: 'week_start' } },
        { name: 'share', description: 'The share of the week, in percent.', from: null },
      ],
    });
  });

  it('opens the query of a Lens for its Owner Unit, and edits what it tells, never its SQL (DEC-LE-18, FR-LE-06)', async () => {
    const calls = serve({ groups: ['g1'], queries: [{ ...QUERY }], lenses: [{ ...LENS }] });
    open('/lenses/l1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('link', { name: 'Meer bewerken' }));
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

  it('starts a new Lens from its Collection with a query that remembers it (DEC-UX-123, DEC-UX-134, DEC-UX-145)', async () => {
    const calls = serve({ groups: ['g1'], lenses: [{ ...LENS }] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    // Next to the heading Lenses, how a Lens is made; the head has no "New Lens" of its own.
    const links = [await main.findByRole('link', { name: 'Lens toevoegen: start een query' })];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/query/new/for/c1']);
    expect(main.queryByRole('link', { name: 'Nieuwe Lens' })).toBeNull();

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
  it('counts what moved for the User in the rail, and lists it in the Message Centre, unread first (FR-CV-06, DEC-UX-136)', async () => {
    const calls = serve({ groups: ['g1'], conversations: [QUESTION, DESCRIBED] });
    open('/messages');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('link', { name: 'Berichten, 1 ongelezen' })).toBeTruthy();
    const main = within(await screen.findByRole('main'));
    // It opens on what moved since the User last looked.
    expect(await main.findByRole('heading', { level: 1, name: 'Ongelezen' })).toBeTruthy();
    expect(await main.findByText('Will KBC follow-up be published this month?')).toBeTruthy();
    expect(main.getByRole('img', { name: 'Ongelezen' })).toBeTruthy();
    expect(main.queryByText(/Eén beschrijving van Weekly lead volume/)).toBeNull();
    // The panel filters on the views, the kinds and the kinds of object.
    const panel = within(screen.getByRole('navigation', { name: 'Berichten' }));
    expect(panel.getByRole('button', { name: /Ongelezen/ }).getAttribute('aria-current')).toBe('true');
    // For you: a person's words, and the first line of what Data Hub tells, from the Message Catalogue (FR-CV-15).
    await fireEvent.click(panel.getByRole('button', { name: /Voor jou/ }));
    expect(await main.findByRole('heading', { level: 1, name: 'Voor jou' })).toBeTruthy();
    expect(await main.findByText('Eén beschrijving van Weekly lead volume is gewijzigd in dbt. Je businessbeschrijvingen blijven zoals ze zijn, en er wordt niets van je gevraagd.')).toBeTruthy();
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

  it('lets whoever may close it close a Question with a line why, shows it closed, and reopens it (FR-CV-16, DEC-UX-179)', async () => {
    const calls = serve({ groups: ['g1'], conversations: [{ ...QUESTION, mayClose: true }] });
    open('/messages/m1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Sluiten/ }));
    // Its writer hears it; the line why is not needed.
    expect(main.getByText('Ruth Aerts krijgt een melding dat je het sloot. Ieder van jullie kan het heropenen.')).toBeTruthy();
    await fireEvent.input(main.getByRole('textbox', { name: 'Deze Question sluiten' }), { target: { value: 'Published last week.' } });
    const close = main.getAllByRole('button', { name: /Sluiten/ }).at(-1)!;
    expect((close as HTMLButtonElement).disabled).toBe(false);
    await fireEvent.click(close);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/close', body: { text: 'Published last week.' } }));
    // Closed: who closed it and why, in the conversation, and Reopen in place of Close.
    expect(await main.findByText('Published last week.')).toBeTruthy();
    expect(main.getAllByText('Gesloten').length).toBeGreaterThan(0);
    expect(main.queryByRole('button', { name: /^Sluiten$/ })).toBeNull();
    await fireEvent.click(main.getByRole('button', { name: /Heropenen/ }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/reopen' }));
    expect(await main.findByRole('button', { name: /Sluiten/ })).toBeTruthy();
  });

  it('does the Messages from the quick window: another view, Mark all as read, Close and Reopen (DEC-UX-255)', async () => {
    const other = { ...QUESTION, id: 'm3', params: { ...QUESTION.params, text: 'Is the partner feed late again?' } };
    const calls = serve({ groups: ['g1'], conversations: [{ ...QUESTION, mayClose: true }, other, DESCRIBED] });
    open('/messages');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Ongelezen' })).toBeTruthy();
    // Another view of the panel, by its name.
    await quickDo('voor jou tonen');
    expect(await main.findByRole('heading', { level: 1, name: 'Voor jou' })).toBeTruthy();
    // Every unread Message of the list shown, read at once.
    await main.findByText('Is the partner feed late again?');
    const row = await quickRow('Alles als gelezen markeren');
    expect(row.textContent).toContain('2 ongelezen Messages in deze lijst');
    await closeQuick();
    await quickDo('alles als gelezen');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/read' }));
    expect(calls).toContainEqual({ method: 'POST', path: '/messages/m3/read' });
    // On an opened Message: Close opens the field for why, with the cursor in it; then Reopen.
    await fireEvent.click(main.getByRole('link', { name: /Will KBC follow-up/ }));
    await main.findByRole('button', { name: /^Sluiten$/ });
    await quickDo('deze message sluiten');
    const why = await main.findByRole('textbox', { name: 'Deze Question sluiten' });
    await vi.waitFor(() => expect(document.activeElement).toBe(why));
    await fireEvent.click(main.getAllByRole('button', { name: /Sluiten/ }).at(-1)!);
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/close', body: { text: '' } }));
    await main.findByRole('button', { name: /Heropenen/ });
    await quickDo('deze message heropenen');
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/messages/m1/reopen' }));
  });

  it('offers no Close to whoever may not close a Question (FR-CV-16)', async () => {
    serve({ groups: ['g1'], conversations: [{ ...QUESTION, mayClose: false }] });
    open('/messages/m1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Will KBC follow-up be published this month?')).toBeTruthy();
    expect(main.queryByRole('button', { name: /Sluiten/ })).toBeNull();
  });

  it('says there is nothing to catch up on when nothing is unread, and only then (DEC-UX-136)', async () => {
    serve({ groups: ['g1'], conversations: [DESCRIBED] });
    open('/messages');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Niets in te halen: je hebt alles gelezen.')).toBeTruthy();
    // Filtered on a kind, nothing found is not the same as nothing to catch up on.
    await fireEvent.click(within(screen.getByRole('navigation', { name: 'Berichten' })).getByRole('button', { name: /Questions/ }));
    expect(await main.findByText('Hier zijn geen berichten.')).toBeTruthy();
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
    const calls = serve({ as: 'admin', conversations: [REQUEST] });
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

  it('opens the Messages of a Resource with the cursor in the text, and on a Remark or a Signal from the quick window (DEC-UX-257)', async () => {
    serve({ groups: ['g1'] });
    open('/resources/r2/messages');
    const { unmount } = render(App, { config: CONFIG });
    let sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    await vi.waitFor(() => expect(document.activeElement).toBe(sheet.getByRole('textbox', { name: 'Nieuw bericht' })));
    unmount();

    const calls = serve({ groups: ['g1'] });
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Weekly lead volume' }, { timeout: 3000 });
    await quickDo('een signal toevoegen');
    sheet = within(await screen.findByRole('dialog', { name: 'Weekly lead volume' }));
    expect(sheet.getByRole('radio', { name: 'Signal' }).getAttribute('aria-checked')).toBe('true');
    await vi.waitFor(() => expect(document.activeElement).toBe(sheet.getByRole('textbox', { name: 'Nieuw bericht' })));
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
    // Closing it leaves the page of the object as it is, not the Message Centre (DEC-UX-210).
    await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Credit leads' })).toBeNull());
    expect(location.pathname).toBe('/collections/c1');
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Credit leads' })).toBeTruthy();
  });
});

describe('Charts, the gallery of semgraph', () => {
  it('opens on its first chart, with the charts semgraph offers in the panel by the question they answer (FR-CH-06, DEC-UX-182)', async () => {
    const calls = serve();
    open('/charts');
    render(App, { config: CONFIG });
    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('heading', { level: 1, name: 'Voortschrijdend gemiddelde' })).toBeTruthy();
    expect(location.pathname).toBe('/charts/movingWindowAverage');
    expect(document.title).toBe('local · Data Hub — Voortschrijdend gemiddelde');
    // The panel: one line on the charts, then the groups of the design with what semgraph offers in each, in their order.
    const panel = screen.getByRole('complementary', { name: 'Grafieken' });
    expect(within(panel).getByText('De grafieken die semgraph tekent, elk voor één soort vraag, en niets wat zou misleiden.')).toBeTruthy();
    const index = await within(panel).findByRole('navigation', { name: 'Grafieken' });
    expect([...index.children].map((child) => child.textContent?.trim())).toEqual([
      'In de tijd',
      'Voortschrijdend gemiddelde',
      'Vergelijken',
      'Vergelijking met de vorige periode',
      'Nu en het doel',
      'KPI-tegel',
      'Spreiding',
      'Verdeling',
    ]);
    expect(within(index).getByRole('link', { name: 'Voortschrijdend gemiddelde' }).getAttribute('aria-current')).toBe('page');
    expect(within(index).getByRole('link', { name: 'KPI-tegel' }).getAttribute('href')).toBe('/charts/kpiTile');
    // The head: the group, the name and id, and the question it answers.
    expect(within(main).getByText('Grafieken · In de tijd')).toBeTruthy();
    expect(within(main).getByText('movingWindowAverage')).toBeTruthy();
    expect(within(main).getByText('Hoe evolueert dit, zonder dagelijkse ruis?')).toBeTruthy();
    // Its examples, without the one that only shows the dark theme, the first drawn in the theme of the page, its SVG in the page (DEC-UX-184).
    const examples = within(main).getByRole('tablist', { name: 'Voorbeelden' });
    expect(within(examples).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Basic', 'Long horizon', 'Window 10', 'Unique without aggregation']);
    expect(within(examples).getByRole('tab', { name: 'Basic' }).getAttribute('aria-selected')).toBe('true');
    const drawing = await within(main).findByRole('group', { name: 'Voortschrijdend gemiddelde: Kredietleads per dag (voorbeelddata)' });
    expect(drawing.querySelector('svg > title')?.textContent).toBe('basic');
    expect(drawing.querySelector('img')).toBeNull();
    expect(calls.map((call) => call.path)).toContain('https://semgraph.test/semgraphs/movingWindowAverage/examples/basic?theme=light');
    expect(calls.map((call) => call.path)).toContain('https://semgraph.test/semgraphs?locale=nl-BE');
    // Beside it: the questions it is for, what to use instead, what it needs and where a User meets it.
    expect(within(main).getByText('Hoe evolueerden de kredietleads de voorbije vier weken?')).toBeTruthy();
    expect(within(main).getByRole('link', { name: 'Vergelijking met de vorige periode' }).getAttribute('href')).toBe('/charts/periodComparison');
    expect(within(main).getByText(/^Het totaal tot nu:/).textContent?.replace(/\s+/g, ' ').trim()).toBe('Het totaal tot nu: cumulative (nog niet in semgraph)');
    expect(within(main).getByText('De blokken, berekend in BigQuery, minstens 28; semgraph tekent, het rekent nooit over rijen.')).toBeTruthy();
    expect(within(main).getByText('"semgraph": "movingWindowAverage"')).toBeTruthy();
  });

  it('says how semgraph drew an example: with a warning, with a caution, or why it refuses it', async () => {
    serve();
    open('/charts/movingWindowAverage');
    render(App, { config: CONFIG });
    const main = await screen.findByRole('main');
    await within(main).findByRole('group', { name: /^Voortschrijdend gemiddelde:/ });
    expect(within(main).queryByText('Getekend, met een waarschuwing')).toBeNull();
    await fireEvent.click(within(main).getByRole('tab', { name: 'Window 10' }));
    expect(await within(main).findByText('Getekend, met een waarschuwing')).toBeTruthy();
    await fireEvent.click(within(main).getByRole('tab', { name: 'Unique without aggregation' }));
    expect(await within(main).findByText('semgraph weigert deze')).toBeTruthy();
    expect(within(main).getByText('uniqueAggregationRequired')).toBeTruthy();
    expect(within(main).getByText('Geweigerd')).toBeTruthy();
    expect(within(main).queryByRole('group', { name: /^Voortschrijdend gemiddelde:/ })).toBeNull();
    // Another chart, from the panel: its first example, drawn with a caution in red; the one only in a size is not listed.
    await fireEvent.click(screen.getByRole('link', { name: 'KPI-tegel' }));
    expect(await within(main).findByText('Getekend, met een kanttekening in het rood')).toBeTruthy();
    expect(within(main).getByText('Grafieken · Nu en het doel')).toBeTruthy();
    expect(within(main).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Few leads']);
    expect(location.pathname).toBe('/charts/kpiTile');
  });

  it('asks semgraph for the theme of the page, and its words in the language of the User', async () => {
    const calls = serve({ settings: { language: 'en' } });
    open('/charts/movingWindowAverage');
    render(App, { config: CONFIG });
    const main = await screen.findByRole('main');
    await within(main).findByRole('group', { name: /^Voortschrijdend gemiddelde:/ });
    expect(within(main).getByText('Charts · Over time')).toBeTruthy();
    expect(calls.map((call) => call.path)).toContain('https://semgraph.test/semgraphs/movingWindowAverage?locale=en');
    await fireEvent.click(screen.getByRole('button', { name: 'Switch to dark' }));
    await vi.waitFor(() => expect(calls.map((call) => call.path)).toContain('https://semgraph.test/semgraphs/movingWindowAverage/examples/basic?theme=dark'));
  });

  it('shows a chart semgraph does not offer as a page there is nothing at', async () => {
    serve();
    open('/charts/nothing');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
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
    expect(document.title).toBe('local · Data Hub — Learning Centre');
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
    expect(document.title).toBe('local · Data Hub — K3.4 Waar definities leven');
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
    await fireEvent.click(await screen.findByRole('tab', { name: 'Beschrijving' }));
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
    await fireEvent.click(screen.getByRole('tab', { name: 'Beschrijving' }));
    await fireEvent.keyDown(screen.getByRole('button', { name: /^modeltype: aggregate/ }), { key: 'Enter' });
    expect(within(screen.getByRole('dialog', { name: 'Uitgelegd in 1 Learning Card' })).getByRole('button', { name: /^2\.3\.6/ })).toBeTruthy();
  });
});

describe('the quick window on every screen (DEC-UX-240)', () => {
  /** The titles of the commands of the screen, as the quick window lists them when nothing is typed. */
  async function screenTitles(): Promise<{ group: string | undefined; where: string | undefined; titles: string[] }> {
    await fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    const quick = await screen.findByRole('dialog', { name: 'Snelvenster' });
    const titles: string[] = [];
    for (const option of within(quick).getAllByRole('option')) {
      if (option.textContent?.includes('Opdracht')) titles.push(option.querySelector('.title')?.textContent ?? '');
    }
    const result = { group: quick.querySelector('.group')?.textContent ?? undefined, where: quick.querySelector('.where')?.textContent ?? undefined, titles };
    await closeQuick();
    return result;
  }

  it('lists the buttons and tabs of a Resource, and the parts of its Overview, and shows another tab (DEC-UX-240)', async () => {
    serve();
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: /Weekly lead volume/ }, { timeout: 3000 });
    const first = await screenTitles();
    expect(first.group).toBe('Deze Resource');
    expect(first.where).toBe('Resource · Weekly lead volume');
    expect(first.titles).toContain('Kolommen tonen');
    expect(first.titles).toContain('Beschrijving tonen');
    expect(first.titles).not.toContain('Overzicht tonen');
    await quickDo('kolommen');
    await vi.waitFor(() => expect(main.getByRole('tab', { name: 'Kolommen' }).getAttribute('aria-selected')).toBe('true'));
    // The parts of the Overview go with it; its tab comes back.
    const then = await screenTitles();
    expect(then.titles).toContain('Overzicht tonen');
    expect(then.titles).not.toContain('Beschrijving tonen');
  });

  it('adds a Lens to a Collection from the quick window, for who manages it (DEC-UX-240)', async () => {
    serve();
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'Credit leads' }, { timeout: 3000 });
    const shown = await screenTitles();
    expect(shown.group).toBe('Deze Collection');
    expect(shown.titles).toEqual(expect.arrayContaining(['Deze Collection bewerken', 'Nieuwe map', 'Een Lens toevoegen', 'Bewerk de intro']));
    await quickDo('lens toevoegen');
    await vi.waitFor(() => expect(location.pathname).toBe('/query/new/for/c1'));
  });

  it('takes the commands of a screen away when the User leaves it (DEC-UX-240)', async () => {
    serve();
    open('/resources/r2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await main.findByRole('heading', { level: 1, name: /Weekly lead volume/ }, { timeout: 3000 });
    expect((await screenTitles()).titles).toContain('Kolommen tonen');
    // My page brings its own: its other tabs, Groups.
    await quickDo('my page');
    await vi.waitFor(() => expect(location.pathname).toBe('/me'));
    await within(await screen.findByRole('main')).findByRole('tab', { name: 'Excel keys' }, { timeout: 3000 });
    const mine = await screenTitles();
    expect(mine.titles).not.toContain('Kolommen tonen');
    expect(mine.titles).toContain('Excel keys tonen');
    await quickDo('excel keys');
    await vi.waitFor(() => expect(location.pathname).toBe('/me/keys'));
  });
});
