import { createCall, Refused } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** A field of a Resource of a query, as the editor suggests it (DEC-UX-115). */
export interface QueryField {
  name: string;
  dataType: string | null;
  description: string;
  businessDescription: string;
}

/** A Resource of a query, as the User may see it now; or only its name, when they no longer may. */
export type QueryResource =
  | {
      visible: true;
      id: string;
      key: string;
      /** The full name of its table in its own case, which BigQuery is asked for (DEC-SR-44). */
      fullName?: string;
      displayName: string;
      collectionId: string | null;
      level: number;
      deprecated: boolean;
      partition: { field: string; unit: string | null } | null;
      clusterBy: string[];
      partitionFilter: 'none' | 'dataHub' | 'bigQuery';
      fields: QueryField[];
    }
  | { visible: false; id: string; displayName: string };

/** The standard list of kinds of a Parameter (DEC-UX-71). */
export type ParameterKind = 'date' | 'period' | 'number' | 'decimal' | 'text' | 'choice' | 'several' | 'yesno';

/** A Parameter of a query: a name, a kind and a value; a Period is `@name_from` and `@name_to` (DEC-UX-71). */
export type Parameter =
  | { name: string; kind: 'date' | 'number' | 'decimal' | 'text'; value: string }
  | { name: string; kind: 'period'; value: string; to: string }
  | { name: string; kind: 'choice'; value: string; list: string[] }
  | { name: string; kind: 'several'; value: string[]; list: string[] }
  | { name: string; kind: 'yesno'; value: boolean };

/** A Request to the Data Team to run a query above 1 GB (MSG-QRY-01, DEC-UX-116), or to accept a Lens (MSG-LEN-01). */
export interface QueryRequest {
  /** Its Message, which opens in the Message Centre; given on a Lens. */
  id?: string;
  state: 'waiting' | 'accepted' | 'refused';
  sentAt: string;
  reads: number;
  text: string;
  /** The decision of the Data Team, its reply (MSG-CNV-05); given on a Lens. */
  decision?: { outcome: 'accepted' | 'refused'; text: string; writerName: string; at: string } | null;
}

/** A query written in Query, the previews of a Resource by one User (FR-SR-38), or the runs of a Lens by one User (FR-LE-12). */
export type QueryKind = 'query' | 'preview' | 'lens';

/** A query in the panel of Query: one item per query (DEC-UX-74). */
export interface QueryItem {
  id: string;
  name: string;
  ownerName: string;
  kind: QueryKind;
  /** For the runs of a Lens, the Lens: it opens on its page, never with its SQL (FR-LE-14). */
  lensOf: string | null;
  resources: { id: string; displayName: string }[];
  runs: number;
  createdAt: string;
  lastRunAt: string | null;
  /** Its Request to the Data Team, if it sent one. */
  request: QueryRequest | null;
  /** Whether the User hid it from their panel (DEC-UX-138). */
  hidden?: boolean;
}

/** What the panel of Query leaves out until its chip is on (DEC-UX-137). */
export type Shown = 'previews' | 'lenses' | 'hidden';
export const SHOWN: readonly Shown[] = ['previews', 'lenses', 'hidden'];

/** How many queries a day holds in the time zone of the User, by what the panel shows them as (DEC-UX-139). */
export interface QueryDay {
  day: string;
  queries: number;
  previews: number;
  lenses: number;
  hidden: number;
}

/** Which queries the panel asks for: a period, what it adds, words that search them all. */
export interface ListOptions {
  from?: string;
  to?: string;
  show?: readonly Shown[];
  q?: string;
  limit?: number;
}

export interface ResultColumn {
  name: string;
  type: string;
}

/** A run of a query, a line of the Query Log (DEC-LN-01). */
export interface Run {
  /** Its Query ID, such as q-20261029-4c2e1a (FR-LN-06). */
  ref: string;
  number: number;
  /** The SQL and values it ran with: a variation of its query (DEC-UX-74). */
  sql: string;
  parameters: Parameter[];
  state: 'running' | 'done' | 'failed';
  error: string | null;
  userName: string;
  estimatedBytes: number;
  approved: boolean;
  processedBytes: number | null;
  billedBytes: number | null;
  partitions: number | null;
  rowCount: number | null;
  columns: ResultColumn[] | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface Query {
  id: string;
  kind: QueryKind;
  name: string;
  question: string;
  sql: string;
  parameters: Parameter[];
  ownerName: string;
  /** Whether the User made it: only they write and run it. */
  mine: boolean;
  /** Whether the User hid it from their panel (DEC-UX-138). */
  hidden?: boolean;
  createdAt: string;
  lastRunAt: string | null;
  resources: QueryResource[];
  lastRun: Run | null;
  /** How many runs it has. */
  runs: number;
  /** Its Request to the Data Team, if its author sent one. */
  request: QueryRequest | null;
  /** The query it was started from with another set of Resources, and after which of its runs (DEC-UX-73). */
  startedFrom: { id: string; name: string; afterRun: number | null } | null;
  /** The Lens it is used as: made from it, or opened as it in Query (DEC-LE-03, DEC-LE-18). */
  lens: { id: string; name: string; collectionId: string; state: LensState; createdAt: string; version: number; range: 'free' | 'approve' | 'request'; reads: number } | null;
  /** The Collection whose "New Lens" started it, offered first when it becomes a Lens (DEC-UX-123). */
  forCollection: string | null;
}

/**
 * A Lens is published; or waits for the Data Team while one run reads more than 1 GB (FR-LE-09), and stays
 * unpublished once they refused it (DEC-UX-128); or stopped, after a run with its defaults grew past 1 GB,
 * until the Data Team accepts it again (DEC-LE-11).
 */
export type LensState = 'published' | 'waiting' | 'stopped' | 'refused';

/** What a Broken Lens misses: a table or a column, and since when (FR-LE-17). */
export interface Missing {
  kind: 'table' | 'column';
  name: string;
  since: string;
}

/** A Parameter of a Lens: one of its query, with the name Users see and its default (DEC-LE-01). */
export type LensParameter = Parameter & { label: string };

/** A Lens as a list shows it: the panel of Collections and the page of a Collection (FR-CO-28, FR-CO-36). */
export interface LensItem {
  id: string;
  name: string;
  question: string;
  shows: string;
  tags: string[];
  collectionId: string;
  /** The lowest Level of what it is built on (DEC-DH-10). */
  level: number;
  state: LensState;
  resources: { id: string; displayName: string }[];
  authorName: string;
  mine: boolean;
  createdAt: string;
  publishedAt: string | null;
  /** What it misses while it is Broken, for the red dot wherever it is listed (DEC-UX-81). */
  broken: Missing | null;
  /** When the User last ran it, for the start screen of Collections (FR-CO-37). */
  lastRunAt?: string | null;
}

/** A piece of a text, and whether it is a word the question shares (DEC-UX-23). */
export interface Marked {
  text: string;
  shared: boolean;
}

/** A Lens a new query may reuse, with the words it shares with its question (FR-SR-47, FR-SR-48, DEC-SR-42). */
export interface LensSuggestion extends LensItem {
  shared: number;
  marked: { name: Marked[]; question: Marked[]; shows: Marked[] } | null;
  sharedTags: string[];
}

/** The Lenses on exactly the Resources of a query, and those on them and more (DEC-UX-22). */
export interface LensSuggestions {
  exact: LensSuggestion[];
  more: LensSuggestion[];
}

/** A line of the Log of a Lens: it became Broken, or worked again (FR-SR-52). */
export interface LensLogEntry {
  logId: 'BRK-001' | 'BRK-002' | 'LEN-001' | 'LEN-002';
  params: Record<string, string>;
  at: string;
}

/** A Lens as its page shows it: everything but its SQL (FR-LE-14). */
export interface Lens extends Omit<LensItem, 'resources'> {
  steps: string[];
  parameters: LensParameter[];
  resources: { id: string; displayName: string; collectionId: string | null; level: number }[];
  /** Whether the User may change it: its Owner Unit and the Data Team (DEC-CO-15, DEC-CO-18). */
  canManage: boolean;
  version: number;
  range: 'free' | 'approve' | 'request';
  reads: number;
  fromQuery: { id: string; name: string } | null;
  /** Its Request to the Data Team, while it waits or once it was refused (FR-LE-09, DEC-UX-128). */
  request: QueryRequest | null;
  /** Since when it stopped, and what one run with its defaults read then (DEC-LE-11). */
  stoppedAt: string | null;
  stoppedReads: number | null;
  /** Every version, newest first, with who made it from which query (FR-LE-16, DEC-LE-18). */
  versions: { version: number; madeByName: string; madeAt: string; fromQuery: string }[];
  log: LensLogEntry[];
}

/** What its Owner Unit changes about a Lens: what it tells, never its SQL (FR-LE-06, DEC-UX-27). */
export type LensEdit = Partial<Pick<NewLens, 'name' | 'question' | 'shows' | 'steps' | 'tags' | 'labels'>>;

/** What its author tells about a new Lens (FR-LE-06, DEC-LE-16). */
export interface NewLens {
  queryId: string;
  collectionId: string;
  name: string;
  question: string;
  shows: string;
  steps: string[];
  tags: string[];
  labels: Record<string, string>;
  approve?: boolean;
  text?: string;
}

/** The value a User chose for a Parameter of a Lens; a Period has its end too. */
export type LensValue = string | string[] | boolean | { value: string; to: string };

/** A page of a result: 100 rows of the same run (FR-SR-51). */
export interface Page {
  number: number;
  size: number;
  totalRows: number;
  columns: ResultColumn[];
  rows: (string | null)[][];
}

export type Problem =
  | { kind: 'empty' }
  | { kind: 'notVisible'; resource: { id: string; displayName: string } }
  | { kind: 'outside'; name: string; start: number | null; end: number | null }
  /** An @name that is not a Parameter, with the kind suggested from the column it is compared with. */
  | { kind: 'undefinedParameter'; name: string; start: number; end: number; suggestedKind: ParameterKind | null }
  | { kind: 'notSelect'; statementType: string }
  /** With the SQL that adds the filter, where Data Hub can tell where it goes (DEC-SR-35). */
  | { kind: 'filterRequired'; resource: { id: string; displayName: string }; column: string; fix: string | null }
  | { kind: 'invalid'; message: string };

export interface Warning {
  kind: 'noPartitionFilter';
  resource: { id: string; displayName: string };
  column: string;
  fix: string | null;
  /** What it reads with that filter (FR-SR-40). */
  bytesWithFilter: number | null;
}

/** The Pre-flight of a query (FR-SR-36, TR-SR-16). */
export interface Preflight {
  runnable: boolean;
  bytes: number | null;
  range: 'free' | 'approve' | 'request' | null;
  partitions: number | null;
  problems: Problem[];
  warnings: Warning[];
  thresholds: { approve: number; request: number };
  /** The Parameters that are not in the SQL: they are not sent. */
  unused: string[];
}

/** What a run came to: its result, or why it did not run. */
export type RunOutcome =
  | { kind: 'ran'; run: Run; page: Page }
  /** The Pre-flight changed: it cannot run, or needs approval, or goes to the Data Team. */
  | { kind: 'refused'; preflight: Preflight }
  /** BigQuery refused it, in its own words; the run is kept as failed. */
  | { kind: 'failed'; message: string; run: Run | null };

/** The size and partitions of a Resource, from BigQuery; for a view, of the table beneath it (FR-SR-39). */
export interface Storage {
  key: string;
  bytes: number | null;
  rows: number | null;
  partitions: number | null;
  modifiedAt: string | null;
  /** Whether they are of the table beneath a view. */
  beneath: boolean;
}

/** The window of a Preview: its newest 1, 4 or 12 partitions that hold rows (DEC-SR-39). */
export type PreviewWindow = 1 | 4 | 12;

/** What a Preview offers to choose by (FR-SR-38, DEC-SR-37). */
export interface PreviewChoices {
  window: { field: string; unit: string | null; from: string | null; window: PreviewWindow } | null;
  choices: { field: string; dataType: string; role: 'cluster' | 'parameter'; kind: ParameterKind; values: string[] | null }[];
}

/** The values chosen in a Preview, by column; null for all. */
export type PreviewValues = Record<string, string | null>;

/** A query on a Resource, as its tab History lists it (FR-SR-44). */
export interface QueryOnResource {
  /** The query; for a Lens, the Lens. */
  id: string;
  name: string;
  kind: QueryKind;
  ownerName: string;
  mine: boolean;
  runs: number;
  lastRunAt: string | null;
  lastRead: number | null;
  lastEstimate: number;
  lastState: 'running' | 'done' | 'failed';
}

/** What a new query is made of: its own Resources, or the SQL and Parameters of the query it is started from. */
export interface NewQuery {
  name: string;
  question: string;
  resources: readonly string[];
  sql?: string;
  parameters?: readonly Parameter[];
  startedFrom?: string;
  /** Started from "New Lens" on this Collection (DEC-UX-123). */
  forCollection?: string;
}

/** A run of a Lens that did not run because the Lens stopped or is Broken: its page reads it again. */
export interface LensHalted {
  kind: 'halted';
  reason: 'stopped' | 'broken';
}

/** query's routes (TR-SR-15 to TR-SR-17), with the Access Token of the User. */
export function createQuery(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('query', config.queryUrl, session, request);
  const query = (id: string) => `/queries/${encodeURIComponent(id)}`;
  const resource = (id: string) => `/resources/${encodeURIComponent(id)}`;

  /** What a run came to: its result, the Pre-flight when that changed, or the refusal of BigQuery. */
  async function outcomeOf(sent: Promise<Response>): Promise<RunOutcome> {
    try {
      const body = (await (await sent).json()) as { run: Run; page: Page };
      return { kind: 'ran', ...body };
    } catch (error) {
      if (error instanceof Refused && error.status === 409 && error.body?.preflight) {
        return { kind: 'refused', preflight: error.body.preflight as Preflight };
      }
      if (error instanceof Refused && error.status === 422) {
        return { kind: 'failed', message: error.detail ?? '', run: (error.body?.run as Run | undefined) ?? null };
      }
      throw error;
    }
  }

  /** A Lens that stopped or broke when it was checked: its page reads it again (DEC-UX-81, DEC-UX-125). */
  function haltedBy(error: unknown): LensHalted {
    if (error instanceof Refused && error.status === 409 && (error.code === 'stopped' || error.code === 'broken')) return { kind: 'halted', reason: error.code };
    throw error;
  }

  return {
    /** The queries of the User, or everyone's for the Data Team; of a period, with what the panel adds, matching words. */
    async list(all = false, options: ListOptions = {}): Promise<QueryItem[]> {
      const params = new URLSearchParams();
      if (all) params.set('all', 'true');
      if (options.from) params.set('from', options.from);
      if (options.to) params.set('to', options.to);
      if (options.show) params.set('show', options.show.join(','));
      if (options.q) params.set('q', options.q);
      if (options.limit) params.set('limit', String(options.limit));
      const search = params.toString();
      return ((await (await call(search ? `/queries?${search}` : '/queries')).json()) as { queries: QueryItem[] }).queries;
    },
    /** How many queries each day holds, in the time zone of this browser (DEC-UX-139). */
    async days(all = false): Promise<QueryDay[]> {
      const params = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(all ? { all: 'true' } : {}) });
      return ((await (await call(`/queries/days?${params}`)).json()) as { days: QueryDay[] }).days;
    },
    /** Hides a query from the panel of the User, or shows it again (DEC-UX-138). */
    async hide(id: string, hidden: boolean): Promise<void> {
      await call(`${query(id)}/hidden`, { method: hidden ? 'PUT' : 'DELETE' });
    },
    async create(fields: NewQuery): Promise<Query> {
      return ((await (await call('/queries', { method: 'POST', body: fields })).json()) as { query: Query }).query;
    },
    async get(id: string): Promise<Query> {
      return ((await (await call(query(id))).json()) as { query: Query }).query;
    },
    /** Changes its name or question, for who made it (DEC-UX-119). */
    async rename(id: string, fields: { name: string; question: string }): Promise<void> {
      await call(query(id), { method: 'PATCH', body: fields });
    },
    /** The size and partitions of a Resource; null where BigQuery does not tell them. */
    async storage(resourceId: string): Promise<Storage | null> {
      return ((await (await call(`${resource(resourceId)}/storage`)).json()) as { storage: Storage | null }).storage;
    },
    /** The choices of a Preview for its window, their values read once (DEC-SR-37). */
    async previewChoices(resourceId: string, window: PreviewWindow): Promise<PreviewChoices> {
      return (await (await call(`${resource(resourceId)}/preview/choices`, { method: 'POST', body: { window } })).json()) as PreviewChoices;
    },
    /** The Pre-flight of a Preview, and the Request of the User on their previews. */
    async previewPreflight(resourceId: string, window: PreviewWindow, values: PreviewValues): Promise<{ preflight: Preflight; request: QueryRequest | null }> {
      return (await (await call(`${resource(resourceId)}/preview/preflight`, { method: 'POST', body: { window, values } })).json()) as { preflight: Preflight; request: QueryRequest | null };
    },
    async previewRun(resourceId: string, window: PreviewWindow, values: PreviewValues, approve: boolean): Promise<RunOutcome> {
      return outcomeOf(call(`${resource(resourceId)}/preview/runs`, { method: 'POST', body: { window, values, approve } }));
    },
    async previewRequest(resourceId: string, window: PreviewWindow, values: PreviewValues, text: string): Promise<QueryRequest> {
      return ((await (await call(`${resource(resourceId)}/preview/requests`, { method: 'POST', body: { window, values, text } })).json()) as { request: QueryRequest }).request;
    },
    /** The queries on a Resource, for its Owner Unit and the Data Team (FR-SR-44, DEC-SR-41). */
    async onResource(resourceId: string): Promise<{ summary: { queries: number; lenses: number; colleagues: number }; queries: QueryOnResource[] }> {
      return (await (await call(`${resource(resourceId)}/queries`)).json()) as { summary: { queries: number; lenses: number; colleagues: number }; queries: QueryOnResource[] };
    },
    /** The Pre-flight of what is written; query keeps the SQL and Parameters with it. */
    async preflight(id: string, sql: string, parameters: readonly Parameter[]): Promise<Preflight> {
      return ((await (await call(`${query(id)}/preflight`, { method: 'POST', body: { sql, parameters } })).json()) as { preflight: Preflight }).preflight;
    },
    /** Its history, newest first: the runs before a number, or the last ones (DEC-UX-74). */
    async runs(id: string, options: { before?: number; limit?: number } = {}): Promise<Run[]> {
      const search = new URLSearchParams({ limit: String(options.limit ?? 20), ...(options.before ? { before: String(options.before) } : {}) });
      return ((await (await call(`${query(id)}/runs?${search}`)).json()) as { runs: Run[] }).runs;
    },
    /** Sends it to the Data Team, above 1 GB (DEC-UX-116); or the Pre-flight, when that changed. */
    async request(id: string, sql: string, parameters: readonly Parameter[], text: string): Promise<{ kind: 'sent'; request: QueryRequest } | { kind: 'refused'; preflight: Preflight }> {
      try {
        const body = (await (await call(`${query(id)}/requests`, { method: 'POST', body: { sql, parameters, text } })).json()) as { request: QueryRequest };
        return { kind: 'sent', request: body.request };
      } catch (error) {
        if (error instanceof Refused && error.status === 409 && error.body?.preflight) return { kind: 'refused', preflight: error.body.preflight as Preflight };
        throw error;
      }
    },
    async run(id: string, sql: string, parameters: readonly Parameter[], approve: boolean): Promise<RunOutcome> {
      return outcomeOf(call(`${query(id)}/runs`, { method: 'POST', body: { sql, parameters, approve } }));
    },
    /** The Lenses the User sees (DEC-LE-09, DEC-CO-16). */
    async lenses(): Promise<LensItem[]> {
      return ((await (await call('/lenses')).json()) as { lenses: LensItem[] }).lenses;
    },
    /** The Lenses a new query may reuse, by its Resources and the words of its question (FR-SR-47, FR-SR-48). */
    async suggestions(resources: readonly string[], question: string): Promise<LensSuggestions> {
      const search = new URLSearchParams({ resources: resources.join(','), question });
      return (await (await call(`/lenses/suggestions?${search}`)).json()) as LensSuggestions;
    },
    /** The Lenses the User sees that share words with a question, for the search of the start screen (DEC-UX-127). */
    async searchLenses(question: string): Promise<LensSuggestion[]> {
      return ((await (await call(`/lenses/search?${new URLSearchParams({ question })}`)).json()) as { lenses: LensSuggestion[] }).lenses;
    },
    async lens(id: string): Promise<Lens> {
      return ((await (await call(`/lenses/${encodeURIComponent(id)}`)).json()) as { lens: Lens }).lens;
    },
    /**
     * Makes a Lens of a query (FR-LE-07): made, published or waiting for the Data Team; or the size check,
     * when one run reads more than 100 MB and its author did not say to publish it anyway (FR-LE-08).
     */
    async makeLens(fields: NewLens): Promise<{ kind: 'made'; lens: Lens } | { kind: 'refused'; preflight: Preflight }> {
      try {
        return { kind: 'made', lens: ((await (await call('/lenses', { method: 'POST', body: fields })).json()) as { lens: Lens }).lens };
      } catch (error) {
        if (error instanceof Refused && error.status === 409 && error.body?.preflight) return { kind: 'refused', preflight: error.body.preflight as Preflight };
        throw error;
      }
    },
    /** The Pre-flight of a run of a Lens with the values the User chose (DEC-UX-28); or that it stopped or broke just now. */
    async lensPreflight(id: string, values: Record<string, LensValue>): Promise<Preflight | LensHalted> {
      try {
        return ((await (await call(`/lenses/${encodeURIComponent(id)}/preflight`, { method: 'POST', body: { values } })).json()) as { preflight: Preflight }).preflight;
      } catch (error) {
        return haltedBy(error);
      }
    },
    async lensRun(id: string, values: Record<string, LensValue>, approve: boolean): Promise<RunOutcome | LensHalted> {
      try {
        return await outcomeOf(call(`/lenses/${encodeURIComponent(id)}/runs`, { method: 'POST', body: { values, approve } }));
      } catch (error) {
        return haltedBy(error);
      }
    },
    /** Changes what a Lens tells, for its Owner Unit (FR-LE-06). */
    async editLens(id: string, changes: LensEdit): Promise<Lens> {
      return ((await (await call(`/lenses/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes })).json()) as { lens: Lens }).lens;
    },
    /** "Open in Query": its query for its author, a query of their own, used as it, for anyone else of its Owner Unit (DEC-LE-18). */
    async openLens(id: string): Promise<string> {
      return ((await (await call(`/lenses/${encodeURIComponent(id)}/query`, { method: 'POST' })).json()) as { queryId: string }).queryId;
    },
    /**
     * "Update the Lens" from a query used as it (FR-LE-16): its next version, published or waiting for the
     * Data Team; or the size check, when one run reads more than 100 MB and the User did not say to go on.
     */
    /** The decision of the Data Team on the Request on a Lens: accepted, or refused with a reason (FR-LE-09). */
    async decideLens(id: string, outcome: 'accepted' | 'refused', text: string): Promise<Lens> {
      return ((await (await call(`/lenses/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { outcome, text } })).json()) as { lens: Lens }).lens;
    },
    async updateLens(id: string, queryId: string, approve: boolean, text: string): Promise<{ kind: 'updated'; lens: Lens } | { kind: 'refused'; preflight: Preflight }> {
      try {
        return { kind: 'updated', lens: ((await (await call(`/lenses/${encodeURIComponent(id)}/version`, { method: 'PUT', body: { queryId, approve, text } })).json()) as { lens: Lens }).lens };
      } catch (error) {
        if (error instanceof Refused && error.status === 409 && error.body?.preflight) return { kind: 'refused', preflight: error.body.preflight as Preflight };
        throw error;
      }
    },
    /** Sends a waiting Lens to the Data Team again, when it could not be sent (FR-LE-09). */
    async lensRequest(id: string, text: string): Promise<QueryRequest> {
      return ((await (await call(`/lenses/${encodeURIComponent(id)}/requests`, { method: 'POST', body: { text } })).json()) as { request: QueryRequest }).request;
    },
    /** A page of a run, from the same job; null once BigQuery no longer keeps it (DEC-UX-99). */
    async rows(ref: string, page: number): Promise<Page | null> {
      try {
        return ((await (await call(`/runs/${encodeURIComponent(ref)}/rows?page=${page}`)).json()) as { page: Page }).page;
      } catch (error) {
        if (error instanceof Refused && error.status === 410) return null;
        throw error;
      }
    },
  };
}

export type QueryClient = ReturnType<typeof createQuery>;
