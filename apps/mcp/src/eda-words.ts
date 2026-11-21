import type {
  CategoriesResult,
  DataHubReading,
  DateRangeResult,
  DistributionResult,
  EdaStatus,
  EdaStep,
  GrainResult,
  NullsResult,
  OwnerReading,
  ProbeKey,
  ProbeResult,
  ProbeView,
  ResultView,
  VolumeResult,
} from '@datahub/contracts/eda';
import type { TypeRole } from '@datahub/contracts/model-types';
import { asksReading, headOf } from '@datahub/contracts/eda';

/**
 * The EDA of a Resource in words (FR-ED-15, FR-ED-16): the result of each EDA-Probe Data Hub runs in a sentence, and its
 * result per field as a row of numbers, built once from the data of the result for Claude and for the MCP App, which
 * draws them as they come. The words are those of Data Hub on the card and the detail of an EDA-Probe
 * (`apps/web/client/src/lib/edaWords.ts` and its texts), in English as everything Claude and the MCP App read, with
 * the names of fields in backticks, never translated.
 */

/** The EDA-Steps by name (DEC-ED-11). */
export const STEP_NAMES: Readonly<Record<EdaStep, string>> = {
  basis: 'Basis',
  gaps: 'Gaps',
  weight: 'Weight',
  correctness: 'Correctness',
  relations: 'Relations between fields',
};

/** Data Hub's reading of a result (FR-ED-11). */
export const READINGS: Readonly<Record<DataHubReading, string>> = { expected: 'As expected', look: 'Look at this', judge: 'For you to judge' };

/** The reading of the User, given in the MCP App or in Data Hub, never by Claude (DEC-ED-29). */
export const YOURS: Readonly<Record<OwnerReading, string>> = { expected: 'Expected', known: 'Known', problem: 'A problem' };

/** Where an EDA stands (DEC-ED-20). */
export const STATUS_NAMES: Readonly<Record<EdaStatus, string>> = { inProgress: 'In progress', explored: 'Explored' };

/** A role of a model type, inside a sentence: "its role, when it happened, needs it on every row". */
const ROLES: Readonly<Record<TypeRole, string>> = {
  happenedAt: 'when it happened',
  about: 'what it is about',
  createdAt: 'created at',
  updatedAt: 'updated at',
  asOf: 'as of when',
  occurredAt: 'when it occurred',
  measure: 'measures',
  describes: 'what it describes',
  groupedBy: 'grouped by',
  period: 'period',
  addsUp: 'counts and sums',
  uniqueCount: 'counts and sums',
};

/** Why the best next step is the next one, as the page of the EDA says it. */
export function nextWhy(probe: ProbeKey, fields: readonly string[]): string {
  switch (probe) {
    case 'grainHolds':
      return `Start with what one row is: is there one row per ${listed(fields)}? Every other result leans on it.`;
    case 'nullsPerKeyField':
      return 'It covers Gaps for every Key Field at once: how much is missing in the fields that matter.';
    case 'volumeOverTime':
      return `It finds a break in the data: a period without any row, counted by ${listed(fields)}.`;
    case 'distributionOfNumbers':
      return 'It shows where the weight of the numbers among the Key Fields lies, and whether their average describes them.';
    case 'dateRange':
      return `It shows whether the table is still loaded: the first and the last ${listed(fields)}, set against today.`;
    case 'distributionOfCategories':
      return 'It shows where the weight of the texts among the Key Fields lies: which few values bring most of it.';
    default:
      return '';
  }
}

// ----------------------------------------------------------------------------------------------------------------
// Numbers, as Data Hub writes them in English

const format = (value: number, digits: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(value);

/** A number, rounded to what can be read. */
export function number(value: number): string {
  return format(value, Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
}

/** A share of a whole, such as `12%`, `0.1%` or `< 0.1%`. */
export function percent(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return '0%';
  const share = (part / whole) * 100;
  if (share < 0.1) return '< 0.1%';
  return `${format(share, share < 10 ? 1 : 0)}%`;
}

/** The day a period starts, such as `8 Sept 2025`. */
export function periodDay(start: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${start.slice(0, 10)}T00:00:00Z`));
}

/** How many, with the word in the singular or the plural. */
const many = (count: number, one: string, more: string) => `${number(count)} ${count === 1 ? one : more}`;
/** A field by its name, in backticks. */
export const code = (name: string): string => `\`${name}\``;
/** Fields, as `a`, `b` and `c`. */
export function listed(fields: readonly string[]): string {
  const names = fields.map(code);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ----------------------------------------------------------------------------------------------------------------
// The grain holds (FR-ED-07)

function grainSentence(result: GrainResult, grain: readonly string[]): string {
  if (result.onMoreThanOne === 0 && result.emptyGrain === 0) return `One row per ${listed(grain)}: none twice in ${many(result.rows, 'row', 'rows')}.`;
  const parts: string[] = [];
  if (result.onMoreThanOne > 0) {
    parts.push(
      `${many(result.onMoreThanOne, 'grain value is', 'grain values are')} on more than one row, covering ${number(result.rowsCovered)} of ${many(result.rows, 'row', 'rows')}. Counts and sums over them double up.`,
    );
  }
  if (result.emptyGrain > 0) parts.push(`${many(result.emptyGrain, 'row has', 'rows have')} an empty grain field.`);
  return parts.join(' ');
}

// ----------------------------------------------------------------------------------------------------------------
// Nulls per Key Field (FR-ED-08)

/** Why Data Hub reads a field as it does (DEC-ED-22): always filled, no role needs it, or its role needs it. */
function nullsWhy(result: NullsResult): string {
  if (result.empty === 0) return 'always filled';
  return result.role ? `its role, ${ROLES[result.role]}, needs it on every row` : 'no role needs it';
}

function nullsSentence(results: readonly ResultView[]): string {
  const data = (result: ResultView) => result.data as NullsResult;
  const looks = results.filter((result) => result.reading === 'look' && data(result).empty > 0);
  const judged = results.filter((result) => result.reading !== 'look' && data(result).empty > 0);
  const filled = results.filter((result) => data(result).empty === 0).map((result) => result.subject);
  const parts = [
    ...looks.map((result) => {
      const role = data(result).role;
      return `${code(result.subject)} is empty on ${many(data(result).empty, 'row', 'rows')}${role ? `, though its role, ${ROLES[role]}, needs it on every row` : ''}.`;
    }),
    ...judged.map((result) => `${code(result.subject)} is empty on ${percent(data(result).empty, data(result).rows)} of rows.`),
  ];
  const first = results[0];
  if (parts.length === 0 && first) return `Every field it is set on is always filled: ${many(filled.length, 'field', 'fields')}, ${many(data(first).rows, 'row', 'rows')}.`;
  if (filled.length > 0) parts.push(`${listed(filled)} ${filled.length === 1 ? 'is' : 'are'} always filled.`);
  return parts.join(' ');
}

// ----------------------------------------------------------------------------------------------------------------
// Volume over time, with empty periods (FR-ED-09)

/** The calmest block it gives, the smallest, of the sum where it has a measure, else of the rows. */
const smallestOf = (result: VolumeResult) => [...result.units].sort((a, b) => a.days - b.days)[0];

/** The volume of one date in a sentence: its empty periods, its average, and a dip worth a look. */
export function volumeSentence(result: VolumeResult): string {
  const smallest = smallestOf(result);
  const unit = result.unit;
  const first = result.periods[0]?.start;
  const last = result.periods.at(-1)?.start;
  const parts: string[] = [];
  if (result.empty.length > 0) {
    const day = periodDay(result.empty[0] as string);
    const lead = result.empty.length === 1 ? `The period from ${day} has no rows at all` : `${number(result.empty.length)} periods have no rows at all, the first from ${day}`;
    parts.push(smallest ? `${lead}, between periods of about ${number(smallest.average)} per ${unit}.` : `${lead}.`);
  } else if (first && last && smallest) {
    parts.push(`No period without rows from ${periodDay(first)} to ${periodDay(last)}: about ${number(smallest.average)} per ${unit} on average.`);
  } else {
    parts.push('No period without rows.');
  }
  if (smallest && smallest.lowest.value < smallest.average * 0.75) parts.push(`A dip, such as the ${number(smallest.lowest.value)} from ${periodDay(smallest.lowest.start)}, is for you to judge.`);
  return parts.join(' ');
}

function volumeSentences(results: readonly ResultView[]): string {
  const only = results[0];
  if (results.length === 1 && only) return volumeSentence(only.data as VolumeResult);
  const empties = results.reduce((sum, result) => sum + (result.data as VolumeResult).empty.length, 0);
  const dates = listed(results.map((result) => result.subject));
  return empties > 0 ? `${many(empties, 'period', 'periods')} without any row, by ${dates}.` : `No period without rows, by ${dates}.`;
}

// ----------------------------------------------------------------------------------------------------------------
// Distribution of numbers (FR-ED-10)

/** The shape of a distribution, from how far its mean lies from its median. */
export function shapeOf(result: Pick<DistributionResult, 'mean' | 'median'>): 'right' | 'left' | 'even' {
  const gap = result.mean - result.median;
  const scale = Math.max(Math.abs(result.median), Math.abs(result.mean), 1e-9);
  if (gap / scale > 0.15) return 'right';
  if (gap / scale < -0.15) return 'left';
  return 'even';
}

/** The spread of one field in a sentence, with its tail. */
function distributionDetail(result: DistributionResult): string {
  const base = Math.abs(result.median) > 1e-9 ? Math.abs(result.median) : 1;
  const apart = `${Math.round((Math.abs(result.mean - result.median) / base) * 100)}%`;
  const half = `Half of the rows have up to ${number(result.median)}`;
  switch (shapeOf(result)) {
    case 'right':
      return `${half}; the mean is ${number(result.mean)}, ${apart} higher, as a few rows bring much: ${percent(result.tail, result.rows)} of them are ${number(result.tailFrom)} or more, up to ${number(result.high)}.`;
    case 'left':
      return `${half}; the mean is ${number(result.mean)}, ${apart} lower, as a few rows bring little, down to ${number(result.low)}.`;
    default:
      return `${half}; the mean is ${number(result.mean)}, close to it: the values lie evenly around the middle.`;
  }
}

function distributionSentence(results: readonly ResultView[]): string {
  const only = results[0];
  if (results.length !== 1 || !only) {
    const each = results.map((result) => `${code(result.subject)} median ${number((result.data as DistributionResult).median)}, mean ${number((result.data as DistributionResult).mean)}`);
    return `${many(results.length, 'number', 'numbers')}, each with a shape of its own: ${each.join('; ')}.`;
  }
  const result = only.data as DistributionResult;
  const of = `the median of ${code(only.subject)} is ${number(result.median)}, the mean ${number(result.mean)}`;
  switch (shapeOf(result)) {
    case 'right':
      return `Most rows bring little, a few bring much: ${of}.`;
    case 'left':
      return `Most rows bring much, a few bring little: ${of}.`;
    default:
      return `The values lie around the middle: ${of}.`;
  }
}

// ----------------------------------------------------------------------------------------------------------------
// Distribution of categories (FR-ED-17)

/** What a field is weighed by, inside a sentence: the rows, or the sum of the number that adds up (DEC-ED-33). */
export const weighedWord = (result: Pick<CategoriesResult, 'weighedBy'>): string => (result.weighedBy ? `the sum of ${code(result.weighedBy)}` : 'the rows');

/** A share from 0 to 1, as Data Hub writes it. */
const share = (value: number) => percent(value, 1);

/** The share of the weight of its filled values its heaviest values bring together, to be where its weight lies. */
/** The share of the whole its 10 heaviest values bring together. */
const topShare = (result: CategoriesResult) => result.top.reduce((sum, value) => sum + value.share, 0);

/**
 * The weight of one field in a sentence, naming no value, so that it may reach Claude whatever the User's Permission
 * group says: how few values bring most of it, how many weigh less than 0.1% each, and how much is empty.
 */
export function categoriesSentence(field: string, result: CategoriesResult): string {
  if (result.values === 0) return `${code(field)} holds no value.`;
  const of = weighedWord(result);
  const head = headOf(result);
  const lead =
    result.values === 1
      ? `${code(field)} holds one value, which brings ${share(result.top[0]?.share ?? 0)} of ${of}`
      : head
        ? `${number(head.count)} of ${many(result.values, 'value', 'values')} of ${code(field)} ${head.count === 1 ? 'brings' : 'bring'} ${share(head.share)} of ${of}`
        : `The weight of ${code(field)} is spread: its ${number(result.top.length)} heaviest of ${many(result.values, 'value', 'values')} bring ${share(topShare(result))} of ${of}`;
  const parts = [lead];
  if (result.small > 0 && result.values > 1) parts.push(result.small === 1 ? '1 brings less than 0.1%' : `${number(result.small)} bring less than 0.1% each`);
  if (result.empty.weight > 0) parts.push(`${share(result.empty.share)} has no value`);
  return `${parts.join('; ')}.`;
}

function categoriesSentences(results: readonly ResultView[]): string {
  return results.map((result) => categoriesSentence(result.subject, result.data as CategoriesResult)).join(' ');
}

/** A bar of the card: a value, the others together, or the empty ones, with its share. */
export interface ShareBar {
  label: string;
  share: string;
  /** Its share, from 0 to 1, the width of its bar. */
  width: number;
  kind: 'value' | 'others' | 'empty';
}

/** The heaviest values of a field with their share, the others together and the empty ones apart (DEC-ED-33). */
function categoriesBars(result: CategoriesResult): ShareBar[] {
  return [
    ...result.top.map((one): ShareBar => ({ label: one.value, share: share(one.share), width: one.share, kind: 'value' })),
    ...(result.others.values > 0 ? [{ label: `${many(result.others.values, 'other value', 'other values')}`, share: share(result.others.share), width: result.others.share, kind: 'others' as const }] : []),
    ...(result.empty.weight > 0 ? [{ label: 'empty', share: share(result.empty.share), width: result.empty.share, kind: 'empty' as const }] : []),
  ];
}

// ----------------------------------------------------------------------------------------------------------------
// Date range (FR-ED-18)

const DAY = 86_400_000;
/** The Monday of the week a day is in. */
function mondayOf(day: string): string {
  const time = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
  return new Date(time - ((new Date(time).getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}

/** The week of a day as ISO 8601 numbers it, with its year: week 1 holds the first Thursday of the year. */
export function weekOf(day: string): { week: number; year: number } {
  const thursday = Date.parse(`${mondayOf(day)}T00:00:00Z`) + 3 * DAY;
  const year = new Date(thursday).getUTCFullYear();
  return { week: Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY / 7) + 1, year };
}

/** A period by its name: a week as `week 47 of 2026`, a day as `21 Nov 2026`. */
function periodName(unit: DateRangeResult['unit'], day: string): string {
  if (unit === 'day') return periodDay(day);
  const { week, year } = weekOf(day);
  return `week ${week} of ${year}`;
}

/** Periods of a unit, with the word in the singular or the plural. */
const periodsOf = (count: number, unit: DateRangeResult['unit']) => many(count, unit, `${unit}s`);

/** What lies before the Reliable Since of the Resource Card, in a sentence; empty without one as a day. */
function beforeReliable(result: DateRangeResult): string {
  if (result.reliableSince === null || result.beforeReliable === null) return '';
  const since = `its Reliable Since, ${periodDay(result.reliableSince)}`;
  if (result.beforeReliable === 0) return ` None lies before ${since}.`;
  if (result.beforeReliable >= result.periods) return ` ${result.periods === 1 ? 'It lies' : 'All of them lie'} before ${since}.`;
  return ` The first ${result.beforeReliable === 1 ? `${result.unit} lies` : `${number(result.beforeReliable)} ${result.unit}s lie`} before ${since}.`;
}

/** The range of one date in a sentence: up to date, or how far its last period is behind, and what lies before Reliable Since. */
export function dateRangeSentence(result: DateRangeResult): string {
  const { unit, first, last } = result;
  if (first === null || last === null) return `No row has a value, so it has no first or last ${unit}.`;
  const name = (day: string) => periodName(unit, day);
  const lastPeriod = unit === 'day' ? last : mondayOf(last);
  const now = unit === 'day' ? 'today' : 'this week';
  let lead: string;
  if (result.behind === 0 && lastPeriod === result.current) lead = `From ${name(first)} to ${now}, ${name(last)}: ${periodsOf(result.periods, unit)}, up to date.`;
  else if (result.behind === 0) lead = `From ${name(first)} to ${name(last)}, after ${now}: ${periodsOf(result.periods, unit)}. A date in the future is for Impossible values.`;
  else if (result.behind === 1) lead = `From ${name(first)} to ${unit === 'day' ? 'yesterday' : 'last week'}, ${name(last)}: ${periodsOf(result.periods, unit)}, up to date.`;
  else {
    const at = unit === 'day' ? periodDay(last) : `week ${weekOf(last).week}, ${periodDay(lastPeriod)}`;
    lead = `The last ${unit} is ${at}: ${periodsOf(result.behind, unit)} behind ${unit === 'day' ? 'today' : 'this one'}. From ${name(first)}, ${periodsOf(result.periods, unit)}.`;
  }
  return `${lead}${beforeReliable(result)}`;
}

function dateRangeSentences(results: readonly ResultView[]): string {
  const only = results[0];
  if (results.length === 1 && only) return dateRangeSentence(only.data as DateRangeResult);
  return results.map((result) => `${code(result.subject)}: ${dateRangeSentence(result.data as DateRangeResult)}`).join(' ');
}

// ----------------------------------------------------------------------------------------------------------------
// A run, in words and numbers

/** The reading of an EDA-Probe as a whole: look at this before for you to judge, before as expected. */
export function overallReading(results: readonly Pick<ResultView, 'reading'>[]): DataHubReading | null {
  if (results.length === 0) return null;
  if (results.some((result) => result.reading === 'look')) return 'look';
  if (results.some((result) => result.reading === 'judge')) return 'judge';
  return 'expected';
}

/** Whether a result asks the User for a reading: a field of Nulls per Key Field without any empty value has nothing to read. */
export { asksReading };

/** The result of the last run of an EDA-Probe in a sentence, with its key numbers: its conclusion. */
export function conclusionOf(probe: ProbeKey, results: readonly ResultView[], grain: readonly string[]): string {
  if (results.length === 0) return 'Not run yet.';
  switch (probe) {
    case 'grainHolds':
      return grainSentence(((results.find((result) => result.subject === '') ?? results[0]) as ResultView).data as GrainResult, grain);
    case 'nullsPerKeyField':
      return nullsSentence(results);
    case 'volumeOverTime':
      return volumeSentences(results);
    case 'distributionOfNumbers':
      return distributionSentence(results);
    case 'dateRange':
      return dateRangeSentences(results);
    case 'distributionOfCategories':
      return categoriesSentences(results);
    default:
      return '';
  }
}

/** The fields a needed EDA-Probe still misses: those it needs that its last run was not set on (DEC-ED-21). */
export function stillMissing(probe: Pick<ProbeView, 'applies' | 'lastRun'>): string[] {
  const ran = probe.lastRun?.fields ?? [];
  return probe.applies.needs.filter((field) => !ran.includes(field));
}

/** A result per subject as a row of the card: its numbers, Data Hub's reading with why, and the reading of the User. */
export interface ResultRow {
  /** '' for the table as a whole, else the field. */
  subject: string;
  label: string;
  cells: string[];
  /** The share of rows that is empty, for the bar of Nulls per Key Field. */
  empty: number | null;
  /** The heaviest values with their share, for Distribution of categories, only when values may reach Claude. */
  top: ShareBar[] | null;
  reading: DataHubReading;
  readingName: string;
  why: string | null;
  /** The result in a sentence, for Claude. */
  detail: string;
  asks: boolean;
  yours: { reading: OwnerReading; readingName: string; by: string; at: string } | null;
}

/**
 * The result of a run per subject: the head of its columns, after the subject, and a row per subject (DEC-UX-326). The
 * values of the data, such as the heaviest values of a text, are in it only when they may reach Claude (FR-CL-28).
 */
export function resultTable(probe: ProbeKey, results: readonly ResultView[], grain: readonly string[], values: boolean): { columns: string[]; bar: boolean; rows: ResultRow[] } {
  const row = (result: ResultView, cells: string[], why: string | null, detail: string, empty: number | null = null, top: ShareBar[] | null = null): ResultRow => ({
    subject: result.subject,
    label: result.subject === '' ? 'The table as a whole' : result.subject,
    cells,
    empty,
    top,
    reading: result.reading,
    readingName: READINGS[result.reading],
    why,
    detail,
    asks: asksReading(probe, result),
    yours: result.yours ? { reading: result.yours.reading, readingName: YOURS[result.yours.reading], by: result.yours.by.name, at: result.yours.at } : null,
  });
  switch (probe) {
    case 'grainHolds':
      return {
        columns: ['', 'Rows', 'Grain values', 'On more than one row', 'Rows they cover', 'An empty grain field'],
        bar: false,
        rows: results.map((result) => {
          const data = result.data as GrainResult;
          return row(result, [number(data.rows), number(data.values), number(data.onMoreThanOne), number(data.rowsCovered), number(data.emptyGrain)], null, grainSentence(data, grain));
        }),
      };
    case 'nullsPerKeyField':
      return {
        columns: ['Field', 'Filled and empty', 'Empty'],
        bar: true,
        rows: results.map((result) => {
          const data = result.data as NullsResult;
          const cell = data.empty === 0 ? '0' : `${number(data.empty)} · ${percent(data.empty, data.rows)}`;
          return row(result, [cell], nullsWhy(data), `${number(data.empty)} of ${many(data.rows, 'row', 'rows')} empty${data.empty > 0 ? ` (${percent(data.empty, data.rows)})` : ''}.`, data.rows > 0 ? data.empty / data.rows : 0);
        }),
      };
    case 'volumeOverTime':
      return {
        columns: ['Date', 'Periods', 'Without rows', 'About'],
        bar: false,
        rows: results.map((result) => {
          const data = result.data as VolumeResult;
          const first = data.periods[0]?.start;
          const last = data.periods.at(-1)?.start;
          const smallest = smallestOf(data);
          const without = data.empty.length === 0 ? '0' : `${number(data.empty.length)}, the first from ${periodDay(data.empty[0] as string)}`;
          const about = smallest ? `${number(smallest.average)} per ${data.unit}${data.measure ? `, the sum of ${data.measure}` : ', in rows'}` : '–';
          const current = data.current ? ` The current ${data.unit}, from ${periodDay(data.current)}, is not complete yet.` : '';
          const measure = data.measure ? ` It counts the sum of ${code(data.measure)}.` : ' It counts rows.';
          return row(result, [first && last ? `${periodDay(first)} – ${periodDay(last)}` : '–', without, about], data.empty.length > 0 ? 'a period without rows is almost always a break' : null, `${volumeSentence(data)}${measure}${current}`);
        }),
      };
    case 'distributionOfNumbers':
      return {
        columns: ['Field', 'Median', 'Mean', 'Middle half', 'Lowest to highest'],
        bar: false,
        rows: results.map((result) => {
          const data = result.data as DistributionResult;
          return row(result, [number(data.median), number(data.mean), `${number(data.p25)} – ${number(data.p75)}`, `${number(data.low)} – ${number(data.high)}`], 'a shape is neither right nor wrong', distributionDetail(data));
        }),
      };
    case 'dateRange':
      return {
        columns: ['Date', 'First', 'Last', 'Behind', 'Before Reliable Since'],
        bar: false,
        rows: results.map((result) => {
          const data = result.data as DateRangeResult;
          const name = (day: string | null) => (day === null ? '–' : periodName(data.unit, day));
          const behind = data.last === null ? '–' : data.behind === 0 ? 'none' : periodsOf(data.behind, data.unit);
          const before = data.reliableSince === null || data.beforeReliable === null ? '–' : `${periodsOf(data.beforeReliable, data.unit)}, before ${periodDay(data.reliableSince)}`;
          const why = data.last === null ? 'a date without any value has no range' : data.behind > 1 ? 'up to date is the current period or the one before' : null;
          return row(result, [name(data.first), name(data.last), behind, before], why, dateRangeSentence(data));
        }),
      };
    case 'distributionOfCategories':
      return {
        columns: ['Field', 'Values', 'Where the weight lies', 'Below 0.1% each', 'Empty'],
        bar: false,
        rows: results.map((result) => {
          const data = result.data as CategoriesResult;
          const head = headOf(data);
          const lies = data.values === 0 ? '–' : head ? `${many(head.count, 'value', 'values')} · ${share(head.share)}` : `spread: ${many(data.top.length, 'value', 'values')} · ${share(topShare(data))}`;
          // The values are values of the data: they reach Claude, in words or in the card, only when results may (FR-CL-28).
          const named = values && data.top.length > 0 ? ` The heaviest: ${data.top.map((one) => `${JSON.stringify(one.value)} ${share(one.share)}`).join(', ')}.` : '';
          const others = data.others.values > 0 ? ` The other ${many(data.others.values, 'value brings', 'values bring')} ${share(data.others.share)}.` : '';
          const detail = `${categoriesSentence(result.subject, data)}${named}${others} Weighed by ${weighedWord(data)}: ${number(data.total)} in all.`;
          return row(result, [number(data.values), lies, number(data.small), share(data.empty.share)], 'a spread of values is neither right nor wrong', detail, null, values ? categoriesBars(data) : null);
        }),
      };
    default:
      return { columns: ['Field'], bar: false, rows: [] };
  }
}

/**
 * The data of a result as Claude and the MCP App read it: without the long lists a chart draws, such as every period
 * of Volume over time or the bins of a distribution, which stay in Data Hub. The examples of The grain holds and the
 * heaviest values of Distribution of categories are values of the data, so they reach Claude only when results do
 * (FR-CL-28); without them, the weight and share of each of those values stay.
 */
export function compactData(probe: ProbeKey, data: ProbeResult, values: boolean): Record<string, unknown> {
  switch (probe) {
    case 'grainHolds': {
      const { examples, ...rest } = data as GrainResult;
      return values ? { ...rest, examples } : rest;
    }
    case 'volumeOverTime': {
      const { periods, ...rest } = data as VolumeResult;
      return { ...rest, first: periods[0]?.start ?? null, last: periods.at(-1)?.start ?? null, periods: periods.length };
    }
    case 'distributionOfNumbers': {
      const { bins: _bins, start: _start, ...rest } = data as DistributionResult;
      return rest;
    }
    case 'distributionOfCategories': {
      const { top, ...rest } = data as CategoriesResult;
      return { ...rest, top: values ? top : top.map(({ weight, share: part }) => ({ weight, share: part })) };
    }
    default:
      return { ...data };
  }
}
