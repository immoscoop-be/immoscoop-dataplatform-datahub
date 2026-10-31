<script lang="ts">
  import DataGrid from '@datahub/ui/components/DataGrid.svelte';
  import Pager from '@datahub/ui/components/Pager.svelte';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import SqlEditor, { CTE_LINE, type ErrorMark, type ParameterSuggestion, type Suggestion, type TableSuggestion } from '@datahub/ui/components/SqlEditor.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t, tParts } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import Gauge from '@datahub/ui/primitives/Gauge.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { NotFound as Missing } from '../lib/api.js';
  import { missingOfQuery } from '../lib/broken.js';
  import type { Collection } from '../lib/catalogue.js';
  import { clock, when as whenIn } from '../lib/moment.js';
  import { dayOf, describe, formatDay, isFunction, kindOf, lineOf, namesOf } from '../lib/parameters.js';
  import type { Lens, LensSuggestions as Found, Missing as Lost, NewQuery, Page, Parameter, Preflight, Problem, Query, QueryClient, Run, Warning } from '../lib/query.js';
  import { lensPath, NEW_QUERY, newLensPath, queryPath, resourcePath } from '../lib/routes.js';
  import NewSetSheet from './NewSetSheet.svelte';
  import NotFound from './NotFound.svelte';
  import ParameterWindow from './ParameterWindow.svelte';
  import QueryHistory from './QueryHistory.svelte';
  import QueryParameters, { type Missing as MissingParameter } from './QueryParameters.svelte';
  import LensSuggestions from './LensSuggestions.svelte';
  import UpdateLensSheet from './UpdateLensSheet.svelte';

  /**
   * A query (query, DEC-UX-70 to DEC-UX-74): its name and question, and where it started from; on top of
   * its frame "Reads only" and its Resources, another set of which starts a new query in a sheet; the SQL in
   * an editor that takes the height that is left, with its Parameters to its right, or under it next to the result
   * (DEC-UX-147), each box folding; at the foot of the frame,
   * staying in view, the Pre-flight and Run, or above 1 GB a Request to the Data Team (DEC-UX-116); under
   * it the result, a grid of 100 rows a page with its Query ID (FR-SR-51, FR-LN-06), and its history, every
   * run a variation, to preview and apply. The Pre-flight follows the SQL and the Parameters while typing
   * pauses (FR-SR-36). Only who made a query writes and runs it, and changes its name and question in place
   * (DEC-UX-119); the Data Team reads everyone's (DEC-LN-01). A query used as a Lens says so, and "Update
   * the Lens" takes the place of "Make it a lens", in a sheet (DEC-UX-77, FR-LE-16).
   */
  let {
    id,
    opened = null,
    client,
    collections,
    nonce,
    onran,
    onmade,
    onlens,
    hiddenChange,
    onhidden,
    layout = 'horizontal',
    onlayout,
  }: {
    id: string;
    /** Its history opened from the panel, at one of its runs or at all of them. */
    opened?: number | 'all' | null;
    client: QueryClient;
    collections: readonly Collection[] | undefined;
    /** The nonce of the page, for the styles of the editor. */
    nonce: string | undefined;
    /** A run ended, or a Request was sent: the panel shows it. */
    onran: () => void;
    /** A new query was started from this one, with another set of Resources. */
    onmade: (made: Query) => void;
    /** The Lens it is used as was updated from it. */
    onlens: (lens: Lens) => void;
    /** The last query hidden or shown again, here or in the panel (DEC-UX-138). */
    hiddenChange?: { id: string; hidden: boolean };
    /** It was hidden or shown again here. */
    onhidden?: (id: string, hidden: boolean) => void;
    /** The query above the result, or next to it, as the User chose it (DEC-UX-143). */
    layout?: Layout;
    onlayout?: (layout: Layout) => void;
  } = $props();

  /** How much room the query takes, in percent, at first and at least and at most, per layout (DEC-UX-144). */
  const SPLIT = { horizontal: 55, sideBySide: 45 } as const;
  const clamp = (value: number) => Math.min(80, Math.max(20, value));
  const splitKey = (of: Layout) => `datahub.query.split.${of}`;
  /** Where the User dragged the divider, kept in this browser per layout. */
  function storedSplit(of: Layout): number {
    try {
      const stored = Number(localStorage.getItem(splitKey(of)));
      return stored >= 20 && stored <= 80 ? stored : SPLIT[of];
    } catch {
      return SPLIT[of];
    }
  }
  let work = $state<HTMLElement | undefined>();
  let split = $state<number>(SPLIT.horizontal);
  let dragging = $state(false);
  $effect(() => {
    split = storedSplit(layout);
  });
  function keepSplit(): void {
    try {
      localStorage.setItem(splitKey(layout), String(Math.round(split)));
    } catch {
      // Without storage, the divider keeps its place for this visit only.
    }
  }
  /** Dragging the divider gives the query or the result more room (DEC-UX-144). */
  function drag(event: PointerEvent): void {
    const divider = event.currentTarget as HTMLElement;
    divider.setPointerCapture?.(event.pointerId);
    dragging = true;
    const move = (moved: PointerEvent) => {
      const box = work?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      split = clamp(layout === 'sideBySide' ? ((moved.clientX - box.left) / box.width) * 100 : ((moved.clientY - box.top) / box.height) * 100);
    };
    const up = () => {
      dragging = false;
      divider.removeEventListener('pointermove', move);
      divider.removeEventListener('pointerup', up);
      keepSplit();
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('pointerup', up);
  }
  function nudge(event: KeyboardEvent): void {
    const step = { ArrowUp: -5, ArrowLeft: -5, ArrowDown: 5, ArrowRight: 5 }[event.key];
    if (!step) return;
    event.preventDefault();
    split = clamp(split + step);
    keepSplit();
  }

  /** The query above the result, or next to it (DEC-UX-143). */
  type Layout = 'horizontal' | 'sideBySide';

  /**
   * How long typing pauses before the Pre-flight is asked again; anything else is checked at once: a
   * query opened, a change of its Parameters, a filter added, a run taken over (DEC-UX-154).
   */
  const PAUSE = 2000;

  let query = $state<Query | null | undefined>();
  /** Whether the User hid it from their panel: as it was read, or as changed since (DEC-UX-138). */
  const hidden = $derived(hiddenChange?.id === id ? hiddenChange.hidden : (query?.hidden ?? false));
  let hiding = $state(false);

  async function toggleHidden() {
    hiding = true;
    try {
      await client.hide(id, !hidden);
      onhidden?.(id, !hidden);
    } catch (error) {
      console.error('The query could not be hidden', error);
    } finally {
      hiding = false;
    }
  }
  let sql = $state('');
  let parameters = $state<Parameter[]>([]);
  let preflight = $state<Preflight | null>(null);
  /** What it misses while it is Broken: Run is off and a callout names it, until a change runs or it comes back (FR-SR-53). */
  let broken = $state<Lost | null>(null);
  /** The SQL and Parameters the Pre-flight is of: its marks hold only while they are the same. */
  let checked = $state('');
  let checking = $state(false);
  let run = $state<Run | null>(null);
  let page = $state<Page | null>(null);
  let expired = $state(false);
  let failure = $state<string | null>(null);
  let running = $state(false);
  let paging = $state(false);
  let boxOpen = $state(true);
  let parametersOpen = $state(true);
  // Next to the result, the Parameters start folded to their line of chips, so the editor keeps the room (DEC-UX-147).
  $effect.pre(() => {
    parametersOpen = layout !== 'sideBySide';
  });
  let editor = $state<SqlEditor | undefined>();
  let tab = $state<'result' | 'history'>('result');
  let history = $state<Run[] | undefined>();
  let loadingHistory = $state(false);
  /** A run of its history, shown read only, with its result while BigQuery keeps it (OP-UX-27, DEC-UX-99). */
  let preview = $state<{ run: Run; page: Page | null; expired: boolean } | null>(null);
  let parameterWindow = $state<{ key: number; parameter: Parameter | null; defines: MissingParameter | null } | null>(null);
  let windows = 0;
  let newSet = $state<{ mode: 'add' | 'remove'; resource: string | null } | null>(null);
  let requestOpen = $state(false);
  let requestText = $state('');
  let sending = $state(false);
  let requestFailed = $state(false);
  /** Its name and question while they are changed in place (DEC-UX-119). */
  let renaming = $state<{ name: string; question: string } | null>(null);
  let renameSaving = $state(false);
  let renameFailed = $state(false);
  let updating = $state(false);
  /** The Lenses on its Resources, to reuse while writing (DEC-UX-73); not for a query used as a Lens (DEC-UX-77). */
  let lensesOn = $state<Found | undefined>();
  let lensesOpen = $state(false);
  let loadedId: string | undefined;

  $effect(() => {
    if (id === loadedId) return;
    loadedId = id;
    query = undefined;
    preflight = null;
    broken = null;
    page = null;
    run = null;
    expired = false;
    failure = null;
    history = undefined;
    preview = null;
    parameterWindow = null;
    newSet = null;
    requestOpen = false;
    requestText = '';
    renaming = null;
    updating = false;
    lensesOn = undefined;
    lensesOpen = false;
    tab = 'result';
    client.get(id).then(
      async (found) => {
        if (loadedId !== id) return;
        query = found;
        broken = found.broken ?? null;
        atOnce = true;
        sql = found.sql;
        parameters = found.parameters;
        run = found.lastRun;
        failure = found.lastRun?.state === 'failed' ? found.lastRun.error : null;
        loadHistory();
        if (found.mine && found.lastRun?.state === 'done') {
          const rows = await rowsOf(found.lastRun, 1);
          if (rows !== undefined && loadedId === id) [page, expired] = [rows, rows === null];
        }
      },
      (error: unknown) => {
        if (error instanceof Missing) query = null;
        else console.error(`The query ${id} could not be read`, error);
      },
    );
  });

  // The Lenses on its Resources, by the words of its question, for "Lenses on these Resources" (FR-SR-47).
  const lensKey = $derived(query && query.kind === 'query' && !query.lens ? `${query.id}\u0000${visibleIds().join(',')}\u0000${query.question}` : null);
  function visibleIds(): string[] {
    return query?.resources.flatMap((resource) => (resource.visible ? [resource.id] : [])) ?? [];
  }
  $effect(() => {
    const key = lensKey;
    const on = visibleIds();
    if (key === null || on.length === 0 || !query) return;
    const words = query.question;
    client.suggestions(on, words).then(
      (found) => lensKey === key && (lensesOn = found),
      (error: unknown) => console.error('The Lenses on these Resources could not be read', error),
    );
  });

  // A run chosen in the panel opens in its history.
  $effect(() => {
    if (opened !== null) tab = 'history';
  });

  function loadHistory(before?: number): void {
    loadingHistory = true;
    const asked = id;
    client
      .runs(asked, { before, limit: 20 })
      .then(
        (found) => {
          if (loadedId === asked) history = before ? [...(history ?? []), ...found] : found;
        },
        (error: unknown) => console.error('The history could not be read', error),
      )
      .finally(() => (loadingHistory = false));
  }

  /** The SQL and Parameters as one, to tell whether the Pre-flight is of what is written now. */
  const keyOf = (text: string, values: readonly Parameter[]) => `${text}\u0000${JSON.stringify(values)}`;
  const key = $derived(keyOf(sql, parameters));

  // The Pre-flight follows the SQL and the Parameters, once typing pauses two seconds; anything else
  // is checked at once (DEC-UX-154). query keeps both.
  let sequence = 0;
  /** The SQL of the last Pre-flight asked: a different text was typed. */
  let askedText: string | null = null;
  /** The next change is no typing: a query opened, a filter added, a run taken over. */
  let atOnce = true;
  /** The Pre-flight waiting for typing to pause, to ask it at once instead. */
  let pending: { timer: ReturnType<typeof setTimeout>; ask: () => void } | null = null;
  /** Cmd+Enter came before the Pre-flight: it runs as soon as that comes back. */
  let runWhenChecked = false;
  $effect(() => {
    const text = sql;
    const values = JSON.parse(JSON.stringify(parameters)) as Parameter[];
    if (!query?.mine) return;
    const typed = !atOnce && askedText !== null && text !== askedText;
    atOnce = false;
    askedText = text;
    runWhenChecked = false;
    const asked = ++sequence;
    checking = true;
    const ask = () => {
      pending = null;
      client.check(id, text, values).then(
        (result) => {
          if (asked !== sequence) return;
          preflight = result.preflight;
          checked = keyOf(text, values);
          checking = false;
          brokenNow(result.broken);
          if (runWhenChecked) {
            runWhenChecked = false;
            runFromKeys();
          }
        },
        (error: unknown) => {
          if (asked === sequence) checking = false;
          console.error('The Pre-flight could not be read', error);
        },
      );
    };
    const timer = setTimeout(ask, typed ? PAUSE : 0);
    pending = { timer, ask };
    return () => {
      clearTimeout(timer);
      if (pending?.timer === timer) pending = null;
    };
  });

  /** A page of a run; null once BigQuery no longer keeps it, undefined when it could not be read. */
  async function rowsOf(of: Run, number: number): Promise<Page | null | undefined> {
    paging = true;
    const found = await client.rows(of.ref, number).catch((error: unknown) => {
      console.error('The rows could not be read', error);
      return undefined;
    });
    paging = false;
    return found;
  }

  async function turn(number: number): Promise<void> {
    if (preview) {
      const shown = preview.run;
      const found = await rowsOf(shown, number);
      if (found !== undefined && preview?.run.ref === shown.ref) preview = { run: shown, page: found, expired: found === null };
    } else if (run) {
      const found = await rowsOf(run, number);
      if (found !== undefined) [page, expired] = [found, found === null];
    }
  }

  async function runWith(text: string, values: readonly Parameter[], approve: boolean): Promise<void> {
    running = true;
    tab = 'result';
    preview = null;
    const outcome = await client.run(id, text, values, approve).catch((error: unknown) => {
      console.error('The query could not run', error);
      return null;
    });
    running = false;
    if (!outcome) {
      failure = t('query.runFailed');
      return;
    }
    if (outcome.kind === 'refused') {
      preflight = outcome.preflight;
      checked = keyOf(text, values);
      if (outcome.broken !== undefined) brokenNow(outcome.broken);
      return;
    }
    if (outcome.kind === 'ran') {
      [run, page, expired, failure] = [outcome.run, outcome.page, false, null];
      brokenNow(null);
    } else {
      [run, page, failure] = [outcome.run, null, outcome.message];
      if (outcome.broken !== undefined) brokenNow(outcome.broken);
    }
    if (outcome.run) {
      history = [outcome.run, ...(history ?? [])];
      if (query) query.runs += 1;
    }
    onran();
  }

  /** Whether it is Broken now, as query said: the panel shows its red dot, or no longer (FR-SR-53). */
  function brokenNow(now: Lost | null): void {
    const changed = (broken === null) !== (now === null);
    broken = now;
    if (query) query.broken = now;
    if (changed) onran();
  }

  const start = () => runWith(sql, parameters, current?.range !== 'free');
  let runBar = $state<HTMLElement | undefined>();

  /**
   * Cmd+Enter, or Ctrl+Enter, in the editor does what the button that runs it does (DEC-UX-142): it runs
   * what reads up to 100 MB; for more, it puts the focus on the button, which asks for the approval.
   * What the Pre-flight blocks, or what goes to the Data Team, does not run.
   */
  function runFromKeys(): void {
    if (!query?.mine || running) return;
    // Typed just now: it is checked at once, and runs when the Pre-flight says it may (DEC-UX-154).
    if (pending) {
      clearTimeout(pending.timer);
      runWhenChecked = true;
      pending.ask();
      return;
    }
    if (checking) {
      runWhenChecked = true;
      return;
    }
    if (!current?.runnable) return;
    if (current.range === 'free') {
      start();
      return;
    }
    if (current.range === 'approve' || query.request?.state === 'accepted') runBar?.querySelector<HTMLButtonElement>('button.run')?.focus();
  }

  /** Shows a run of its history read only: its SQL and values, and its result while it is kept. */
  async function openPreview(of: Run): Promise<void> {
    tab = 'result';
    preview = { run: of, page: null, expired: false };
    if (of.state !== 'done' || !query?.mine) return;
    const found = await rowsOf(of, 1);
    // Unless another run is previewed by now.
    if (found !== undefined && preview?.run.ref === of.ref) preview = { run: of, page: found, expired: found === null };
  }

  /** Takes the SQL and values of a run into the query: its next run is a new variation (DEC-UX-74). */
  function apply(of: Run): void {
    atOnce = true;
    sql = of.sql;
    parameters = JSON.parse(JSON.stringify(of.parameters)) as Parameter[];
    preview = null;
    tab = 'result';
  }

  /** Runs a run of the history again, whose result is no longer kept: a new run of the query. */
  function runAgain(of: Run): void {
    apply(of);
    void runWith(of.sql, of.parameters, false);
  }

  async function send(): Promise<void> {
    sending = true;
    requestFailed = false;
    const outcome = await client.request(id, sql, parameters, requestText).catch((error: unknown) => {
      console.error('The Request could not be sent', error);
      return null;
    });
    sending = false;
    if (!outcome) {
      requestFailed = true;
      return;
    }
    if (outcome.kind === 'refused') {
      preflight = outcome.preflight;
      checked = key;
      return;
    }
    if (query) query.request = outcome.request;
    requestOpen = false;
    onran();
  }

  async function startNew(fields: NewQuery): Promise<boolean> {
    try {
      const made = await client.create(fields);
      newSet = null;
      onmade(made);
      return true;
    } catch (error) {
      console.error('The new query could not be made', error);
      return false;
    }
  }

  function saveParameter(next: Parameter, before: string | null): void {
    parameters = before === null ? [...parameters, next] : parameters.map((parameter) => (parameter.name === before ? next : parameter));
  }

  /** Saves its name and question, changed in place; a name stays required (DEC-UX-119, FR-SR-45). */
  async function rename(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!query || !renaming || renaming.name.trim() === '') return;
    const fields = { name: renaming.name.trim(), question: renaming.question.trim() };
    const of = query.id;
    renameSaving = true;
    renameFailed = false;
    try {
      await client.rename(of, fields);
      if (query?.id === of) query = { ...query, ...fields };
      renaming = null;
      onran();
    } catch (error) {
      console.error('The name of the query could not be saved', error);
      renameFailed = true;
    } finally {
      renameSaving = false;
    }
  }

  function removeParameter(name: string): void {
    parameters = parameters.filter((parameter) => parameter.name !== name);
    parameterWindow = null;
  }

  const openParameter = (parameter: Parameter | null, defines: MissingParameter | null = null) => (parameterWindow = { key: ++windows, parameter, defines });

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const visible = $derived(query?.resources.flatMap((resource) => (resource.visible ? [resource] : [])) ?? []);
  const collectionName = (collectionId: string | null) => collections?.find((collection) => collection.id === collectionId)?.name ?? '';
  /** The SQL and Parameters shown: of the query, or of the run being previewed. */
  const shownSql = $derived(preview ? preview.run.sql : sql);
  const shownParameters = $derived(preview ? preview.run.parameters : parameters);

  /** The columns of its Resources, partition and cluster columns first and marked (FR-SR-42, DEC-UX-115). */
  const suggestions: Suggestion[] = $derived(
    visible.flatMap((resource) =>
      resource.fields.map((field) => {
        const cluster = resource.clusterBy.indexOf(field.name);
        return {
          name: field.name,
          type: field.dataType,
          resource: resource.displayName,
          role: resource.partition?.field === field.name ? { kind: 'partition' as const } : cluster >= 0 ? { kind: 'cluster' as const, place: cluster + 1 } : null,
          description: field.description,
          businessDescription: field.businessDescription,
        };
      }),
    ),
  );
  /** Its Parameters after `@`, each with its type and value. */
  const parameterSuggestions: ParameterSuggestion[] = $derived(
    parameters.flatMap((parameter) =>
      namesOf(parameter).map((name) => ({ name, type: parameter.kind === 'period' ? 'DATE' : kindOf(parameter.kind).type, value: describe(parameter, language).value })),
    ),
  );

  /** The problems and warnings of the Pre-flight of the SQL and Parameters as they are now. */
  const current = $derived(preflight && checked === key ? preflight : null);
  const problems = $derived(current?.problems ?? []);
  const marks: ErrorMark[] = $derived(
    problems.flatMap((problem): ErrorMark[] => {
      if (problem.kind === 'outside' && problem.start !== null && problem.end !== null) return [{ from: problem.start, to: problem.end, message: t('query.problem.outside', { name: problem.name }), kind: 'outside' }];
      if (problem.kind === 'undefinedParameter') return [{ from: problem.start, to: problem.end, message: t('query.problem.undefinedParameter', { name: problem.name }), kind: 'undefined' }];
      return [];
    }),
  );
  /** The @names of the SQL that are not a Parameter, each once, where it first is. */
  const missing: MissingParameter[] = $derived(
    problems.flatMap((problem) => (problem.kind === 'undefinedParameter' ? [{ name: problem.name, line: sql.slice(0, problem.start).split('\n').length, suggestedKind: problem.suggestedKind }] : [])).filter((entry, index, all) => all.findIndex((other) => other.name === entry.name) === index),
  );
  /** The tables outside its Resources, each once, with the Resource the User may see by that name, to start a new query with. */
  const outside = $derived(
    problems
      .flatMap((problem) => (problem.kind === 'outside' ? [problem.name] : []))
      .filter((name, index, all) => all.indexOf(name) === index)
      .map((name) => {
        // The Key is in lower case; the SQL names the table in its own case.
        const written = name.toLowerCase();
        const item = (collections ?? []).flatMap((collection) => collection.resources).find((candidate) => candidate.key === written || (written.split('.').length === 2 && candidate.key.endsWith(`.${written}`)));
        return { name, resource: item && !query?.resources.some((resource) => resource.id === item.id) ? item.id : null };
      }),
  );

  function said(problem: Problem | Warning): string {
    switch (problem.kind) {
      case 'empty':
        return t('query.problem.empty');
      case 'notVisible':
        return t('query.problem.notVisible', { name: problem.resource.displayName });
      case 'outside':
        return t('query.problem.outside', { name: problem.name });
      case 'undefinedParameter':
        return t('query.problem.undefinedParameter', { name: problem.name });
      case 'notSelect':
        return t('query.problem.notSelect');
      case 'filterRequired':
        return t('query.problem.filterRequired', { name: problem.resource.displayName, column: problem.column });
      case 'invalid':
        return t('query.problem.invalid', { message: problem.message });
      case 'noPartitionFilter':
        return problem.bytesWithFilter === null
          ? t('query.warning.noFilter', { name: problem.resource.displayName, column: problem.column })
          : t('query.warning.noFilter.with', { name: problem.resource.displayName, column: problem.column, bytes: bytes(problem.bytesWithFilter) });
    }
  }
  /**
   * What the editor suggests after `from` and `join`: the Resources of the query, then every other one
   * the User may use, while the query may take one more, each once (DEC-UX-148, DEC-UX-155).
   */
  const tables: TableSuggestion[] = $derived.by(() => {
    if (!query) return [];
    const own = query.resources.flatMap((resource) => (resource.visible ? [{ id: resource.id, name: resource.displayName, fullName: resource.fullName ?? resource.key }] : []));
    if (!query.mine || query.resources.length >= 10) return own;
    const taken = new Set(query.resources.map((resource) => resource.id));
    const others = (collections ?? [])
      .flatMap((collection) => collection.resources)
      .filter((item) => {
        // A Resource in two Collections is suggested once.
        if (item.withdrawn || taken.has(item.id)) return false;
        taken.add(item.id);
        return true;
      })
      .map((item) => ({ id: item.id, name: item.displayName, fullName: item.key, other: true }));
    return [...own, ...others];
  });

  /** Each problem once: an @name is named once, however often it is in the SQL. */
  const once = <T extends Problem | Warning>(notes: readonly T[]): T[] =>
    notes.filter((note, index, all) => note.kind !== 'undefinedParameter' || all.findIndex((other) => other.kind === 'undefinedParameter' && other.name === note.name) === index);
  /**
   * The line at the foot of the query (DEC-UX-154): the last Pre-flight, kept, softer, while what is
   * written is checked again; what stops the query when it cannot run. Each keeps what it said while
   * it fades out.
   */
  const failing = $derived((preflight?.problems.length ?? 0) > 0);
  let flight = $state<Preflight | null>(null);
  let fault = $state<Problem[]>([]);
  $effect.pre(() => {
    if (!preflight) {
      flight = null;
      fault = [];
    } else if (preflight.problems.length > 0) {
      fault = once(preflight.problems);
    } else {
      flight = preflight;
    }
  });

  /** The box of the SQL folded: how many lines and CTEs (DEC-UX-76). */
  const summary = $derived(t('query.sqlSummary', { lines: shownSql.split('\n').length, ctes: shownSql.split('\n').filter((line) => CTE_LINE.test(line)).length }));
  /** Partitioned Resources it reads: they read less with a filter on their partition column. */
  const partitioned = $derived(visible.filter((resource) => resource.partition));

  /** When something happened, as the history says it: "today, 08:12", "23 Oct, 10:02". */
  const when = (at: string) => whenIn(at, language);
  /** The time of today, or the day and time before. */
  const since = (at: string) => (new Date(at).toDateString() === new Date().toDateString() ? clock(at, language) : when(at));

  /** A value as a run used it: a function as the day it gave that day, where Data Hub can tell. */
  function valueAt(parameter: Parameter, at: Date): string {
    const dated = (value: string) => {
      const found = isFunction('date', value) ? dayOf(value, at) : value;
      return found ? formatDay(found, language) : value;
    };
    if (parameter.kind === 'date') return dated(parameter.value);
    if (parameter.kind === 'period') return t('param.period', { from: dated(parameter.value), to: dated(parameter.to) });
    return describe(parameter, language).value;
  }
  /** "with @dateFrom 1 Jan 2026, …": the values of a run, of the Parameters in its SQL. */
  function valuesOf(of: Run): string {
    const used = of.parameters.filter((parameter) => namesOf(parameter).some((name) => lineOf(of.sql, name) !== null));
    return used.length ? `, ${t('query.with', { values: used.map((parameter) => `@${parameter.name} ${valueAt(parameter, new Date(of.startedAt))}`).join(', ') })}` : '';
  }

  const shownRun = $derived(preview ? preview.run : run);
  const startLine = $derived.by(() => {
    if (!query) return '';
    const date = when(query.createdAt);
    const from = query.startedFrom;
    if (!from) return t('history.start', { date, resources: query.resources.map((resource) => resource.displayName).join(', ') });
    return from.afterRun === null ? t('history.startFrom', { date, name: from.name }) : t('history.startFrom.after', { date, name: from.name, run: from.afterRun });
  });
</script>

{#if query === null}
  <NotFound />
{:else if query}
  {@const from = query.startedFrom}
  <!-- The page fills the height of the screen; the query and the result each scroll on their own (DEC-UX-144). -->
  <div class="page">
  <header class="head">
    <div class="titles">
      <div class="meta">Query</div>
      {#if renaming}
        <form class="rename" onsubmit={rename}>
          <Field label={t('query.name')}><input type="text" bind:value={renaming.name} maxlength="120" required /></Field>
          <Field label={t('query.question')}><textarea bind:value={renaming.question} rows="2" maxlength="500"></textarea></Field>
          <span class="rename-actions">
            <Button type="submit" disabled={renameSaving || renaming.name.trim() === ''}>{t('query.save')}</Button>
            <Button variant="quiet" onclick={() => (renaming = null)}>{t('query.cancel')}</Button>
            {#if renameFailed}<span class="rename-failed" role="alert">{t('query.renameFailed')}</span>{/if}
          </span>
        </form>
      {:else if query.mine}
        {@const start = () => query && ((renaming = { name: query.name, question: query.question }), (renameFailed = false))}
        <h1 class="page-title"><button type="button" class="in-place" title={t('query.rename')} onclick={start}>{query.name}</button></h1>
        {#if query.question}<p class="question"><button type="button" class="in-place" title={t('query.rename')} onclick={start}>{query.question}</button></p>{/if}
      {:else}
        <h1 class="page-title">{query.name}</h1>
        {#if query.question}<p class="question">{query.question}</p>{/if}
      {/if}
      {#if from}
        <p class="meta origin">
          <Icon name="git-branch" /><span
            >{#each tParts(from.afterRun === null ? 'query.startedFrom' : 'query.startedFrom.after', { run: from.afterRun ?? 0 }, { name: from.name }) as part, index (index)}{#if 'name' in part}<a
                  href={queryPath(from.id)}>{part.name}</a
                >{:else}{part.text}{/if}{/each}</span
          >
        </p>
      {/if}
      {#if query.lens}
        {@const lens = query.lens}
        <!-- A query used as a Lens says so, with a link to it (DEC-LE-03). -->
        <p class="meta origin">
          <Icon name="aperture" /><span
            >{#each tParts(lens.state === 'waiting' ? 'query.usedAs.waiting' : 'query.usedAs', { date: formatDay(lens.createdAt.slice(0, 10), currentLanguage()) }, { name: lens.name }) as part, index (index)}{#if 'name' in part}<a
                  href={lensPath(lens.id)}>{part.name}</a
                >{:else}{part.text}{/if}{/each}{#if query.mine && lens.state !== 'waiting'}{' '}{t('query.usedAs.update')}{/if}</span
          >
        </p>
      {/if}
      {#if !query.mine}<p class="meta">{t('query.of', { name: query.ownerName })}</p>{/if}
    </div>
    <div class="actions">
      <span class="layouts" role="group" aria-label={t('query.layout')}>
        {#each [['horizontal', 'rows', t('query.layout.horizontal')], ['sideBySide', 'columns', t('query.layout.sideBySide')]] as const as [option, icon, name] (option)}
          <button type="button" aria-pressed={layout === option} aria-label={name} title={name} onclick={() => onlayout?.(option)}><Icon name={icon} /></button>
        {/each}
      </span>
      <Button variant="outline" href={NEW_QUERY}><Icon name="plus-circle-fill" />{t('query.new')}</Button>
      <Button variant="outline" disabled={hiding} title={t(hidden ? 'query.unhide.hint' : 'query.hide.hint')} onclick={toggleHidden}
        ><Icon name={hidden ? 'eye' : 'eye-slash-fill'} />{t(hidden ? 'query.page.unhide' : 'query.page.hide')}</Button
      >
      {#if query.mine && query.kind === 'query' && query.lens}
        <!-- A query used as a Lens overwrites it, after its size check (DEC-UX-77). -->
        <Button disabled={query.lens.state === 'waiting'} title={t(query.lens.state === 'waiting' ? 'lens.update.waiting' : 'lens.update.hint')} onclick={() => (updating = true)}
          ><Icon name="arrows-clockwise" />{t('lens.update.button')}</Button
        >
      {:else if query.mine && query.kind === 'query'}
        <!-- The logical next step once a query answers a question that comes back (DEC-UX-25). -->
        <Button href={newLensPath(query.id)}>{t('query.makeLens')}</Button>
      {/if}
    </div>
  </header>

  {#if broken}
    <!-- A Broken query: Run is off and this names what it misses, and since when (FR-SR-53, DEC-UX-160). -->
    <div class="broken">
      <Callout icon="link-break-fill" tone="urgent">
        <b>{t('query.broken.title')}</b>
        {t('query.broken.text', { missing: missingOfQuery(broken, query.resources) ?? '', date: formatDay(broken.since.slice(0, 10), currentLanguage()) })}
      </Callout>
    </div>
  {/if}

  <div class="work" class:side={layout === 'sideBySide'} class:dragging bind:this={work} style:--split="{split}%">
  <section class="frame card" aria-label={query.name}>
    <div class="scope">
      <span class="label">{t('query.readsOnly')}</span>
      <span class="chips">
        {#each query.resources as resource (resource.id)}
          <span class="chip" class:gone={!resource.visible}>
            {#if resource.visible}
              <a href={resourcePath(resource.id)}>
                <KindIcon kind="resource" />{resource.displayName}{#if collectionName(resource.collectionId)}<span class="meta">· {collectionName(resource.collectionId)}</span>{/if}
                <MaturityIcon level={resource.level} small />
              </a>
            {:else}
              <span title={t('query.problem.notVisible', { name: resource.displayName })}><Icon name="lock-simple" />{resource.displayName}</span>
            {/if}
            {#if query.mine && !preview && query.resources.length > 1}
              <button type="button" class="x" aria-label={t('query.remove', { name: resource.displayName })} onclick={() => (newSet = { mode: 'remove', resource: resource.id })}><Icon name="x" /></button>
            {/if}
          </span>
        {/each}
        {#if query.mine && !preview && query.resources.length < 10}
          <button type="button" class="add" onclick={() => (newSet = { mode: 'add', resource: null })}><Icon name="plus" />{t('query.resources.add')}</button>
        {/if}
        {#each outside as table (table.name)}
          <span class="chip outside">
            <Icon name="warning-fill" />{t('query.problem.outside', { name: table.name })}
            {#if table.resource && query.mine}
              {@const add = table.resource}
              <button type="button" class="text-link" onclick={() => (newSet = { mode: 'add', resource: add })}>{t('query.startWith')}</button>
            {/if}
          </span>
        {/each}
      </span>
      <!-- A query used as a Lens already is one (DEC-UX-77). -->
      {#if !query.lens && query.kind === 'query'}
        <Button variant="quiet" disabled={!lensesOn} title={t('lenses.sheet.hint')} onclick={() => (lensesOpen = true)}
          ><Icon name="aperture" />{t('query.lensesOn', { count: lensesOn ? lensesOn.exact.length + lensesOn.more.length : 0 })}</Button
        >
      {/if}
    </div>

    <!-- The editor takes the height that is left; its Parameters stand to its right, or under it next to the result (DEC-UX-147). -->
    <div class="body">
    <div class="box editor-box" class:open={boxOpen}>
      <div class="box-head">
        <button type="button" class="toggle" aria-expanded={boxOpen} aria-label={t(boxOpen ? 'editor.fold' : 'editor.unfold')} onclick={() => (boxOpen = !boxOpen)}><Icon name="caret-down" /></button>
        <span class="label">BigQuery SQL</span>
        {#if !boxOpen}<span class="meta">{summary}</span>{/if}
        <span class="grow"></span>
        {#if boxOpen && query.mine && !preview}
          <Button variant="outline" onclick={() => editor?.foldAll()}>{t('query.foldAll')}</Button>
          <Button variant="outline" title="Shift+Alt+F" onclick={() => editor?.formatSql()}>{t('query.format')}</Button>
        {/if}
      </div>
      <div class="sql" hidden={!boxOpen}>
        {#if preview}
          {#key preview.run.number}
            <SqlEditor value={preview.run.sql} {suggestions} label={t('history.run', { number: preview.run.number })} readonly {nonce} />
          {/key}
        {:else}
          <SqlEditor
            bind:this={editor}
            bind:value={sql}
            {suggestions}
            parameters={parameterSuggestions}
            {tables}
            onnewtable={query.mine && query.resources.length < 10 ? () => (newSet = { mode: 'add', resource: null }) : undefined}
            onothertable={(table) => (newSet = { mode: 'add', resource: table.id })}
            {marks}
            onmark={(mark) => {
              const entry = missing.find((candidate) => sql.slice(mark.from, mark.to) === `@${candidate.name}`);
              if (entry) openParameter(null, entry);
            }}
            onrun={runFromKeys}
            label={t('query.sql', { name: query.name })}
            readonly={!query.mine}
            {nonce}
          />
        {/if}
      </div>
    </div>

    <div class="params">
    <QueryParameters
      parameters={shownParameters}
      sql={shownSql}
      unused={preview ? [] : (current?.unused ?? [])}
      missing={preview ? [] : missing}
      bind:open={parametersOpen}
      readonly={!query.mine || !!preview}
      onedit={(name) => openParameter(shownParameters.find((parameter) => parameter.name === name) ?? null)}
      ondefine={(entry) => openParameter(null, entry)}
      onadd={() => openParameter(null)}
    />
    </div>
    </div>

    {#if query.mine && !preview}
      <div class="run-bar" bind:this={runBar}>
        {#snippet fixOf(note: Problem | Warning)}
          {#if (note.kind === 'filterRequired' || note.kind === 'noPartitionFilter') && note.fix}
            {@const fix = note.fix}
            <button type="button" class="text-link" onclick={() => ((atOnce = true), (sql = fix))}>{t('query.addFilter')}</button>
          {:else if note.kind === 'undefinedParameter'}
            {@const entry = missing.find((candidate) => candidate.name === note.name)}
            {#if entry}<button type="button" class="text-link" onclick={() => openParameter(null, entry)}>{t('query.defineIt')}</button>{/if}
          {/if}
        {/snippet}
        <!-- One line of a fixed height: the Pre-flight, or what stops the query; the one fades out a
             little quicker than the other fades in, so the query never changes height (DEC-UX-154). -->
        <div class="status" class:stale={!current} aria-busy={checking} aria-live="polite">
          <span class="layer flight" class:shown={!failing} aria-hidden={failing} inert={failing}>
            <span class="meta">Pre-flight</span>
            {#if flight?.bytes !== null && flight?.bytes !== undefined}
              <Gauge bytes={flight.bytes} approve={flight.thresholds.approve} request={flight.thresholds.request} />
              <span class="meta reads"
                >{[
                  flight.partitions !== null ? t('query.partitions', { count: flight.partitions }) : t('query.reads', { bytes: bytes(flight.bytes) }),
                  partitioned.length === 1 && partitioned[0]?.partition ? t('query.through', { column: partitioned[0].partition.field }) : '',
                ]
                  .filter(Boolean)
                  .join(' ')}</span
              >
              {#each flight.warnings.slice(0, 1) as warning, index (index)}
                <span class="warning" title={said(warning)}><Icon name="warning-fill" /><span class="said">{said(warning)}</span>{@render fixOf(warning)}</span>
              {/each}
            {:else}
              <span class="meta">{t(checking ? 'query.checking' : 'query.notChecked')}</span>
            {/if}
          </span>
          <span class="layer fault" class:shown={failing} aria-hidden={!failing} inert={!failing}>
            {#if fault[0]}
              {@const first = fault[0]}
              <Icon name="warning-fill" />
              <span class="said" title={fault.map(said).join('\n')}>{said(first)}</span>
              {@render fixOf(first)}
              {#if fault.length > 1}<span class="more" title={fault.slice(1).map(said).join('\n')}>+{fault.length - 1}</span>{/if}
            {/if}
          </span>
        </div>
        {#if current?.range === 'request' && query.request?.state === 'waiting'}
          <span class="waiting"><Icon name="hourglass-medium-fill" />{t('query.request.waiting', { time: since(query.request.sentAt) })}</span>
        {:else if current?.range === 'request' && query.request?.state !== 'accepted'}
          <RunButton
            bytes={current.bytes}
            approve
            icon="paper-plane-tilt"
            label={t('query.request.send')}
            disabled={!current.runnable || checking}
            title={!current.runnable ? t('query.cannotRun') : undefined}
            open={requestOpen}
            onclick={() => (requestOpen = !requestOpen)}
          >
            {#snippet popout()}
              <span class="request">
                <span><b>{t('query.request.large')}</b> {t('query.request.why', { request: bytes(current?.thresholds.request ?? 0) })}</span>
                <label class="word"><span>{t('query.request.word')}</span><textarea rows="2" maxlength="500" bind:value={requestText}></textarea></label>
                <Button wide disabled={sending} onclick={send}><Icon name="paper-plane-tilt" />{t('query.request.sendIt')}</Button>
                <span class="after" class:failed={requestFailed} role={requestFailed ? 'alert' : undefined}>{t(requestFailed ? 'query.request.failed' : 'query.request.after')}</span>
              </span>
            {/snippet}
          </RunButton>
        {:else}
          <RunButton
            bytes={current?.bytes ?? null}
            approve={current?.range === 'approve' || current?.range === 'request'}
            disabled={!current?.runnable || checking || broken !== null}
            busy={running}
            title={broken !== null ? t('query.broken.run') : !current?.runnable ? t('query.cannotRun') : undefined}
            onclick={start}
          >
            {#snippet explain()}
              {#if current?.bytes !== null && current?.bytes !== undefined}
                {@const words = { bytes: bytes(current.bytes), approve: bytes(current.thresholds.approve), request: bytes(current.thresholds.request) }}
                <b>{current.range === 'request' ? t('query.explain.accepted', words) : current.range === 'approve' ? t('query.explain.approve', words) : t('query.explain.free', words)}</b>
                {t('query.explain.atMost')}
                {#if partitioned.length > 0}
                  {t('query.explain.less', { columns: partitioned.map((resource) => resource.partition?.field).join(', ') })}
                {/if}
              {/if}
            {/snippet}
          </RunButton>
        {/if}
      </div>
    {/if}
  </section>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="divider"
    role="separator"
    tabindex="0"
    aria-orientation={layout === 'sideBySide' ? 'vertical' : 'horizontal'}
    aria-valuenow={Math.round(split)}
    aria-valuemin={20}
    aria-valuemax={80}
    aria-label={t('query.divider')}
    title={t('query.divider')}
    onpointerdown={drag}
    onkeydown={nudge}
  ></div>

  <section class="result card" aria-label={t('query.result')}>
    <div class="result-head">
      <Segmented
        options={[
          { value: 'result', label: shownRun ? t('query.resultOf', { number: shownRun.number }) : t('query.result') },
          { value: 'history', label: t('query.historyTab', { count: query.runs }) },
        ]}
        bind:value={tab}
        label={t('query.resultTabs')}
        surface="sub"
      />
      {#if tab === 'result' && shownRun}<span class="meta">{ago(shownRun.startedAt, language)}{valuesOf(shownRun)}</span>{/if}
    </div>
    {#if tab === 'history'}
      <QueryHistory
        runs={history}
        shown={shownRun?.number ?? null}
        flash={typeof opened === 'number' ? opened : null}
        readonly={!query.mine}
        loading={loadingHistory}
        start={startLine}
        {when}
        onpreview={openPreview}
        onapply={apply}
        onmore={() => loadHistory(history?.at(-1)?.number)}
      />
    {:else if preview}
      {@const shown = preview}
      <div class="preview-bar">
        <Icon name="eye-fill" />
        <p><b>{t('history.previewOf', { number: shown.run.number, when: when(shown.run.startedAt) })}</b> {t(shown.expired ? 'history.preview.expired' : 'history.preview.kept')}</p>
        <Button variant="outline" onclick={() => (preview = null)}>{t('history.close')}</Button>
        {#if shown.expired && query.mine}<Button variant="outline" onclick={() => runAgain(shown.run)}><Icon name="play-fill" />{t('query.runAgain')}</Button>{/if}
        {#if query.mine}<Button onclick={() => apply(shown.run)}><Icon name="arrow-counter-clockwise" />{t('history.apply')}</Button>{/if}
      </div>
      {#if shown.run.state === 'failed'}
        <p class="empty failed" role="alert"><Icon name="warning-fill" /><span><b>{t('query.failed')}</b> {shown.run.error}</span></p>
      {:else if shown.page}
        {@render grid(shown.run, shown.page)}
      {:else if !query.mine}
        <p class="empty"><Icon name="info" /><span>{t('query.notYours', { name: shown.run.userName, ref: shown.run.ref })}</span></p>
      {/if}
    {:else if running}
      <p class="empty"><Icon name="play-fill" /><span>{t('query.running')}</span></p>
    {:else if failure}
      <p class="empty failed" role="alert"><Icon name="warning-fill" /><span><b>{t('query.failed')}</b> {failure}</span></p>
    {:else if expired && run}
      <p class="empty">
        <Icon name="info" /><span><b>{t('query.expired')}</b> {t('query.expired.text')}</span>
        {#if query.mine}<Button variant="outline" disabled={!current?.runnable} onclick={start}>{t('query.runAgain')}</Button>{/if}
      </p>
    {:else if page && run}
      {@render grid(run, page)}
    {:else if run && !query.mine}
      <p class="empty"><Icon name="info" /><span>{t('query.notYours', { name: run.userName, ref: run.ref })}</span></p>
    {:else if !run}
      <p class="empty"><Icon name="play-fill" /><span><b>{t('query.notRun')}</b> {t('query.notRun.text')}</span></p>
    {/if}
  </section>
  </div>
  </div>

  {#if parameterWindow}
    {#key parameterWindow.key}
      <ParameterWindow
        queryName={query.name}
        parameter={parameterWindow.parameter}
        defines={parameterWindow.defines}
        others={parameters}
        sql={shownSql}
        readonly={!query.mine || !!preview}
        onsave={saveParameter}
        onremove={removeParameter}
        onclose={() => (parameterWindow = null)}
      />
    {/key}
  {/if}

  {#if newSet}
    <NewSetSheet
      {query}
      {sql}
      {parameters}
      {collections}
      mode={newSet.mode}
      resource={newSet.resource}
      onclose={() => (newSet = null)}
      onstart={startNew}
      lensesOn={(on, words) => client.suggestions(on, words)}
    />
  {/if}

  {#if lensesOpen && lensesOn}
    <Sheet title={t('lenses.sheet.title')} onclose={() => (lensesOpen = false)}>
      {#snippet top()}<p class="meta sheet-over">{t('lenses.sheet.over')}</p>{/snippet}
      <p class="meta sheet-intro">{t('lenses.sheet.intro')}</p>
      <div class="sheet-lenses"><LensSuggestions found={lensesOn} resources={visibleIds()} {collections} /></div>
      {#snippet foot()}<Button variant="quiet" onclick={() => (lensesOpen = false)}>{t('lenses.sheet.back')}</Button>{/snippet}
    </Sheet>
  {/if}

  {#if updating && query.lens}
    <UpdateLensSheet
      {query}
      lens={query.lens}
      collection={collectionName(query.lens.collectionId)}
      preflight={current}
      {client}
      onclose={() => (updating = false)}
      onupdated={(lens) => {
        updating = false;
        onlens(lens);
      }}
    />
  {/if}
{/if}

{#snippet grid(of: Run, rows: Page)}
  <DataGrid columns={rows.columns} rows={rows.rows} first={(rows.number - 1) * rows.size + 1} label={t('query.resultOf', { number: of.number })} />
  <div class="foot">
    <span>{t('query.rows', { count: rows.totalRows })}</span>
    {#if of.processedBytes !== null}<span class="dot">·</span><span>{t('query.read', { bytes: bytes(of.processedBytes) })}</span>{/if}
    {#if of.partitions !== null}<span class="dot">·</span><span>{t('query.partitions', { count: of.partitions })}</span>{/if}
    <span class="dot">·</span>
    <span class="ref">{t('query.ref')} <span class="mono">{of.ref}</span><CopyButton text={of.ref} label={t('query.copyRef')} /></span>
    <span class="pager"><Pager page={rows.number} size={rows.size} total={rows.totalRows} busy={paging} onpage={turn} /></span>
  </div>
{/snippet}

<style>
  .head { display: flex; align-items: flex-start; gap: 16px; margin-top: 8px; }
  .titles { flex: 1; min-width: 0; }
  .question { margin: 4px 0 0; font-size: var(--text-small); color: var(--text-secondary); }
  .in-place { all: unset; cursor: text; border-radius: var(--radius-sm); }
  .in-place:hover { background: var(--tint-hover); }
  .in-place:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .rename { max-width: 640px; margin-top: 6px; }
  .rename-actions { display: flex; align-items: center; gap: 8px; }
  .rename-failed { font-size: var(--text-small); color: var(--signal-urgent); }
  .origin { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; }
  .origin a { color: var(--text-secondary); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  /* The page fills the height of the screen: the query and the result split it, each scrolling on its own (DEC-UX-144). */
  .page { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .head { flex: none; }
  .broken { flex: none; }
  .work { flex: 1; min-height: 360px; display: grid; margin-top: 14px; grid-template-rows: minmax(0, var(--split)) 14px minmax(0, 1fr); }
  .work.side { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, var(--split)) 14px minmax(0, 1fr); }
  .work.dragging { user-select: none; }
  .divider { display: flex; align-items: center; justify-content: center; cursor: row-resize; touch-action: none; }
  .side .divider { cursor: col-resize; }
  .divider::before { content: ''; width: 44px; height: 4px; border-radius: var(--radius-pill); background: var(--tint-active); transition: background var(--motion-fold) ease; }
  .side .divider::before { width: 4px; height: 44px; }
  .divider:hover::before, .divider:focus-visible::before, .dragging .divider::before { background: var(--text-muted); }
  .divider:focus-visible { outline: none; }
  .layouts { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--radius-pill); background: var(--surface-sub); }
  .layouts button { width: 30px; height: 30px; border: 0; border-radius: var(--radius-pill); background: none; color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; }
  .layouts button[aria-pressed='true'] { background: var(--card); color: var(--text-primary); }
  .layouts button:focus-visible { outline: 2px solid var(--text-secondary); }
  .frame { min-height: 0; overflow: auto; border-radius: var(--radius-xl); padding: 14px 14px 0; display: flex; flex-direction: column; gap: 10px; }
  /* The editor takes the height that is left, scrolling in itself; its Parameters stand to its right, or, next to
     the result, under it (DEC-UX-147). */
  .body { flex: 1 1 auto; min-height: 140px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 32%); gap: 10px; align-items: stretch; }
  .side .body { display: flex; flex-direction: column; }
  .editor-box { min-height: 0; display: flex; flex-direction: column; }
  .editor-box:not(.open) { align-self: start; }
  .side .editor-box.open { flex: 1 1 auto; }
  .sql { flex: 1 1 auto; min-height: 80px; display: flex; flex-direction: column; }
  .sql[hidden] { display: none; }
  .sql > :global(.editor) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .sql > :global(.editor .cm-editor) { flex: 1 1 auto; min-height: 0; }
  .params { min-height: 0; overflow: auto; }
  .side .params { flex: none; max-height: 40%; }
  .sheet-over { display: block; margin: 0 0 2px; }
  .sheet-intro { display: block; line-height: 1.5; margin: 8px 0 0; }
  .sheet-lenses { flex: 1; overflow: auto; margin: 4px -4px 0; padding: 0 4px; }
  .scope { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; padding: 2px 2px 0; }
  .scope > .label { flex: none; line-height: 26px; margin: 0; }
  /* In a narrow query, next to its result, the Lenses on its Resources move to a line of their own (DEC-UX-143). */
  .chips { flex: 1 1 260px; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; font-size: var(--text-meta); color: var(--text-primary); background: var(--surface-sub); padding: 4px 6px 4px 10px; border-radius: var(--radius-pill); }
  .chip > a, .chip > span { display: inline-flex; align-items: center; gap: 5px; color: inherit; text-decoration: none; padding-right: 4px; }
  .chip:hover { background: var(--tint-active); }
  .chip .meta { white-space: nowrap; }
  .chip.gone { color: var(--text-muted); }
  .chip.outside { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 12%, var(--surface-solid)); padding-right: 10px; }
  .chip.outside .text-link { color: var(--signal-warn); font-weight: var(--weight-medium); }
  .x { width: 20px; height: 20px; border: 0; border-radius: 50%; background: none; color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; }
  .x:hover { background: var(--tint-active); color: var(--text-primary); }
  .add { display: inline-flex; align-items: center; gap: 5px; font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: none; border: 1px dashed var(--tint-active); border-radius: var(--radius-pill); padding: 4px 10px; cursor: pointer; }
  .add:hover { color: var(--text-primary); }
  .box { border-radius: var(--radius-lg); background: var(--surface-sub); padding: 10px 14px 14px; }
  .box-head { display: flex; align-items: center; gap: 8px; min-height: 34px; margin-bottom: 6px; flex-wrap: wrap; }
  .box-head .label { margin: 0; }
  .toggle { width: 26px; height: 26px; margin-left: -6px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
  .toggle:hover { background: var(--tint-active); }
  .toggle :global(.icon) { transition: transform var(--motion-fold) ease; }
  .toggle[aria-expanded='false'] :global(.icon) { transform: rotate(-90deg); }
  .grow { flex: 1; }
  .run-bar { position: sticky; bottom: 0; z-index: 4; display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; margin: 2px -14px 0; padding: 12px 14px;
    border-top: 1px solid var(--tint-hover); border-radius: 0 0 var(--radius-xl) var(--radius-xl); background: var(--card); }
  .frame:not(:has(.run-bar)) { padding-bottom: 14px; }
  /* The line at the foot: a fixed height, the Pre-flight and what stops the query in one place,
     cross-fading, the old one a little quicker; while what is written is checked again, softer (DEC-UX-154). */
  .status { flex: 1 1 auto; min-width: 0; height: 48px; display: grid; align-items: center; }
  .layer { grid-area: 1 / 1; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 2px 10px; overflow: hidden; max-height: 48px;
    opacity: 0; transition: opacity var(--motion-status-out); }
  .layer.shown { opacity: 1; transition: opacity var(--motion-status-in); }
  .status.stale .layer.shown { opacity: .6; }
  .reads { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .warning { flex: 1 1 100%; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: var(--text-meta); color: var(--signal-warn); white-space: nowrap; }
  .warning .said { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .warning .text-link, .fault .text-link { color: var(--signal-warn); font-weight: var(--weight-medium); flex: none; }
  .fault { flex-wrap: nowrap; gap: 6px; font-size: var(--text-small); color: var(--signal-warn); }
  .fault .said { min-width: 0; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
  .fault .more { flex: none; font-size: var(--text-meta); color: var(--text-muted); }
  .text-link { all: unset; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .waiting { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-small); color: var(--text-secondary); }
  .request { display: flex; flex-direction: column; gap: 10px; }
  .word { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .word textarea { box-sizing: border-box; width: 100%; resize: vertical; font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 7px 9px; }
  .word textarea:focus-visible { outline: 2px solid var(--text-secondary); }
  .after { font-size: var(--text-meta); color: var(--text-muted); }
  .after.failed { color: var(--signal-urgent); }
  .result { min-height: 0; overflow: auto; border-radius: var(--radius-xl); padding: 16px; }
  .result-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .preview-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 10px; padding: 12px 14px; border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--signal-warn) 10%, var(--surface-solid)); font-size: var(--text-small); line-height: 1.5; }
  .preview-bar > :global(.icon) { font-size: 18px; color: var(--signal-warn); }
  .preview-bar p { flex: 1; min-width: 240px; margin: 0; }
  .preview-bar b { font-weight: var(--weight-medium); }
  .empty { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin: 0; padding: 28px 22px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .empty > :global(.icon) { font-size: 22px; color: var(--text-secondary); flex: none; }
  .empty > span { flex: 1; min-width: 200px; }
  .empty b { font-weight: var(--weight-medium); }
  .failed > :global(.icon) { color: var(--signal-urgent); }
  .foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; padding: 8px 10px 0; font-size: var(--text-meta); color: var(--text-muted); }
  .dot { color: var(--tint-active); }
  .ref { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); }
  .pager { margin-left: auto; }
</style>
