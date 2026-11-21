import type { DistributionResult, EdaView, GrainResult, NullsResult, ProbeKey, ProbeView, ResultView, VolumeResult } from '@datahub/contracts/eda';
import type { Language } from '@datahub/contracts/messages';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import { number, percent, periodDay, stillMissing } from './eda.js';

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
