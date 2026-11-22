import {
  DISGUISED_DEFAULTS,
  EDA_STEPS,
  PROBES,
  type DataHubReading,
  type DisguisedLists,
  type EdaField,
  type EdaListItem,
  type EdaStep,
  type EdaView,
  type OwnerReading,
  type ProbeKey,
  type ProbeView,
  type ResultView,
  type RunAnswer,
  type VolumeResult,
} from '@datahub/contracts/eda';
import { kindOf } from '@datahub/contracts/model-types';
import type { IconName } from '@datahub/ui/foundations/icons.js';
import { createCall, NotFound, Refused } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/**
 * The EDA of a Resource in the web app (TR-ED-07): the calls of the page to eda, with the Access Token of the User
 * (TR-ED-01), and what the screens of the section EDA read from its answers. The rules themselves, which EDA-Probes a
 * model type needs and what an EDA covers, are those of `@datahub/contracts/eda`, the same for eda and the page.
 */

/** What a run of an EDA-Probe is asked with: the fields it is set on, its own parameters, and the approval. */
export interface RunAsk {
  fields?: readonly string[];
  params?: Readonly<Record<string, unknown>>;
  approve?: boolean;
}

/** An answer of eda that is the EDA itself, rather than an acknowledgement. */
function isView(body: unknown): body is EdaView {
  return typeof body === 'object' && body !== null && Array.isArray((body as { probes?: unknown }).probes) && typeof (body as { resource?: unknown }).resource === 'object';
}

/**
 * A Resource ready for an EDA, as eda lists it beside the EDAs (FR-ED-03): at 3 · Confirmed or above, without one.
 * Not in `@datahub/contracts/eda`: eda keeps it as a type of its own (`ReadyItem`).
 */
export interface ReadyItem {
  resource: EdaListItem['resource'];
  level: number;
}

/** What the panel of EDA shows: the EDAs of the Resources the User sees, and those ready for one. */
export interface EdaList {
  edas: EdaListItem[];
  ready: ReadyItem[];
}

export function createEda(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('eda', config.edaUrl, session, request);
  const of = (id: string) => `/resources/${encodeURIComponent(id)}/eda`;

  /** The EDA of a Resource, or null when it has none (404). */
  async function get(id: string): Promise<EdaView | null> {
    try {
      return (await (await call(of(id))).json()) as EdaView;
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  /** The EDA as an answer gives it, or as eda gives it again when the answer holds no EDA. */
  async function viewFrom(response: Response, id: string): Promise<EdaView> {
    const body: unknown = await response.json().catch(() => null);
    if (isView(body)) return body;
    const found = await get(id);
    if (!found) throw new NotFound(of(id));
    return found;
  }

  return {
    /** The EDAs of the Resources the User sees, and the Resources ready for one, for the panel (FR-ED-03). */
    async list(): Promise<EdaList> {
      const body = (await (await call('/edas')).json()) as Partial<EdaList>;
      return { edas: body.edas ?? [], ready: body.ready ?? [] };
    },
    get,
    /**
     * Starts the EDA of a Resource at 3 · Confirmed or above (FR-ED-02); one that has an EDA already (409) answers it,
     * as a Resource has at most one.
     */
    async start(id: string): Promise<EdaView> {
      try {
        return await viewFrom(await call(of(id), { method: 'POST' }), id);
      } catch (error) {
        if (error instanceof Refused && error.status === 409) {
          const found = await get(id);
          if (found) return found;
        }
        throw error;
      }
    },
    /**
     * Adds an EDA-Probe if it is not yet and runs it (FR-ED-06): it ran, it waits for the User to approve it, or it
     * cannot run, with why. A refusal that eda answers with an error status says the same.
     */
    async run(id: string, probe: ProbeKey, ask: RunAsk = {}): Promise<RunAnswer> {
      try {
        return (await (await call(`${of(id)}/probes/${encodeURIComponent(probe)}/runs`, { method: 'POST', body: ask })).json()) as RunAnswer;
      } catch (error) {
        const state = error instanceof Refused ? error.body?.state : undefined;
        if (error instanceof Refused && (state === 'approve' || state === 'refused')) return error.body as unknown as RunAnswer;
        if (error instanceof Refused && error.status !== 403 && error.status < 500) {
          return { state: 'refused', bytes: null, reason: error.detail ?? error.code ?? '' };
        }
        throw error;
      }
    },
    /** The reading of who works on the EDA, of one subject of an EDA-Probe (FR-ED-11); answers the EDA as it is now. */
    async read(id: string, probe: ProbeKey, subject: string, reading: OwnerReading): Promise<EdaView> {
      return viewFrom(await call(`${of(id)}/probes/${encodeURIComponent(probe)}/readings`, { method: 'PUT', body: { subject, reading } }), id);
    },
  };
}

export type EdaClient = ReturnType<typeof createEda>;

// ----------------------------------------------------------------------------------------------------------------
// What the screens read from an EDA

/** The name of an EDA-Probe, in the language of the User: its English name is the contract's, its words a sentence. */
export const PROBE_TEXTS: Readonly<Record<ProbeKey, string>> = {
  grainHolds: 'eda.probe.grainHolds',
  dateRange: 'eda.probe.dateRange',
  volumeOverTime: 'eda.probe.volumeOverTime',
  settling: 'eda.probe.settling',
  howOftenThingsChange: 'eda.probe.howOftenThingsChange',
  nullsPerKeyField: 'eda.probe.nullsPerKeyField',
  disguisedNulls: 'eda.probe.disguisedNulls',
  whereGapsCluster: 'eda.probe.whereGapsCluster',
  valuesWithoutAMatch: 'eda.probe.valuesWithoutAMatch',
  distributionOfNumbers: 'eda.probe.distributionOfNumbers',
  distributionOfCategories: 'eda.probe.distributionOfCategories',
  sharePerSegment: 'eda.probe.sharePerSegment',
  outliers: 'eda.probe.outliers',
  mode: 'eda.probe.mode',
  spread: 'eda.probe.spread',
  impossibleValues: 'eda.probe.impossibleValues',
  storedAsText: 'eda.probe.storedAsText',
  variants: 'eda.probe.variants',
  relationshipsHold: 'eda.probe.relationshipsHold',
  datesInOrder: 'eda.probe.datesInOrder',
  addsUpToSource: 'eda.probe.addsUpToSource',
  derivedValuesAgree: 'eda.probe.derivedValuesAgree',
  differencesBetweenSegments: 'eda.probe.differencesBetweenSegments',
  correlations: 'eda.probe.correlations',
  chancePerSegment: 'eda.probe.chancePerSegment',
};

/**
 * What an EDA-Probe Data Hub runs does, why it matters, what it is set on and what its result will show, as its detail
 * says it (DEC-UX-324) and as the guide of an EDA unfolds it (DEC-UX-327).
 */
export const PROBE_ABOUT: Readonly<Partial<Record<ProbeKey, { does: string; why: string; setOn: string; empty: string }>>> = {
  grainHolds: { does: 'eda.about.grainHolds.does', why: 'eda.about.grainHolds.why', setOn: 'eda.about.grainHolds.setOn', empty: 'eda.about.grainHolds.empty' },
  nullsPerKeyField: { does: 'eda.about.nullsPerKeyField.does', why: 'eda.about.nullsPerKeyField.why', setOn: 'eda.about.nullsPerKeyField.setOn', empty: 'eda.about.nullsPerKeyField.empty' },
  volumeOverTime: { does: 'eda.about.volumeOverTime.does', why: 'eda.about.volumeOverTime.why', setOn: 'eda.about.volumeOverTime.setOn', empty: 'eda.about.volumeOverTime.empty' },
  distributionOfNumbers: { does: 'eda.about.distributionOfNumbers.does', why: 'eda.about.distributionOfNumbers.why', setOn: 'eda.about.distributionOfNumbers.setOn', empty: 'eda.about.distributionOfNumbers.empty' },
  distributionOfCategories: {
    does: 'eda.about.distributionOfCategories.does',
    why: 'eda.about.distributionOfCategories.why',
    setOn: 'eda.about.distributionOfCategories.setOn',
    empty: 'eda.about.distributionOfCategories.empty',
  },
  dateRange: { does: 'eda.about.dateRange.does', why: 'eda.about.dateRange.why', setOn: 'eda.about.dateRange.setOn', empty: 'eda.about.dateRange.empty' },
  disguisedNulls: { does: 'eda.about.disguisedNulls.does', why: 'eda.about.disguisedNulls.why', setOn: 'eda.about.disguisedNulls.setOn', empty: 'eda.about.disguisedNulls.empty' },
};

/** The name and the line of each EDA-Step (DEC-ED-11). */
export const STEP_TEXTS: Readonly<Record<EdaStep, { name: string; about: string }>> = {
  basis: { name: 'eda.step.basis', about: 'eda.step.basis.about' },
  gaps: { name: 'eda.step.gaps', about: 'eda.step.gaps.about' },
  weight: { name: 'eda.step.weight', about: 'eda.step.weight.about' },
  correctness: { name: 'eda.step.correctness', about: 'eda.step.correctness.about' },
  relations: { name: 'eda.step.relations', about: 'eda.step.relations.about' },
};

/** Data Hub's reading of a result (FR-ED-11): its words, its tone and its icon. */
export const READING_LOOK: Readonly<Record<DataHubReading, { text: string; tone: 'healthy' | 'attention' | 'informative'; icon: IconName }>> = {
  expected: { text: 'eda.reading.expected', tone: 'healthy', icon: 'check-circle-fill' },
  look: { text: 'eda.reading.look', tone: 'attention', icon: 'warning-circle-fill' },
  judge: { text: 'eda.reading.judge', tone: 'informative', icon: 'question-fill' },
};

/** The reading of who works on the EDA (FR-ED-11): its words, what it means, and its icon. */
export const OWNER_READINGS: readonly { reading: OwnerReading; text: string; means: string; icon: IconName }[] = [
  { reading: 'expected', text: 'eda.yours.expected', means: 'eda.yours.expected.means', icon: 'check' },
  { reading: 'known', text: 'eda.yours.known', means: 'eda.yours.known.means', icon: 'bookmark-simple' },
  { reading: 'problem', text: 'eda.yours.problem', means: 'eda.yours.problem.means', icon: 'flag' },
];

/** The reading of a run as a whole: look at this before for you to judge, before as expected. */
export function overallReading(results: readonly Pick<ResultView, 'reading'>[]): DataHubReading | null {
  if (results.length === 0) return null;
  if (results.some((result) => result.reading === 'look')) return 'look';
  if (results.some((result) => result.reading === 'judge')) return 'judge';
  return 'expected';
}

/**
 * Whether a result asks the User for a reading (DEC-UX-326): a field of Nulls per Key Field without any empty value, a
 * field of Disguised nulls where every row says something (DEC-ED-35), and a date of Date range that is up to date
 * (DEC-ED-34) have nothing to read; every other result has. The rule of the contracts, which Claude follows too.
 */
export { asksReading } from '@datahub/contracts/eda';

/** The kind of a field as the drawings show it in their header (DEC-UX-268): what identifies a row, a date, a link, a number, a text. */
export type FieldMark = 'grain' | 'date' | 'mapped' | 'number' | 'text';

export function markOf(field: Pick<EdaField, 'grain' | 'mapped' | 'dataType'>): FieldMark {
  if (field.grain) return 'grain';
  const kind = kindOf(field.dataType);
  if (kind === 'date') return 'date';
  if (field.mapped) return 'mapped';
  return kind === 'number' ? 'number' : 'text';
}

export const MARK_ICONS: Readonly<Record<FieldMark, IconName>> = {
  grain: 'fingerprint',
  date: 'calendar-blank',
  mapped: 'link',
  number: 'hash',
  text: 'tag',
};

/** How many of the needed EDA-Probes of an EDA-Step are complete. */
export function stepCount(view: Pick<EdaView, 'probes'>, step: EdaStep): { needed: number; complete: number } {
  const needed = view.probes.filter((probe) => PROBES[probe.key].step === step && probe.needed);
  return { needed: needed.length, complete: needed.filter((probe) => probe.complete).length };
}

/** The EDA-Probes of an EDA-Step in the order of the table of DEC-ED-11. */
export function probesOf(view: Pick<EdaView, 'probes'>, step: EdaStep): ProbeView[] {
  return view.probes.filter((probe) => PROBES[probe.key].step === step);
}

/**
 * Whether an EDA-Step has its tile Add probe (FR-ED-04): while it has an EDA-Probe offered that is not added yet,
 * coming ones too, as the list to add an EDA-Probe shows them (FR-ED-13).
 */
export function hasToAdd(view: Pick<EdaView, 'probes'>, step: EdaStep): boolean {
  return probesOf(view, step).some((probe) => !probe.added);
}

/**
 * Where an EDA-Probe stands in the list to add one (DEC-UX-328): added, with Data Hub's reading; added and set on part
 * of what it needs, or not run yet; open, to add it; or coming, while Data Hub does not run it (DEC-ED-27).
 */
export type ListState = 'added' | 'part' | 'open' | 'coming';

export function listStateOf(probe: Pick<ProbeView, 'added' | 'needed' | 'complete' | 'runs' | 'lastRun'>): ListState {
  if (probe.added) return probe.lastRun && (probe.complete || !probe.needed) ? 'added' : 'part';
  return probe.runs ? 'open' : 'coming';
}

/** What the list to add an EDA-Probe shows (DEC-UX-328): all, the needed ones, those Data Hub runs, or those added. */
export type ListFilter = 'all' | 'needed' | 'runs' | 'added';

export function fitsFilter(probe: Pick<ProbeView, 'added' | 'needed' | 'runs'>, filter: ListFilter): boolean {
  if (filter === 'needed') return probe.needed;
  if (filter === 'runs') return probe.runs;
  if (filter === 'added') return probe.added;
  return true;
}

/** How much its model type asks for an EDA-Probe, as the list says it: Needed, Suggested or On request (DEC-UX-328). */
export function askedOf(probe: Pick<ProbeView, 'needed' | 'level'>): Exclude<ProbeStanding, 'added'> {
  if (probe.needed) return 'needed';
  return probe.level === 'could' ? 'onRequest' : 'suggested';
}

/** Where an EDA-Probe stands on the table as a whole (DEC-UX-322): added, needed, suggested or on request. */
export type ProbeStanding = 'added' | 'needed' | 'suggested' | 'onRequest';

export function standingOf(probe: Pick<ProbeView, 'added' | 'needed' | 'level'>): ProbeStanding {
  if (probe.added) return 'added';
  if (probe.needed) return 'needed';
  return probe.level === 'could' ? 'onRequest' : 'suggested';
}

/** The fields a needed EDA-Probe must still be set on to be complete: what its last run left out (DEC-ED-21). */
export function stillMissing(probe: Pick<ProbeView, 'applies' | 'lastRun'>): string[] {
  const ran = probe.lastRun?.fields ?? [];
  return probe.applies.needs.filter((field) => !ran.includes(field));
}

/** The steps in their order, for whoever lists them. */
export { EDA_STEPS };

// ----------------------------------------------------------------------------------------------------------------
// The lists of Disguised nulls (DEC-ED-35)

/** The kinds of field Disguised nulls keeps a list for. */
export type DisguisedKind = 'text' | 'date' | 'number';

/**
 * The lists Disguised nulls looks for, as its parameters keep them per EDA (`{ lists }`), each part that is not there
 * or not of its shape as Data Hub proposes it.
 */
export function disguisedListsOf(params: Readonly<Record<string, unknown>> | undefined): DisguisedLists {
  const set = params?.lists;
  const lists = (typeof set === 'object' && set !== null ? set : {}) as Partial<Record<keyof DisguisedLists, unknown>>;
  const texts = (value: unknown, proposed: readonly string[]) => (Array.isArray(value) && value.every((one) => typeof one === 'string') ? [...(value as string[])] : [...proposed]);
  const numbers = Array.isArray(lists.number) && lists.number.every((one) => typeof one === 'number') ? [...(lists.number as number[])] : [...DISGUISED_DEFAULTS.number];
  return {
    text: texts(lists.text, DISGUISED_DEFAULTS.text),
    date: texts(lists.date, DISGUISED_DEFAULTS.date),
    number: numbers,
    ninesOnly: typeof lists.ninesOnly === 'boolean' ? lists.ninesOnly : DISGUISED_DEFAULTS.ninesOnly,
  };
}

/** A text as Disguised nulls compares it: whatever its capitals and the spaces around it. */
const textKey = (value: string) => value.trim().toLocaleLowerCase();

/** Whether two sets of lists look for the same values, in any order. */
export function sameLists(a: DisguisedLists, b: DisguisedLists): boolean {
  const same = <T>(one: readonly T[], other: readonly T[]) => one.length === other.length && one.every((value) => other.includes(value));
  return same(a.text.map(textKey), b.text.map(textKey)) && same(a.date, b.date) && same(a.number, b.number) && a.ninesOnly === b.ninesOnly;
}

/**
 * The lists with a value the User adds to one kind: a text trimmed, a day as YYYY-MM-DD, a number. Null when there is
 * nothing to add: nothing typed, not a day or a number, or already in the list; 'zero' for 0, which never says nothing.
 */
export function withValue(lists: DisguisedLists, kind: DisguisedKind, typed: string): DisguisedLists | 'zero' | null {
  const value = typed.trim();
  if (value === '') return null;
  if (kind === 'text') return lists.text.some((one) => textKey(one) === textKey(value)) ? null : { ...lists, text: [...lists.text, value] };
  if (kind === 'date') {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    return day && !lists.date.includes(value) ? { ...lists, date: [...lists.date, value] } : null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number === 0) return 'zero';
  return lists.number.includes(number) ? null : { ...lists, number: [...lists.number, number] };
}

/** The lists without a value of one kind. */
export function withoutValue(lists: DisguisedLists, kind: DisguisedKind, value: string | number): DisguisedLists {
  if (kind === 'text') return { ...lists, text: lists.text.filter((one) => one !== value) };
  if (kind === 'date') return { ...lists, date: lists.date.filter((one) => one !== value) };
  return { ...lists, number: lists.number.filter((one) => one !== value) };
}

// ----------------------------------------------------------------------------------------------------------------
// Numbers

/** About `count` round steps from 0 to above `max`: 1, 2 or 5 times a power of ten. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw) ?? 10 * power);
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)));
  if ((ticks.at(-1) ?? 0) < max) ticks.push(Number((ticks.length * step).toPrecision(12)));
  return ticks;
}

/** A share as people read it: one decimal under 10%, none above, and "< 0.1%" rather than 0 for a few. */
export function percent(part: number, whole: number, language: 'nl' | 'en'): string {
  if (whole <= 0 || part <= 0) return `${new Intl.NumberFormat(language === 'nl' ? 'nl-BE' : 'en-GB').format(0)}%`;
  const share = (part / whole) * 100;
  const format = (value: number, digits: number) => new Intl.NumberFormat(language === 'nl' ? 'nl-BE' : 'en-GB', { maximumFractionDigits: digits }).format(value);
  if (share < 0.1) return `< ${format(0.1, 1)}%`;
  return `${format(share, share < 10 ? 1 : 0)}%`;
}

/** A number as the language writes it, rounded to what can be read. */
export function number(value: number, language: 'nl' | 'en'): string {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return new Intl.NumberFormat(language === 'nl' ? 'nl-BE' : 'en-GB', { maximumFractionDigits: digits }).format(value);
}

/** The week of a day as ISO 8601 numbers it, with its year and its Monday: week 1 holds the first Thursday of the year. */
export function isoWeek(date: string): { week: number; year: number; monday: string } {
  const time = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const monday = time - ((new Date(time).getUTCDay() + 6) % 7) * 86_400_000;
  const thursday = monday + 3 * 86_400_000;
  const year = new Date(thursday).getUTCFullYear();
  return { week: Math.floor((thursday - Date.UTC(year, 0, 1)) / 86_400_000 / 7) + 1, year, monday: new Date(monday).toISOString().slice(0, 10) };
}

/** A day of a period, such as "1 Apr 2024". */
export function periodDay(start: string, language: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-BE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${start.slice(0, 10)}T00:00:00Z`));
}

// ----------------------------------------------------------------------------------------------------------------
// Volume over time, per block of days (DEC-ED-23)

/** The blocks of days the chart of Volume over time is drawn in, from a Monday, never a month. */
export const BLOCKS = [7, 14, 21, 28] as const;
export type BlockDays = (typeof BLOCKS)[number];

/** One block of the chart: when it starts, its rows and the sum of its measure, and whether it is empty or current. */
export interface VolumeBlock {
  start: string;
  rows: number;
  sum: number | null;
  /** A period in it has no row at all, between the first and the last. */
  empty: boolean;
  /** It holds the current period, not complete yet. */
  current: boolean;
}

const DAY = 86_400_000;
const dayOf = (start: string) => Date.parse(`${start.slice(0, 10)}T00:00:00Z`);

/**
 * The periods of a result added up per block of `days` days, from the Monday on or before the first period: a day is
 * counted in the block it falls in, a week in the block its Monday falls in. A block with a period without rows is
 * empty; the block of the current period is current.
 */
export function volumeBlocks(result: Pick<VolumeResult, 'periods' | 'empty' | 'current'>, days: BlockDays): VolumeBlock[] {
  const first = result.periods[0];
  if (!first) return [];
  const firstDay = dayOf(first.start);
  // Monday on or before the first period: getUTCDay is 0 on a Sunday.
  const anchor = firstDay - ((new Date(firstDay).getUTCDay() + 6) % 7) * DAY;
  const empty = new Set(result.empty.map((start) => start.slice(0, 10)));
  const current = result.current?.slice(0, 10) ?? null;
  const blocks = new Map<number, VolumeBlock>();
  for (const period of result.periods) {
    const index = Math.floor((dayOf(period.start) - anchor) / (days * DAY));
    const block = blocks.get(index) ?? { start: new Date(anchor + index * days * DAY).toISOString().slice(0, 10), rows: 0, sum: null, empty: false, current: false };
    block.rows += period.rows;
    if (period.sum !== null) block.sum = (block.sum ?? 0) + period.sum;
    const day = period.start.slice(0, 10);
    if (empty.has(day)) block.empty = true;
    if (day === current) block.current = true;
    blocks.set(index, block);
  }
  return [...blocks.entries()].sort(([a], [b]) => a - b).map(([, block]) => block);
}
