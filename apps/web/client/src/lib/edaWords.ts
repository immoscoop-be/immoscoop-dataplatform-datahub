import {
  headOf,
  roleDate,
  type CategoriesResult,
  type DateRangeResult,
  type DistributionResult,
  type EdaResource,
  type EdaView,
  type GrainResult,
  type NullsResult,
  type ProbeKey,
  type ProbeView,
  type ResultView,
  type VolumeResult,
} from '@datahub/contracts/eda';
import type { Language } from '@datahub/contracts/messages';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import { day } from '@datahub/ui/foundations/when.js';
import { isoWeek, number, percent, periodDay, stillMissing } from './eda.js';

/**
 * The sentences of the results of the EDA-Probes (FR-ED-07 to FR-ED-10): the conclusion on top of a result, the
 * sentence of a block per field, and the line of a card, each with the key numbers in it. A sentence is said in parts,
 * the first one the lead, drawn in bold; field names go in as names, never translated (NFR-LOC-03).
 */

/** A part of a sentence: its key, the words and numbers in it, and the names. */
export interface Said {
  key: string;
  values?: Readonly<Record<string, string | number>>;
  names?: Readonly<Record<string, string>>;
  /** Said in the colour of a state that calls for action, such as a Key Field a needed EDA-Probe still misses. */
  warn?: boolean;
}

/** The fields of a list in one name, such as `week_start, lead_source`. */
const listed = (fields: readonly string[]) => fields.join(', ');

/** The unit of a result as a word: a day, or a week from a Monday. */
const unitWord = (unit: VolumeResult['unit']) => t(unit === 'week' ? 'eda.volume.unit.week' : 'eda.volume.unit.day');

// The grain holds (FR-ED-07)

export function grainConclusion(result: GrainResult, grain: readonly string[]): Said[] {
  const parts: Said[] = [];
  if (result.onMoreThanOne === 0 && result.emptyGrain === 0) {
    parts.push({ key: 'eda.grain.holds', names: { grain: listed(grain) } });
    parts.push({ key: 'eda.grain.holds.rest', values: { rows: result.rows, values: result.values } });
    return parts;
  }
  if (result.onMoreThanOne > 0) {
    parts.push({ key: 'eda.grain.twice', values: { count: result.onMoreThanOne } });
    parts.push({ key: 'eda.grain.twice.rest', values: { covered: result.rowsCovered, rows: result.rows } });
  }
  if (result.emptyGrain > 0) parts.push({ key: 'eda.grain.empty', values: { count: result.emptyGrain } });
  return parts;
}

function grainCard(result: GrainResult, grain: readonly string[]): Said[] {
  if (result.onMoreThanOne === 0 && result.emptyGrain === 0) {
    return [
      { key: 'eda.card.grain.holds', names: { grain: listed(grain) } },
      { key: 'eda.card.grain.holds.rest', values: { rows: result.rows } },
    ];
  }
  return result.onMoreThanOne > 0
    ? [
        { key: 'eda.grain.twice', values: { count: result.onMoreThanOne } },
        { key: 'eda.card.grain.twice.rest', values: { covered: result.rowsCovered, rows: result.rows } },
      ]
    : [{ key: 'eda.grain.empty', values: { count: result.emptyGrain } }];
}

// Nulls per Key Field (FR-ED-08)

/** Why Data Hub reads a field as it does (DEC-ED-22): always filled, no role needs it, or its role needs it. */
export function nullsWhy(result: NullsResult, role: string | null): Said {
  if (result.empty === 0) return { key: 'eda.nulls.why.filled' };
  return role ? { key: 'eda.nulls.why.role', values: { role } } : { key: 'eda.nulls.why.free' };
}

export function nullsConclusion(results: readonly ResultView[], language: Language, roleOf: (result: ResultView) => string | null): Said[] {
  const data = (result: ResultView) => result.data as NullsResult;
  const parts: Said[] = [];
  const looks = results.filter((result) => result.reading === 'look' && data(result).empty > 0);
  const judged = results.filter((result) => result.reading !== 'look' && data(result).empty > 0);
  const filled = results.filter((result) => data(result).empty === 0).map((result) => result.subject);
  for (const result of looks) {
    parts.push({ key: 'eda.nulls.role', values: { count: data(result).empty, role: roleOf(result) ?? '' }, names: { field: result.subject } });
  }
  for (const result of judged) {
    parts.push({ key: 'eda.nulls.some', values: { share: percent(data(result).empty, data(result).rows, language) }, names: { field: result.subject } });
  }
  if (filled.length > 0 && parts.length === 0) {
    parts.push({ key: 'eda.nulls.allFilled' }, { key: 'eda.nulls.allFilled.rest', values: { count: filled.length, rows: data(results[0] as ResultView).rows } });
  } else if (filled.length > 0) {
    parts.push({ key: 'eda.nulls.alwaysFilled', values: { count: filled.length }, names: { fields: listed(filled) } });
  }
  return parts;
}

function nullsCard(probe: ProbeView, language: Language): Said[] {
  const results = probe.lastRun?.results ?? [];
  const empty = results.filter((result) => (result.data as NullsResult).empty > 0);
  const worst = [...empty].sort((a, b) => (b.data as NullsResult).empty / (b.data as NullsResult).rows - (a.data as NullsResult).empty / (a.data as NullsResult).rows)[0];
  const parts: Said[] = worst
    ? [
        { key: 'eda.card.nulls.some', values: { count: empty.length } },
        { key: 'eda.card.nulls.worst', values: { share: percent((worst.data as NullsResult).empty, (worst.data as NullsResult).rows, language) }, names: { field: worst.subject } },
      ]
    : [{ key: 'eda.card.nulls.none' }, { key: 'eda.card.nulls.none.rest', values: { count: results.length } }];
  return parts;
}

// Volume over time, with empty periods (FR-ED-09)

/** The average of the smallest block a result gives, of the sum where it has a measure, else of the rows. */
function averageOf(result: VolumeResult): { average: number; unit: string } | null {
  const smallest = [...result.units].sort((a, b) => a.days - b.days)[0];
  return smallest ? { average: smallest.average, unit: unitWord(result.unit) } : null;
}

export function volumeSentence(result: VolumeResult, language: Language): Said[] {
  const parts: Said[] = [];
  const average = averageOf(result);
  const first = result.periods[0]?.start;
  const last = result.periods.at(-1)?.start;
  if (result.empty.length > 0) {
    const day = periodDay(result.empty[0] as string, language);
    parts.push(result.empty.length === 1 ? { key: 'eda.volume.empty.one', values: { day } } : { key: 'eda.volume.empty.many', values: { count: result.empty.length, day } });
    if (average) parts.push({ key: 'eda.volume.empty.rest', values: { average: number(average.average, language), unit: average.unit } });
  } else {
    parts.push({ key: 'eda.volume.none' });
    if (first && last && average) {
      parts.push({ key: 'eda.volume.none.rest', values: { first: periodDay(first, language), last: periodDay(last, language), average: number(average.average, language), unit: average.unit } });
    }
  }
  const smallest = [...result.units].sort((a, b) => a.days - b.days)[0];
  if (smallest && smallest.lowest.value < smallest.average * 0.75) {
    parts.push({ key: 'eda.volume.dip', values: { lowest: number(smallest.lowest.value, language), day: periodDay(smallest.lowest.start, language) } });
  }
  return parts;
}

export function volumeConclusion(results: readonly ResultView[], language: Language): Said[] {
  const only = results[0];
  if (results.length === 1 && only) return volumeSentence(only.data as VolumeResult, language);
  const empties = results.reduce((sum, result) => sum + (result.data as VolumeResult).empty.length, 0);
  const dates = results.map((result) => result.subject);
  return empties > 0
    ? [{ key: 'eda.volume.summary.some', values: { count: empties } }, { key: 'eda.volume.summary.dates', names: { fields: listed(dates) } }]
    : [{ key: 'eda.volume.summary.none' }, { key: 'eda.volume.summary.dates', names: { fields: listed(dates) } }];
}

function volumeCard(probe: ProbeView, language: Language): Said[] {
  const results = (probe.lastRun?.results ?? []).map((result) => result.data as VolumeResult);
  const empties = results.reduce((sum, result) => sum + result.empty.length, 0);
  const first = results[0]?.periods[0]?.start;
  const last = results[0]?.periods.at(-1)?.start;
  const span: Said[] = first && last ? [{ key: 'eda.card.volume.span', values: { first: periodDay(first, language), last: periodDay(last, language) } }] : [];
  return [empties > 0 ? { key: 'eda.card.volume.some', values: { count: empties } } : { key: 'eda.card.volume.none' }, ...span];
}

// Distribution of numbers (FR-ED-10)

/** The shape of a distribution, from how far its mean lies from its median. */
export function shapeOf(result: Pick<DistributionResult, 'mean' | 'median'>): 'right' | 'left' | 'even' {
  const gap = result.mean - result.median;
  const scale = Math.max(Math.abs(result.median), Math.abs(result.mean), 1e-9);
  if (gap / scale > 0.15) return 'right';
  if (gap / scale < -0.15) return 'left';
  return 'even';
}

export function distributionSentence(result: DistributionResult, language: Language): Said[] {
  const shape = shapeOf(result);
  const base = Math.abs(result.median) > 1e-9 ? Math.abs(result.median) : 1;
  const apart = `${Math.round((Math.abs(result.mean - result.median) / base) * 100)}%`;
  const values = {
    median: number(result.median, language),
    mean: number(result.mean, language),
    apart,
    tail: percent(result.tail, result.rows, language),
    tailFrom: number(result.tailFrom, language),
    high: number(result.high, language),
    low: number(result.low, language),
  };
  return [
    { key: 'eda.distribution.half', values },
    { key: shape === 'right' ? 'eda.distribution.right' : shape === 'left' ? 'eda.distribution.left' : 'eda.distribution.even', values },
  ];
}

export function distributionConclusion(results: readonly ResultView[], language: Language): Said[] {
  const only = results[0];
  if (results.length !== 1 || !only) return [{ key: 'eda.distribution.several', values: { count: results.length } }, { key: 'eda.distribution.several.rest' }];
  const result = only.data as DistributionResult;
  const shape = shapeOf(result);
  const values = { median: number(result.median, language), mean: number(result.mean, language) };
  return shape === 'even'
    ? [{ key: 'eda.distribution.shape.even' }, { key: 'eda.distribution.shape.even.rest', values }]
    : [{ key: shape === 'right' ? 'eda.distribution.shape.right' : 'eda.distribution.shape.left' }, { key: 'eda.distribution.shape.rest', values }];
}

function distributionCard(probe: ProbeView, language: Language): Said[] {
  const results = probe.lastRun?.results ?? [];
  const only = results[0];
  if (results.length === 1 && only) {
    const result = only.data as DistributionResult;
    return [{ key: 'eda.card.distribution', values: { median: number(result.median, language), mean: number(result.mean, language) } }, { key: 'eda.card.distribution.of', names: { field: only.subject } }];
  }
  return [{ key: 'eda.distribution.several', values: { count: results.length } }];
}

// Distribution of categories (FR-ED-17)

/**
 * Where the weight of a text lies (DEC-ED-33), by the rule Claude names it by too (`headOf`): the fewest of its heaviest
 * values that together bring three quarters of the weight of its filled values, and their share of the whole field;
 * spread when its 10 heaviest do not, and then those 10 with their share.
 */
export function topOf(result: CategoriesResult): { count: number; share: number; spread: boolean } {
  const head = headOf(result);
  return head ? { ...head, spread: false } : { count: result.top.length, share: result.top.reduce((sum, one) => sum + one.share, 0), spread: true };
}

/** The sentences of where the weight lies, for a block of its own and with the name of its field before it. */
const LEADS = {
  none: { block: 'eda.categories.none', field: 'eda.categories.in.none' },
  one: { block: 'eda.categories.one', field: 'eda.categories.in.one' },
  two: { block: 'eda.categories.two', field: 'eda.categories.in.two' },
  few: { block: 'eda.categories.few', field: 'eda.categories.in.few' },
  spread: { block: 'eda.categories.spread', field: 'eda.categories.in.spread' },
} as const;

/**
 * Where the weight of a text lies, in one sentence: on one value, on two named, on a few of its values, or spread; the
 * values go in as names (NFR-LOC-03), as does the number it is weighed by.
 */
export function categoriesLead(result: CategoriesResult, language: Language, field?: string): Said {
  const top = topOf(result);
  const heaviest = result.top[0];
  const by = { by: result.weighedBy === null ? 'rows' : 'sum', share: percent(top.share, 1, language), count: top.count, values: result.values };
  const names = { weighed: result.weighedBy ?? '', ...(field === undefined ? {} : { field }) };
  const key = (lead: keyof typeof LEADS) => (field === undefined ? LEADS[lead].block : LEADS[lead].field);
  if (!heaviest || result.values === 0 || result.total - result.empty.weight <= 0) return { key: key('none'), names };
  if (top.spread) return { key: key('spread'), values: by, names };
  if (top.count === 1) return { key: key('one'), values: { ...by, share: percent(heaviest.share, 1, language) }, names: { ...names, value: heaviest.value } };
  const second = result.top[1];
  if (top.count === 2 && second) return { key: key('two'), values: by, names: { ...names, first: heaviest.value, second: second.value } };
  return { key: key('few'), values: by, names };
}

/** The sentence of a block of Distribution of categories: where the weight lies, the values that bring almost nothing, and the empty ones. */
export function categoriesSentence(result: CategoriesResult, language: Language): Said[] {
  const parts: Said[] = [categoriesLead(result, language)];
  if (result.values === 0) return parts;
  if (result.small > 0) parts.push({ key: 'eda.categories.small', values: { count: result.small } });
  if (result.empty.share > 0) {
    parts.push({ key: 'eda.categories.emptyShare', values: { share: percent(result.empty.share, 1, language), by: result.weighedBy === null ? 'rows' : 'sum' }, names: { weighed: result.weighedBy ?? '' } });
  }
  return parts;
}

/** The conclusion of Distribution of categories: the sentence of its one field, or where the weight lies in each, three at most. */
export function categoriesConclusion(results: readonly ResultView[], language: Language): Said[] {
  const only = results[0];
  if (results.length === 1 && only) return categoriesSentence(only.data as CategoriesResult, language);
  const said = results.slice(0, 3).map((result) => categoriesLead(result.data as CategoriesResult, language, result.subject));
  return results.length > 3 ? [...said, { key: 'eda.categories.more', values: { count: results.length - 3 } }] : said;
}

function categoriesCard(probe: ProbeView, language: Language): Said[] {
  const results = probe.lastRun?.results ?? [];
  const first = results[0];
  if (!first) return [];
  const lead = categoriesLead(first.data as CategoriesResult, language, first.subject);
  return results.length > 1 ? [lead, { key: 'eda.card.categories.more', values: { count: results.length - 1 } }] : [lead];
}

// Date range (FR-ED-18)

/** A day of a date as the app writes it, such as "16 Nov", or "4 Jan 2021" in another year. */
export const dayOfDate = (date: string, language: Language): string => day(`${date.slice(0, 10)}T12:00:00Z`, language);

/** A day of a date without its year, such as "16 Nov", beside the name of its week. */
export const dayOfMonth = (date: string, language: Language): string =>
  new Intl.DateTimeFormat(language === 'nl' ? 'nl-BE' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

/** A period by its name, as Claude names it: a week by its number in ISO 8601, "week 47 of 2026"; a day as the app writes it. */
export function periodName(unit: DateRangeResult['unit'], date: string, language: Language): string {
  if (unit === 'day') return dayOfDate(date, language);
  const { week, year } = isoWeek(date);
  return t('eda.dateRange.week', { week, year: String(year) });
}

/** A week by its number and its Monday, such as "week 44, 26 Oct"; a day as the app writes it. */
export function periodOn(unit: DateRangeResult['unit'], date: string, language: Language): string {
  return unit === 'day' ? dayOfDate(date, language) : t('eda.dateRange.weekOn', { week: isoWeek(date).week, day: dayOfMonth(isoWeek(date).monday, language) });
}

/** A number of periods in words, such as "3 weeks" or "1 day". */
export const periodsOf = (unit: DateRangeResult['unit'], count: number): string => t('eda.dateRange.periods', { unit, count });

/** The current period, and the one before it, in words: this week and last week, or today and yesterday. */
const NOW_WORDS = { week: 'eda.dateRange.now.week', day: 'eda.dateRange.now.day' } as const;
const BEFORE_WORDS = { week: 'eda.dateRange.before.week', day: 'eda.dateRange.before.day' } as const;
const AFTER_WORDS = { week: 'eda.dateRange.after.week', day: 'eda.dateRange.after.day' } as const;
export const nowWord = (unit: DateRangeResult['unit']): string => t(NOW_WORDS[unit]);

/** Whether a date is up to date (DEC-ED-34): its last value is in the current period or the one before. */
export function isUpToDate(result: Pick<DateRangeResult, 'last' | 'behind'>): boolean {
  return result.last !== null && result.behind <= 1;
}

/** Whether the last value of a date lies after the current period, a date in the future: left to Impossible values. */
export function isAfter(result: Pick<DateRangeResult, 'unit' | 'last' | 'current'>): boolean {
  if (result.last === null) return false;
  const last = result.unit === 'week' ? isoWeek(result.last).monday : result.last.slice(0, 10);
  return last > result.current.slice(0, 10);
}

/** Where the last value of a date that is up to date lies: this week or last week, today or yesterday, or after it. */
export function sinceWord(result: Pick<DateRangeResult, 'unit' | 'behind' | 'last' | 'current'>): string {
  if (isAfter(result)) return t(AFTER_WORDS[result.unit]);
  return t(result.behind === 0 ? NOW_WORDS[result.unit] : BEFORE_WORDS[result.unit]);
}

/** From the first to the last value of a date that is up to date, the lead of its sentence and of its card. */
function spanOf(result: DateRangeResult & { first: string; last: string }, language: Language): Said {
  return { key: isAfter(result) ? 'eda.dateRange.span.future' : 'eda.dateRange.span', values: { first: periodName(result.unit, result.first, language), last: periodName(result.unit, result.last, language), since: sinceWord(result) } };
}

/**
 * The sentence of a date of Date range (DEC-ED-34): from its first to its last value, up to date; or how far its last
 * lies behind; and how much lies before the Reliable Since of the Resource Card.
 */
export function dateRangeSentence(result: DateRangeResult, language: Language, field: string): Said[] {
  if (result.first === null || result.last === null) return [{ key: 'eda.dateRange.noValue', names: { field } }];
  const ranged = { ...result, first: result.first, last: result.last };
  const periods = periodsOf(result.unit, result.periods);
  const parts: Said[] = isUpToDate(result)
    ? [spanOf(ranged, language), { key: isAfter(result) ? 'eda.dateRange.span.after' : 'eda.dateRange.span.rest', values: { periods } }]
    : [
        { key: 'eda.dateRange.behind', values: { unit: result.unit, last: periodOn(result.unit, result.last, language), behind: periodsOf(result.unit, result.behind) } },
        { key: 'eda.dateRange.behind.rest', values: { first: periodName(result.unit, result.first, language), periods } },
      ];
  const before = result.beforeReliable ?? 0;
  if (result.reliableSince !== null && before > 0) {
    const values = { count: before, periods: periodsOf(result.unit, before), day: dayOfDate(result.reliableSince, language) };
    parts.push(before >= result.periods ? { key: 'eda.dateRange.reliable.all', values } : { key: 'eda.dateRange.reliable', values });
  }
  return parts;
}

/** The conclusion of Date range: the sentence of its one date, or which of its dates are not up to date. */
export function dateRangeConclusion(results: readonly ResultView[], language: Language): Said[] {
  const only = results[0];
  if (results.length === 1 && only) return dateRangeSentence(only.data as DateRangeResult, language, only.subject);
  const late = results.filter((result) => !isUpToDate(result.data as DateRangeResult)).map((result) => result.subject);
  return late.length > 0
    ? [{ key: 'eda.dateRange.summary.late', values: { count: late.length } }, { key: 'eda.dateRange.summary.dates', names: { fields: listed(late) } }]
    : [{ key: 'eda.dateRange.summary.upToDate' }, { key: 'eda.dateRange.summary.dates', names: { fields: listed(results.map((result) => result.subject)) } }];
}

function dateRangeCard(probe: ProbeView, language: Language): Said[] {
  const results = probe.lastRun?.results ?? [];
  // The date that is not up to date says the most; else the first.
  const shown = results.find((result) => !isUpToDate(result.data as DateRangeResult)) ?? results[0];
  if (!shown) return [];
  const result = shown.data as DateRangeResult;
  if (result.first === null || result.last === null || !isUpToDate(result)) return dateRangeSentence(result, language, shown.subject).slice(0, 1);
  return [spanOf({ ...result, first: result.first, last: result.last }, language), { key: 'eda.card.dateRange.rest', values: { periods: periodsOf(result.unit, result.periods) } }];
}

// A card (DEC-UX-322)

/** The result of the last run of an EDA-Probe on its card, in a sentence; and what a needed one still misses. */
export function cardSentence(probe: ProbeView, view: Pick<EdaView, 'resource'>, language: Language): Said[] {
  const results = probe.lastRun?.results ?? [];
  if (!probe.lastRun || results.length === 0) return [{ key: 'eda.card.notRun' }];
  const grain = view.resource.fields.filter((field) => field.grain).map((field) => field.name);
  const said = ((key: ProbeKey): Said[] => {
    switch (key) {
      case 'grainHolds':
        return grainCard((results.find((result) => result.subject === '') ?? results[0] as ResultView).data as GrainResult, grain);
      case 'nullsPerKeyField':
        return nullsCard(probe, language);
      case 'volumeOverTime':
        return volumeCard(probe, language);
      case 'distributionOfNumbers':
        return distributionCard(probe, language);
      case 'distributionOfCategories':
        return categoriesCard(probe, language);
      case 'dateRange':
        return dateRangeCard(probe, language);
      default:
        return [];
    }
  })(probe.key);
  const missing = probe.needed ? stillMissing(probe) : [];
  return missing.length > 0 ? [...said, { key: 'eda.card.missing', names: { fields: listed(missing) }, warn: true }] : said;
}

/** Whether a part of a sentence follows the one before without a space, as one that starts with a comma or a colon. */
export function joins(text: string): boolean {
  return /^[,;:.]/.test(text);
}

/** A sentence said in parts as plain words, such as in the steps of the Flow Box, the names in it as they are. */
export function saidText(parts: readonly Said[]): string {
  return parts.reduce((text, part, index) => {
    const said = t(part.key, { ...part.values, ...part.names });
    return index === 0 ? said : joins(said) ? `${text}${said}` : `${text} ${said}`;
  }, '');
}

// The question each EDA-Probe asks of a Resource (FR-ED-13)

/** The question of each EDA-Probe, and the one it asks where the fields it names are not there. */
const ASKS: Readonly<Record<ProbeKey, { key: string; without?: string }>> = {
  grainHolds: { key: 'eda.ask.grainHolds', without: 'eda.ask.grainHolds.without' },
  dateRange: { key: 'eda.ask.dateRange', without: 'eda.ask.dateRange.without' },
  volumeOverTime: { key: 'eda.ask.volumeOverTime.day' },
  settling: { key: 'eda.ask.settling.day' },
  howOftenThingsChange: { key: 'eda.ask.howOftenThingsChange', without: 'eda.ask.howOftenThingsChange.without' },
  nullsPerKeyField: { key: 'eda.ask.nullsPerKeyField' },
  disguisedNulls: { key: 'eda.ask.disguisedNulls' },
  whereGapsCluster: { key: 'eda.ask.whereGapsCluster' },
  valuesWithoutAMatch: { key: 'eda.ask.valuesWithoutAMatch', without: 'eda.ask.valuesWithoutAMatch.without' },
  distributionOfNumbers: { key: 'eda.ask.distributionOfNumbers' },
  distributionOfCategories: { key: 'eda.ask.distributionOfCategories' },
  sharePerSegment: { key: 'eda.ask.sharePerSegment' },
  outliers: { key: 'eda.ask.outliers' },
  mode: { key: 'eda.ask.mode' },
  spread: { key: 'eda.ask.spread' },
  impossibleValues: { key: 'eda.ask.impossibleValues' },
  storedAsText: { key: 'eda.ask.storedAsText' },
  variants: { key: 'eda.ask.variants' },
  relationshipsHold: { key: 'eda.ask.relationshipsHold', without: 'eda.ask.relationshipsHold.without' },
  datesInOrder: { key: 'eda.ask.datesInOrder', without: 'eda.ask.datesInOrder.without' },
  addsUpToSource: { key: 'eda.ask.addsUpToSource' },
  derivedValuesAgree: { key: 'eda.ask.derivedValuesAgree' },
  differencesBetweenSegments: { key: 'eda.ask.differencesBetweenSegments' },
  correlations: { key: 'eda.ask.correlations' },
  chancePerSegment: { key: 'eda.ask.chancePerSegment' },
};

/** Counted per week for the period of an aggregate, per day otherwise, as Volume over time counts (DEC-ED-23). */
const WEEKLY_ASKS: Partial<Record<ProbeKey, string>> = { volumeOverTime: 'eda.ask.volumeOverTime.week', settling: 'eda.ask.settling.week' };

/**
 * The question an EDA-Probe asks of this Resource, with the names of its fields filled in where it names them, such as
 * its grain or the date it counts by (FR-ED-13, TR-ED-09).
 */
export function askOf(probe: ProbeKey, resource: EdaResource): Said {
  const ask = ASKS[probe];
  const fields = resource.fields;
  const named = (names: Record<string, string> | null): Said => (names ? { key: ask.key, names } : { key: ask.without ?? ask.key });
  const date = roleDate(resource);
  switch (probe) {
    case 'grainHolds': {
      const grain = fields.filter((field) => field.grain).map((field) => field.name);
      return named(grain.length > 0 ? { grain: listed(grain) } : null);
    }
    case 'dateRange':
      return named(date ? { date } : null);
    case 'volumeOverTime':
    case 'settling': {
      const weekly = date !== null && fields.find((field) => field.name === date)?.role === 'period';
      return { key: weekly ? (WEEKLY_ASKS[probe] as string) : ask.key };
    }
    case 'howOftenThingsChange': {
      const updated = fields.find((field) => field.role === 'updatedAt');
      return named(updated ? { field: updated.name } : null);
    }
    case 'valuesWithoutAMatch':
    case 'relationshipsHold': {
      const mapped = fields.filter((field) => field.mapped).map((field) => field.name);
      return named(mapped.length > 0 ? { fields: listed(mapped) } : null);
    }
    case 'datesInOrder': {
      const created = fields.find((field) => field.role === 'createdAt');
      const updated = fields.find((field) => field.role === 'updatedAt');
      return named(created && updated ? { created: created.name, updated: updated.name } : null);
    }
    default:
      return { key: ask.key };
  }
}
