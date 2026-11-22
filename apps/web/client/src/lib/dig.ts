import { hasScope, type GapScope } from '@datahub/contracts/gaps';
import { SELECTION_LIMITS, type DigField, type DigPeriod, type DigResult, type DigValue, type EdaField, type RowCondition, type Selection } from '@datahub/contracts/eda';

/**
 * Dig into what a result found (FR-ED-20, DEC-ED-36, TR-ED-12): the selection of rows its address keeps, the conditions
 * taken off and added, and what the page reads from what eda found: the shares of a value in the selection and in the
 * rest, the value that sets the selection most apart, the shares before and after the break over time, and the Known
 * Gap it proposes. The words of it are in `edaWords.ts`.
 */

/** A field of a condition: a name, as eda checks it against the Resource (TR-ED-11). */
const isField = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= SELECTION_LIMITS.text;
/** A text in a condition, at most as long as eda takes (TR-ED-11). */
export const fitsText = (value: string): boolean => value.length <= SELECTION_LIMITS.text;
const isBound = (value: unknown): value is string | number => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value !== '' && fitsText(value));

/** A condition as an address gives it, of the shape eda takes, or null; whether its field and value fit the Resource is eda's to check. */
export function conditionFrom(value: unknown): RowCondition | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, field, value: equals, from, before } = value as Record<string, unknown>;
  if (!isField(field)) return null;
  if (kind === 'empty' || kind === 'saysNothing') return { kind, field };
  if (kind === 'equals') {
    if (typeof equals === 'boolean' || (typeof equals === 'number' && Number.isFinite(equals)) || (typeof equals === 'string' && fitsText(equals))) return { kind, field, value: equals };
    return null;
  }
  if (kind === 'range') {
    if ((from !== undefined && !isBound(from)) || (before !== undefined && !isBound(before)) || (from === undefined && before === undefined)) return null;
    return { kind, field, ...(from === undefined ? {} : { from }), ...(before === undefined ? {} : { before }) };
  }
  return null;
}

/**
 * The selection of Dig into from the JSON its address holds: at least one condition, as a dig needs one, and at most
 * as many as eda takes (TR-ED-11, TR-ED-12); null for anything else.
 */
export function selectionFrom(text: string | null): Selection | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const where = (parsed as { where?: unknown } | null)?.where;
  if (!Array.isArray(where) || where.length === 0 || where.length > SELECTION_LIMITS.conditions) return null;
  const conditions = where.map(conditionFrom);
  return conditions.every((condition) => condition !== null) ? { where: conditions as RowCondition[] } : null;
}

/** Whether two conditions select the same rows, by what they say. */
export function sameCondition(a: RowCondition, b: RowCondition): boolean {
  return JSON.stringify(conditionFrom(a)) === JSON.stringify(conditionFrom(b));
}

/** The selection with a condition added at its end; null when it holds that condition already, or as many as eda takes. */
export function withCondition(selection: Selection, condition: RowCondition): Selection | null {
  if (selection.where.some((one) => sameCondition(one, condition)) || selection.where.length >= SELECTION_LIMITS.conditions) return null;
  return { where: [...selection.where, condition] };
}

/** The selection without one of its conditions. */
export function withoutCondition(selection: Selection, index: number): Selection {
  return { where: selection.where.filter((_, at) => at !== index) };
}

/**
 * Where Dig into starts from a row of a result (FR-ED-20): the rows the result ran on, the whole table or a selection,
 * narrowed by the condition of the row; null when that cannot be dug into, as it holds that condition already, or a
 * text longer than eda takes.
 */
export function digFrom(ranOn: Selection | undefined, condition: RowCondition): Selection | null {
  if (condition.kind === 'equals' && typeof condition.value === 'string' && !fitsText(condition.value)) return null;
  return withCondition(ranOn ?? { where: [] }, condition);
}

// ----------------------------------------------------------------------------------------------------------------
// What a dig found

/** The rows of the table that are not selected. */
export const restOf = (rows: DigResult['rows']): number => Math.max(rows.total - rows.selected, 0);

/** The share of a value among the selected rows and among the rest, from 0 to 1. */
export function sharesOf(value: Pick<DigValue, 'selected' | 'rest'>, rows: DigResult['rows']): { selected: number; rest: number } {
  const rest = restOf(rows);
  return { selected: rows.selected > 0 ? value.selected / rows.selected : 0, rest: rest > 0 ? value.rest / rest : 0 };
}

/** Whether a value is more often among the selected rows than among the rest: more than once as often, or only there. */
export const isOver = (value: Pick<DigValue, 'ratio'>): boolean => value.ratio === null || value.ratio > 1;

/**
 * The value of a text that sets the selection most apart: of its values that are more often among the selected rows
 * and beyond chance, the one whose share there is the most above its share in the rest; null when none is.
 */
export function strongestOf(field: Extract<DigField, { kind: 'text' }>, rows: DigResult['rows']): DigValue | null {
  let best: DigValue | null = null;
  let most = 0;
  for (const value of field.values) {
    if (!value.real || !isOver(value)) continue;
    const shares = sharesOf(value, rows);
    const apart = shares.selected - shares.rest;
    if (apart > most) {
      best = value;
      most = apart;
    }
  }
  return best;
}

/** The value that sets the selection most apart over all its texts, with its field; null when none does. */
export function strongestIn(result: Pick<DigResult, 'fields' | 'rows'>): { field: string; value: DigValue } | null {
  let best: { field: string; value: DigValue } | null = null;
  let most = 0;
  for (const field of result.fields) {
    if (field.kind !== 'text') continue;
    const value = strongestOf(field, result.rows);
    if (!value) continue;
    const shares = sharesOf(value, result.rows);
    if (shares.selected - shares.rest > most) {
      best = { field: field.field, value };
      most = shares.selected - shares.rest;
    }
  }
  return best;
}

/** The periods before the break and from it on, each with their rows selected and all their rows. */
export function splitAt(periods: readonly DigPeriod[], breakAt: string): { before: { selected: number; total: number }; after: { selected: number; total: number } } {
  const day = breakAt.slice(0, 10);
  const before = { selected: 0, total: 0 };
  const after = { selected: 0, total: 0 };
  for (const period of periods) {
    const side = period.start.slice(0, 10) < day ? before : after;
    side.selected += period.selected;
    side.total += period.total;
  }
  return { before, after };
}

/** The share of a period that is selected, from 0 to 1. */
export const periodShare = (period: Pick<DigPeriod, 'selected' | 'total'>): number => (period.total > 0 ? period.selected / period.total : 0);

/** The day before a day, as YYYY-MM-DD. */
export function dayBefore(day: string): string {
  return new Date(Date.parse(`${day.slice(0, 10)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** A value as the rows of a Known Gap take it: a text of 1 to 200 characters, trimmed (FR-RC-24). */
const gapValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
};

/**
 * The scope of the Known Gap a dig proposes (FR-ED-20): until the day before the break when the selection was more of
 * the rows before it, from the break on when it was less, on the date the break is read on; the fields of its conditions that are empty or say nothing;
 * and the rows of the value that sets the selection most apart in its first text, when there is one. Null when it
 * narrows nothing down.
 */
export function gapScopeOf(selection: Selection, result: Pick<DigResult, 'overTime' | 'fields' | 'rows'>): GapScope | null {
  const scope: GapScope = {};
  const time = result.overTime;
  // The break is read on the date the role names, which need not be the Date Field of the Resource: the period says so.
  if (time?.breakAt && time.before === 'more') scope.period = { from: null, to: dayBefore(time.breakAt), dateField: time.field };
  else if (time?.breakAt && time.before === 'less') scope.period = { from: time.breakAt.slice(0, 10), to: null, dateField: time.field };
  const fields = [...new Set(selection.where.flatMap((condition) => (condition.kind === 'empty' || condition.kind === 'saysNothing' ? [condition.field] : [])))];
  if (fields.length > 0) scope.fields = fields;
  const first = result.fields.find((field): field is Extract<DigField, { kind: 'text' }> => field.kind === 'text');
  const value = first ? strongestOf(first, result.rows) : null;
  if (first && value) {
    const kept = value.value === null ? null : gapValue(value.value);
    if (value.value === null) scope.rows = { field: first.field, is: 'empty' };
    else if (kept) scope.rows = { field: first.field, is: 'oneOf', values: [kept] };
  }
  return hasScope(scope) ? scope : null;
}

/** The condition that keeps the rows of a value of a text: equal to it, or empty for no value. */
export const conditionOfValue = (field: string, value: string | null): RowCondition => (value === null ? { kind: 'empty', field } : { kind: 'equals', field, value });

/**
 * What Narrow it offers to add to a selection, without a value to type: before or from the break over time; each value
 * of an other Key Field the dig shows; and each Key Field empty, or saying nothing. Never a condition the selection
 * holds, and nothing once it holds as many as eda takes.
 */
export function narrowings(selection: Selection, result: Pick<DigResult, 'overTime' | 'fields'> | null, fields: readonly Pick<EdaField, 'name' | 'keyField'>[]): RowCondition[] {
  if (selection.where.length >= SELECTION_LIMITS.conditions) return [];
  const offered: RowCondition[] = [];
  const time = result?.overTime;
  if (time?.breakAt) {
    const day = time.breakAt.slice(0, 10);
    offered.push({ kind: 'range', field: time.field, before: day }, { kind: 'range', field: time.field, from: day });
  }
  for (const field of result?.fields ?? []) {
    if (field.kind !== 'text') continue;
    for (const value of field.values) {
      if (value.value === null || fitsText(value.value)) offered.push(conditionOfValue(field.field, value.value));
    }
  }
  for (const field of fields) {
    if (field.keyField) offered.push({ kind: 'empty', field: field.name }, { kind: 'saysNothing', field: field.name });
  }
  return offered.filter((condition, index) => !selection.where.some((one) => sameCondition(one, condition)) && offered.findIndex((one) => sameCondition(one, condition)) === index);
}
