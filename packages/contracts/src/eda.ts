/**
 * The EDA of a Resource (domain 15): one catalogue of its EDA-Probes, what each applies to on a Resource, when a
 * needed one is complete, what the EDA covers, and the shapes of the answers of the service eda. One definition for
 * eda and the web app (TR-ED-02).
 *
 * The EDA-Probes and their level per model type are the table of DEC-ED-11 and DEC-ED-12, with the three of DEC-ED-14;
 * the rows of the table are a fact of the EDA, counted by The grain holds and Nulls per Key Field (DEC-ED-32).
 * An EDA-Probe is set on its fields and gives a result per field, or per pair or group, or for the table as a whole
 * (DEC-ED-17); a needed one is complete once it has run, set on every field it applies to (DEC-ED-21). Data Hub runs
 * four of them in the first build (DEC-ED-26); the others are listed as coming and, needed, still count (OP-ED-09).
 */
import { kindOf, type ModelType, type TypeRole } from './modelTypes.js';

/** The EDA-Steps, in their order (DEC-ED-11). */
export const EDA_STEPS = ['basis', 'gaps', 'weight', 'correctness', 'relations'] as const;
export type EdaStep = (typeof EDA_STEPS)[number];

/** Where on a table an EDA-Probe looks (DEC-ED-16): its rows, one column, two columns together, another Resource. */
export type EdaPlace = 'rows' | 'column' | 'columns' | 'resource';

/** How much a model type needs an EDA-Probe (DEC-ED-12): Must, Should or Could. Not offered is left out. */
export type ProbeLevel = 'must' | 'should' | 'could';

/** The EDA-Probes, in the order of the table of DEC-ED-11. */
export const PROBE_KEYS = [
  'grainHolds',
  'dateRange',
  'volumeOverTime',
  'settling',
  'howOftenThingsChange',
  'nullsPerKeyField',
  'disguisedNulls',
  'whereGapsCluster',
  'valuesWithoutAMatch',
  'distributionOfNumbers',
  'distributionOfCategories',
  'sharePerSegment',
  'outliers',
  'mode',
  'spread',
  'impossibleValues',
  'storedAsText',
  'variants',
  'relationshipsHold',
  'datesInOrder',
  'addsUpToSource',
  'derivedValuesAgree',
  'differencesBetweenSegments',
  'correlations',
  'chancePerSegment',
] as const;
export type ProbeKey = (typeof PROBE_KEYS)[number];

/** What an EDA-Probe can be set on, so that what it applies to on a Resource follows. */
type Target =
  | 'table' // the table as a whole, its rows
  | 'grain' // the fields of the grain, together
  | 'roleDate' // the date its role names
  | 'updatedAt' // when a state was last updated
  | 'any' // any field
  | 'numbers'
  | 'texts'
  | 'dates'
  | 'unmapped' // a field not mapped to an Entity
  | 'mapped' // a field mapped to an Entity
  | 'createdUpdated' // when a state was created and last updated, together
  | 'pairs'; // two fields or more, together

export interface ProbeSpec {
  key: ProbeKey;
  /** Its name, in English: the web app translates it. */
  name: string;
  step: EdaStep;
  place: EdaPlace;
  target: Target;
  /** Its level per model type; a model type it is not offered for is left out. */
  levels: Partial<Record<ModelType, ProbeLevel>>;
  /** Whether Data Hub runs it yet (DEC-ED-26). */
  runs: boolean;
}

const M = 'must' as const;
const S = 'should' as const;
const C = 'could' as const;
/** The six model types in the order of the columns of the table: event, state, fact, dimension, aggregate, other. */
function levels(...row: (ProbeLevel | null)[]): Partial<Record<ModelType, ProbeLevel>> {
  const types: ModelType[] = ['event', 'state', 'fact', 'dimension', 'aggregate', 'other'];
  return Object.fromEntries(types.flatMap((type, index) => (row[index] ? [[type, row[index]]] : []))) as Partial<Record<ModelType, ProbeLevel>>;
}

/** The EDA-Probes (DEC-ED-11, DEC-ED-12, DEC-ED-14, DEC-ED-32), in order. */
export const PROBES: Readonly<Record<ProbeKey, ProbeSpec>> = {
  grainHolds: { key: 'grainHolds', name: 'The grain holds', step: 'basis', place: 'rows', target: 'grain', levels: levels(M, M, M, M, M, M), runs: true },
  dateRange: { key: 'dateRange', name: 'Date range', step: 'basis', place: 'rows', target: 'roleDate', levels: levels(M, M, M, null, M, null), runs: true },
  volumeOverTime: { key: 'volumeOverTime', name: 'Volume over time, with empty periods', step: 'basis', place: 'rows', target: 'roleDate', levels: levels(M, C, M, null, M, null), runs: true },
  settling: { key: 'settling', name: 'Settling between EDA-Reruns', step: 'basis', place: 'rows', target: 'roleDate', levels: levels(S, null, S, null, C, null), runs: false },
  howOftenThingsChange: { key: 'howOftenThingsChange', name: 'How often things change', step: 'basis', place: 'rows', target: 'updatedAt', levels: levels(null, C, null, null, null, null), runs: false },
  nullsPerKeyField: { key: 'nullsPerKeyField', name: 'Nulls per Key Field', step: 'gaps', place: 'column', target: 'any', levels: levels(M, M, M, M, M, M), runs: true },
  disguisedNulls: { key: 'disguisedNulls', name: 'Disguised nulls', step: 'gaps', place: 'column', target: 'any', levels: levels(M, M, M, M, M, M), runs: false },
  whereGapsCluster: { key: 'whereGapsCluster', name: 'Where gaps cluster', step: 'gaps', place: 'column', target: 'any', levels: levels(S, S, S, C, S, C), runs: false },
  valuesWithoutAMatch: { key: 'valuesWithoutAMatch', name: 'Values without a match', step: 'gaps', place: 'resource', target: 'mapped', levels: levels(M, M, M, M, M, M), runs: false },
  distributionOfNumbers: { key: 'distributionOfNumbers', name: 'Distribution of numbers', step: 'weight', place: 'column', target: 'numbers', levels: levels(M, M, M, M, M, M), runs: true },
  distributionOfCategories: { key: 'distributionOfCategories', name: 'Distribution of categories', step: 'weight', place: 'column', target: 'texts', levels: levels(M, M, M, M, M, M), runs: true },
  sharePerSegment: { key: 'sharePerSegment', name: 'Share per segment', step: 'weight', place: 'column', target: 'texts', levels: levels(S, S, S, S, S, C), runs: false },
  outliers: { key: 'outliers', name: 'Outliers', step: 'weight', place: 'column', target: 'numbers', levels: levels(S, S, S, C, S, C), runs: false },
  mode: { key: 'mode', name: 'The mode', step: 'weight', place: 'column', target: 'any', levels: levels(S, S, S, S, S, S), runs: false },
  spread: { key: 'spread', name: 'Spread', step: 'weight', place: 'column', target: 'numbers', levels: levels(S, S, M, S, M, S), runs: false },
  impossibleValues: { key: 'impossibleValues', name: 'Impossible values', step: 'correctness', place: 'column', target: 'unmapped', levels: levels(M, M, M, M, M, M), runs: false },
  storedAsText: { key: 'storedAsText', name: 'Numbers or dates stored as text', step: 'correctness', place: 'column', target: 'texts', levels: levels(S, S, S, S, S, S), runs: false },
  variants: { key: 'variants', name: 'Variants of one category', step: 'correctness', place: 'column', target: 'texts', levels: levels(S, S, S, M, C, S), runs: false },
  relationshipsHold: { key: 'relationshipsHold', name: 'Relationships hold', step: 'correctness', place: 'resource', target: 'mapped', levels: levels(M, M, M, S, C, S), runs: false },
  datesInOrder: { key: 'datesInOrder', name: 'Dates in order', step: 'correctness', place: 'columns', target: 'createdUpdated', levels: levels(null, M, null, null, null, null), runs: false },
  addsUpToSource: { key: 'addsUpToSource', name: 'The aggregate adds up to its source', step: 'correctness', place: 'resource', target: 'table', levels: levels(null, null, null, null, S, null), runs: false },
  derivedValuesAgree: { key: 'derivedValuesAgree', name: 'Derived values agree', step: 'relations', place: 'columns', target: 'pairs', levels: levels(C, C, C, C, C, C), runs: false },
  differencesBetweenSegments: { key: 'differencesBetweenSegments', name: 'Differences between segments', step: 'relations', place: 'columns', target: 'pairs', levels: levels(S, C, S, C, S, C), runs: false },
  correlations: { key: 'correlations', name: 'Correlations between Key Fields', step: 'relations', place: 'columns', target: 'pairs', levels: levels(C, C, C, C, C, C), runs: false },
  chancePerSegment: { key: 'chancePerSegment', name: 'Chance, per segment', step: 'relations', place: 'columns', target: 'pairs', levels: levels(C, C, C, C, C, C), runs: false },
};

/** The EDA-Probes Data Hub runs now (DEC-ED-26). */
export const RUNNABLE_PROBES: readonly ProbeKey[] = PROBE_KEYS.filter((key) => PROBES[key].runs);

/** The level of an EDA-Probe for a model type, or null where it is not offered. */
export function levelOf(probe: ProbeKey, modelType: ModelType | null): ProbeLevel | null {
  return modelType ? (PROBES[probe].levels[modelType] ?? null) : null;
}

/** The EDA-Probes offered for a model type, in order. */
export function probesFor(modelType: ModelType | null): ProbeKey[] {
  return PROBE_KEYS.filter((key) => levelOf(key, modelType) !== null);
}

// ----------------------------------------------------------------------------------------------------------------
// A Resource as the EDA sees it

/** A field of a Resource, in the order of its Resource Card (DEC-UX-323). */
export interface EdaField {
  name: string;
  /** Its type in BigQuery, such as `TIMESTAMP`. */
  dataType: string | null;
  /** Whether it is a Key Field (DEC-SR-19). */
  keyField: boolean;
  /** The role it holds for the model type of its Resource (FR-CO-44), if any. */
  role: TypeRole | null;
  /** Whether it is one of the fields of the grain. */
  grain: boolean;
  /** Whether it is mapped to an Entity and identifier (FR-RC-08). */
  mapped: boolean;
}

/** A Resource as the EDA works on it. */
export interface EdaResource {
  id: string;
  displayName: string;
  modelType: ModelType | null;
  level: number;
  fields: EdaField[];
}

/** The roles that name the date of the volume of a model type, in the order they are taken (DEC-ED-23). */
const ROLE_DATES: readonly TypeRole[] = ['happenedAt', 'occurredAt', 'period', 'asOf', 'createdAt'];

/** Why an EDA-Probe cannot run on a Resource. */
export type ProbeBlock = 'noGrain' | 'noRoleDate' | 'nothing';

/** What an EDA-Probe applies to on a Resource. */
export interface AppliesTo {
  /** On the table as a whole, its rows. */
  table: boolean;
  /** The fields it is set on by default, in the order of the Resource Card. */
  fields: string[];
  /** The fields a needed one must be set on to be complete: the Key Fields among them, or all for the grain or a date. */
  needs: string[];
  /** Why it cannot run here, if it cannot. */
  block: ProbeBlock | null;
}

function fits(field: EdaField, target: Target): boolean {
  const kind = kindOf(field.dataType);
  switch (target) {
    case 'any':
      return true;
    case 'numbers':
      return kind === 'number';
    case 'texts':
      return kind === 'text';
    case 'dates':
      return kind === 'date';
    case 'unmapped':
      return !field.mapped;
    case 'mapped':
      return field.mapped;
    default:
      return false;
  }
}

/** What an EDA-Probe applies to on a Resource (TR-ED-02). */
export function appliesTo(probe: ProbeKey, resource: EdaResource): AppliesTo {
  const target = PROBES[probe].target;
  const names = (fields: EdaField[]) => fields.map((field) => field.name);
  switch (target) {
    case 'table':
      return { table: true, fields: [], needs: [], block: null };
    case 'grain': {
      const grain = names(resource.fields.filter((field) => field.grain));
      return { table: true, fields: grain, needs: grain, block: grain.length ? null : 'noGrain' };
    }
    case 'roleDate': {
      const date = roleDate(resource);
      return { table: true, fields: date ? [date] : [], needs: date ? [date] : [], block: date ? null : 'noRoleDate' };
    }
    case 'updatedAt': {
      const updated = resource.fields.find((field) => field.role === 'updatedAt');
      return { table: true, fields: updated ? [updated.name] : [], needs: updated ? [updated.name] : [], block: updated ? null : 'noRoleDate' };
    }
    case 'createdUpdated': {
      const pair = resource.fields.filter((field) => field.role === 'createdAt' || field.role === 'updatedAt');
      return { table: false, fields: names(pair), needs: pair.length === 2 ? names(pair) : [], block: pair.length === 2 ? null : 'nothing' };
    }
    case 'pairs':
      return { table: false, fields: [], needs: [], block: null };
    default: {
      const fitting = resource.fields.filter((field) => fits(field, target));
      const keys = fitting.filter((field) => field.keyField);
      return { table: false, fields: names(keys), needs: names(keys), block: fitting.length ? null : 'nothing' };
    }
  }
}

/** The date its role names, which Volume over time is set on (DEC-ED-23). */
export function roleDate(resource: EdaResource): string | null {
  for (const role of ROLE_DATES) {
    const field = resource.fields.find((candidate) => candidate.role === role && kindOf(candidate.dataType) === 'date');
    if (field) return field.name;
  }
  return null;
}

/** Whether an EDA-Probe on a field covers it: the column probes per field, and the grain and a date for their fields. */
function covers(probe: ProbeKey, field: EdaField): boolean {
  const target = PROBES[probe].target;
  if (target === 'pairs') return true;
  if (target === 'table') return false;
  if (target === 'grain') return field.grain;
  if (target === 'roleDate' || target === 'updatedAt' || target === 'createdUpdated') return kindOf(field.dataType) === 'date';
  return fits(field, target);
}

// ----------------------------------------------------------------------------------------------------------------
// What an EDA holds, and what it covers

/** Data Hub's reading of a result (FR-ED-11): as expected, look at this, or for you to judge. */
export type DataHubReading = 'expected' | 'look' | 'judge';
/** The reading of who works on the EDA (FR-ED-11). */
export type OwnerReading = 'expected' | 'known' | 'problem';
/** Where an EDA stands (DEC-ED-20). */
export type EdaStatus = 'inProgress' | 'explored';

/** The fields an EDA-Probe ran on, in its last run, for what it covers. */
export interface RunCover {
  probe: ProbeKey;
  fields: string[];
}

/** Whether a needed EDA-Probe is complete: a run of it is set on every field it needs (DEC-ED-17, DEC-ED-21). */
export function isComplete(probe: ProbeKey, resource: EdaResource, runs: readonly RunCover[]): boolean {
  const needs = appliesTo(probe, resource).needs;
  return runs.some((run) => run.probe === probe && needs.every((field) => run.fields.includes(field)));
}

/** Whether an EDA-Probe counts as needed on a Resource: Must for its model type, and something to apply to. */
export function isNeeded(probe: ProbeKey, resource: EdaResource): boolean {
  if (levelOf(probe, resource.modelType) !== 'must') return false;
  const applies = appliesTo(probe, resource);
  // An EDA-Probe on mapped fields counts only once a Key Field is mapped: a relationship matters when its field is a
  // Key Field (DEC-ED-19, DEC-ED-31).
  if (PROBES[probe].target === 'mapped') return applies.needs.length > 0;
  // A column EDA-Probe with no field it could ever be set on does not apply here; one waiting for the grain or a date
  // still counts, as the Data Team can record it.
  return !(applies.block === 'nothing' && !applies.table);
}

/** How a field stands in an EDA-Step: covered, needed and not covered, not needed, or no EDA-Probe of the step fits. */
export type CoverState = 'covered' | 'needed' | 'free' | 'none';

/** The EDA-Steps a field is shown in, per field (DEC-UX-322): the four on a column. */
export const FIELD_STEPS = ['gaps', 'weight', 'correctness', 'relations'] as const satisfies readonly EdaStep[];
export type FieldStep = (typeof FIELD_STEPS)[number];

export interface FieldCover {
  name: string;
  keyField: boolean;
  steps: Record<FieldStep, CoverState>;
}

/** What an EDA covers in its four places (DEC-ED-16). */
export interface Places {
  /** The needed EDA-Probes on the rows, and how many are complete. */
  rows: { needed: number; complete: number };
  /** The Key Fields, how many are covered in every EDA-Step they need, and how many in some. */
  keyFields: { total: number; complete: number; started: number };
  /** The needed EDA-Probes on two columns together. */
  columns: { needed: number; complete: number };
  /** The needed EDA-Probes on another Resource. */
  resources: { needed: number; complete: number };
}

/** What an EDA covers per field and in its places, from the fields its EDA-Probes last ran on. */
export function coverage(resource: EdaResource, runs: readonly RunCover[]): { fields: FieldCover[]; places: Places } {
  const offered = probesFor(resource.modelType);
  const fields = resource.fields.map((field): FieldCover => {
    const steps = Object.fromEntries(
      FIELD_STEPS.map((step) => {
        const fitting = offered.filter((probe) => PROBES[probe].step === step && covers(probe, field));
        if (!fitting.length) return [step, 'none'];
        if (runs.some((run) => fitting.includes(run.probe) && run.fields.includes(field.name))) return [step, 'covered'];
        const needed = fitting.some((probe) => isNeeded(probe, resource) && appliesTo(probe, resource).needs.includes(field.name));
        return [step, needed ? 'needed' : 'free'];
      }),
    ) as Record<FieldStep, CoverState>;
    return { name: field.name, keyField: field.keyField, steps };
  });
  const place = (where: EdaPlace) => {
    const needed = offered.filter((probe) => PROBES[probe].place === where && isNeeded(probe, resource));
    return { needed: needed.length, complete: needed.filter((probe) => isComplete(probe, resource, runs)).length };
  };
  const keys = fields.filter((field) => field.keyField);
  const keyFields = {
    total: keys.length,
    complete: keys.filter((field) => FIELD_STEPS.every((step) => field.steps[step] !== 'needed')).length,
    started: keys.filter((field) => FIELD_STEPS.some((step) => field.steps[step] === 'covered')).length,
  };
  return { fields, places: { rows: place('rows'), keyFields, columns: place('columns'), resources: place('resource') } };
}

/**
 * The best next step (DEC-ED-16): the needed EDA-Probe Data Hub can run that covers the most of what is missing,
 * in the order of the table when they cover as much; null when none is left.
 */
export function bestNext(resource: EdaResource, runs: readonly RunCover[]): ProbeKey | null {
  const open = probesFor(resource.modelType).filter(
    (probe) => PROBES[probe].runs && isNeeded(probe, resource) && !isComplete(probe, resource, runs) && appliesTo(probe, resource).block === null,
  );
  let best: ProbeKey | null = null;
  let most = -1;
  for (const probe of open) {
    const needs = appliesTo(probe, resource).needs;
    const missing = needs.length ? needs.filter((field) => !runs.some((run) => run.probe === probe && run.fields.includes(field))).length : 1;
    if (missing > most) {
      best = probe;
      most = missing;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------------------------------------------
// The results of the EDA-Probes Data Hub runs (TR-ED-03)

/** The grain holds, for the table as a whole. */
export interface GrainResult {
  rows: number;
  /** The grain values. */
  values: number;
  /** The grain values on more than one row, and the rows they cover. */
  onMoreThanOne: number;
  rowsCovered: number;
  /** The rows with an empty grain field. */
  emptyGrain: number;
  /** How many grain values are on 1, 2, 3, and 4 rows or more. */
  buckets: [number, number, number, number];
  /** Up to 5 grain values on more than one row, most rows first. */
  examples: { values: Record<string, string | null>; rows: number }[];
}

/** Nulls per Key Field, per field. */
export interface NullsResult {
  rows: number;
  empty: number;
  /** The role the field holds, which makes an empty value look at this (DEC-ED-22). */
  role: TypeRole | null;
}

/** How calm the volume is in one unit (DEC-ED-23). */
export interface VolumeUnit {
  days: 1 | 7 | 14 | 21 | 28;
  average: number;
  sd: number;
  p25: number;
  median: number;
  p75: number;
  lowest: { value: number; start: string };
  highest: { value: number; start: string };
}

/** Volume over time, per date it is set on. */
export interface VolumeResult {
  /** The unit of its date: a day, or a week from a Monday for the period of an aggregate. */
  unit: 'day' | 'week';
  /** The field that adds up, whose sum is the volume, if any. */
  measure: string | null;
  /** Every period from the first to the last, in order, with its rows and the sum of its measure. */
  periods: { start: string; rows: number; sum: number | null }[];
  /** The periods without any row between the first and the last. */
  empty: string[];
  /** The current period, not complete yet, if the data reaches it. */
  current: string | null;
  /** How calm it is per unit, of the sum where it has a measure, else of the rows. */
  units: VolumeUnit[];
}

/** Distribution of numbers, per field. */
export interface DistributionResult {
  rows: number;
  low: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  high: number;
  mean: number;
  /** The width of a bin, and where the tail starts. */
  width: number;
  tailFrom: number;
  /** The rows per bin from 0 (or the lowest, when below 0) to the tail, and the rows of the tail. */
  start: number;
  bins: number[];
  tail: number;
}

/** One value of a text field and what it weighs: the sum of the number it is weighed by, or its rows (DEC-ED-33). */
export interface CategoryWeight {
  value: string;
  weight: number;
  /** Its share of the weight of the whole field, empty values included, from 0 to 1. */
  share: number;
}

/** Distribution of categories, per field (DEC-ED-33). */
export interface CategoriesResult {
  /** The number that adds up it is weighed by, or null for rows. */
  weighedBy: string | null;
  /** The weight of the whole field: the sum of that number, or the rows. */
  total: number;
  /** How many different values the field holds, empty not counted. */
  values: number;
  /** The 10 values that weigh most, the heaviest first. */
  top: CategoryWeight[];
  /** The other values together. */
  others: { values: number; weight: number; share: number };
  /** The rows where the field is empty. */
  empty: { weight: number; share: number };
  /** How many values weigh less than 0.1% each. */
  small: number;
}

/** Date range, per date it is set on (DEC-ED-34). */
export interface DateRangeResult {
  /** The unit of its date: a day, or a week from a Monday for the period of an aggregate. */
  unit: 'day' | 'week';
  /** Its first and last value, as a day; null when it holds no value. */
  first: string | null;
  last: string | null;
  /** The periods from the first to the last, both counted. */
  periods: number;
  /** The current period, today's in the time zone of Immoscoop. */
  current: string;
  /** How many periods the last is behind the current one: 0 when it is the current one. */
  behind: number;
  /** The Reliable Since of the Resource Card, as a day, if it gives one, and how many periods lie before it. */
  reliableSince: string | null;
  beforeReliable: number | null;
}

/**
 * The values Disguised nulls looks for, per kind of field, kept per EDA as the parameters of the EDA-Probe (DEC-ED-35):
 * Data Hub proposes them, the User takes out a value that is real in this table and adds one it uses. A text also says
 * nothing when it is empty or only spaces, always; a number never when it is zero.
 */
export interface DisguisedLists {
  /** Compared whatever their capitals and the spaces around them. */
  text: string[];
  /** Days, as YYYY-MM-DD. */
  date: string[];
  number: number[];
  /** Whether a number of nines only, such as 999 or 99999, says nothing. */
  ninesOnly: boolean;
}

/** What Data Hub proposes (DEC-ED-35). */
export const DISGUISED_DEFAULTS: DisguisedLists = {
  text: ['n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd'],
  date: ['1900-01-01', '1970-01-01', '0001-01-01', '9999-12-31'],
  number: [-1],
  ninesOnly: true,
};

/** Disguised nulls, per field (DEC-ED-35). */
export interface DisguisedResult {
  rows: number;
  /** The rows that say nothing: no value at all, or a value of the lists. */
  saysNothing: number;
  /** Of those, the rows with no value at all. */
  nulls: number;
  /** The values of the lists found, with their rows, the most first; the empty text as '' and only spaces as ' '. */
  found: { value: string; rows: number }[];
  /** The role the field holds, which makes a value that says nothing look at this (DEC-ED-22). */
  role: TypeRole | null;
}

export type ProbeResult = GrainResult | NullsResult | VolumeResult | DistributionResult | CategoriesResult | DateRangeResult | DisguisedResult;

/**
 * A condition on the rows of a table (OP-ED-12): the field says nothing (no value, or one of the lists of Disguised
 * nulls of its EDA), equals a value, or lies in a range, from inclusive and before exclusive; days as YYYY-MM-DD.
 */
export type RowCondition =
  | { kind: 'saysNothing'; field: string }
  | { kind: 'equals'; field: string; value: string | number | boolean }
  | { kind: 'range'; field: string; from?: string | number; before?: string | number };

/**
 * The rows an EDA-Probe runs on (OP-ED-12): the whole table when it holds no condition, else the rows where every
 * condition holds. Every EDA-Probe runs on a selection, so that what a result found can be looked into further.
 */
export interface Selection {
  where: RowCondition[];
}

/** The whole table. */
export const WHOLE_TABLE: Selection = { where: [] };

/**
 * Whether a result asks for the reading of who works on the EDA, the same for the web app and Claude (FR-ED-11): not
 * when there is nothing to read, a field without empty values or a date that is up to date.
 */
export function asksReading(probe: ProbeKey, result: { reading: DataHubReading }): boolean {
  return !((probe === 'nullsPerKeyField' || probe === 'dateRange') && result.reading === 'expected');
}

/** The share of the weight with a value that the head of a field brings (DEC-ED-33): three quarters. */
export const CATEGORIES_HEAD = 0.75;

/**
 * Where the weight of a field lies, the same for the web app and Claude (DEC-ED-33): the fewest of its heaviest values
 * that together bring three quarters of the weight of its filled values, and their share of the whole, as in "4 of 54
 * lead sources bring 79% of the leads"; null when its 10 heaviest do not, or it holds no value.
 */
export function headOf(result: CategoriesResult): { count: number; share: number } | null {
  const filled = result.total - result.empty.weight;
  if (filled <= 0) return null;
  let weight = 0;
  for (const [index, value] of result.top.entries()) {
    weight += value.weight;
    if (weight >= CATEGORIES_HEAD * filled) return { count: index + 1, share: weight / result.total };
  }
  return null;
}

// ----------------------------------------------------------------------------------------------------------------
// The answers of eda (TR-ED-01)

export interface Who {
  id: string;
  name: string;
}

/** The result of a run for one subject: the table as a whole (an empty subject) or a field. */
export interface ResultView {
  subject: string;
  data: ProbeResult;
  reading: DataHubReading;
  /** The reading of who works on the EDA, if given. */
  yours: { reading: OwnerReading; by: Who; at: string } | null;
}

export interface RunView {
  id: string;
  ranAt: string;
  ranBy: Who;
  bytes: number;
  fields: string[];
  params: Record<string, unknown>;
  /** The rows it ran on; absent for the whole table, which the runs that make an EDA-Probe complete run on (OP-ED-12). */
  selection?: Selection;
  results: ResultView[];
}

/** An EDA-Probe as the tab Steps shows it. */
export interface ProbeView {
  key: ProbeKey;
  level: ProbeLevel;
  /** Whether Data Hub runs it yet. */
  runs: boolean;
  needed: boolean;
  added: boolean;
  complete: boolean;
  applies: AppliesTo;
  /** The fields and parameters it is set on, once added. */
  fields: string[];
  params: Record<string, unknown>;
  lastRun: RunView | null;
}

/** The EDA of a Resource (GET /resources/{id}/eda). */
export interface EdaView {
  resource: EdaResource & { collection: { id: string; name: string } | null };
  status: EdaStatus;
  startedBy: Who;
  startedAt: string;
  exploredAt: string | null;
  needed: { total: number; complete: number };
  probes: ProbeView[];
  coverage: { fields: FieldCover[]; places: Places };
  next: ProbeKey | null;
}

/** An EDA in the panel (GET /edas). */
export interface EdaListItem {
  resource: { id: string; displayName: string; collection: { id: string; name: string } | null };
  status: EdaStatus;
  needed: { total: number; complete: number };
}

/** What a run of an EDA-Probe answers (POST /resources/{id}/eda/probes/{probe}/runs). */
export type RunAnswer =
  | { state: 'ran'; eda: EdaView }
  /** It reads more than runs freely: the User approves it, then it runs with `approve`. */
  | { state: 'approve'; bytes: number }
  /** It reads more than the User may approve, or cannot run: why. */
  | { state: 'refused'; bytes: number | null; reason: string };

/** What eda asks query to run (POST /resources/{id}/eda/runs on query, TR-ED-04). */
export interface ProbeRunRequest {
  probe: ProbeKey;
  sql: string;
  approve?: boolean;
}

/** What query answers eda. */
export type ProbeRunAnswer =
  | { state: 'ran'; rows: Record<string, unknown>[]; bytes: number; runId: string }
  | { state: 'approve'; bytes: number }
  | { state: 'refused'; bytes: number | null; reason: string };

/** The rows of the table, a fact of the EDA (DEC-ED-32): how many, which EDA-Probe counted them, and when it ran. */
export interface EdaRows {
  rows: number;
  probe: 'grainHolds' | 'nullsPerKeyField';
  at: string;
}

/**
 * The rows of the table, from the last run that counted them (DEC-ED-32): The grain holds counts them for the table as
 * a whole, Nulls per Key Field with each field; whichever ran last. Null while neither has run.
 */
export function rowsOf(view: Pick<EdaView, 'probes'>): EdaRows | null {
  let found: EdaRows | null = null;
  for (const one of view.probes) {
    if ((one.key !== 'grainHolds' && one.key !== 'nullsPerKeyField') || !one.lastRun) continue;
    const result = one.key === 'grainHolds' ? one.lastRun.results.find((candidate) => candidate.subject === '') : one.lastRun.results[0];
    const rows = (result?.data as GrainResult | NullsResult | undefined)?.rows;
    if (typeof rows !== 'number') continue;
    if (!found || Date.parse(one.lastRun.ranAt) > Date.parse(found.at)) found = { rows, probe: one.key, at: one.lastRun.ranAt };
  }
  return found;
}

/** The needed EDA-Probes of a Resource and how many are complete. */
export function neededOf(resource: EdaResource, runs: readonly RunCover[]): { total: number; complete: number } {
  const needed = probesFor(resource.modelType).filter((probe) => isNeeded(probe, resource));
  return { total: needed.length, complete: needed.filter((probe) => isComplete(probe, resource, runs)).length };
}
