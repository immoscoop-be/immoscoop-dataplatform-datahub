import { DISGUISED_DEFAULTS, type DisguisedLists, type RowCondition, type Selection } from '@datahub/contracts/eda';
import type { EdaSource } from '../catalogue.js';
import { conditionKind, isDay, isText, MAX_TEXT } from './sql.js';

/**
 * The selection of rows an EDA-Probe runs on (OP-ED-12), as a request gives it: the whole table, or the rows where every
 * condition holds. Its conditions come from the User, so each is checked against the Resource before any SQL is
 * written: a field of the Resource, and values of the kind of that field. `conditionOf` in sql.ts refuses whatever
 * gets past this all the same.
 */

/** A selection holds at most this many conditions. */
export const MAX_CONDITIONS = 10;

const KINDS = ['saysNothing', 'equals', 'range'] as const;

/** Whether a selection is the whole table: it holds no condition. */
export const isWholeTable = (selection: Selection): boolean => selection.where.length === 0;

/** One condition, by its shape alone; a string says what does not fit. */
function conditionIn(value: unknown, place: number): RowCondition | string {
  const which = `Condition ${place + 1}`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${which} is a JSON object.`;
  const { kind, field, ...rest } = value as Record<string, unknown>;
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) return `${which} is saysNothing, equals or range, as its kind.`;
  if (typeof field !== 'string' || field === '') return `${which} names its field.`;
  const allowed = kind === 'equals' ? ['value'] : kind === 'range' ? ['from', 'before'] : [];
  const unknown = Object.keys(rest).find((key) => !allowed.includes(key));
  if (unknown !== undefined) return `${which}, ${kind}, has no ${unknown}.`;
  if (kind === 'saysNothing') return { kind, field };
  if (kind === 'equals') {
    const { value: equal } = rest;
    if (typeof equal !== 'string' && typeof equal !== 'number' && typeof equal !== 'boolean') return `${which}, equals, has a value: a text, a number, true or false.`;
    return { kind, field, value: equal };
  }
  const { from, before } = rest;
  const bound = (one: unknown): one is string | number | undefined => one === undefined || typeof one === 'string' || typeof one === 'number';
  if (!bound(from) || !bound(before) || (from === undefined && before === undefined)) return `${which}, range, has from, before or both: a number or a day, YYYY-MM-DD.`;
  return { kind: 'range', field, ...(from === undefined ? {} : { from }), ...(before === undefined ? {} : { before }) };
}

/**
 * A selection in a request, by its shape alone: `{ where: [...] }`, at most 10 conditions of the three kinds, each with
 * only its own keys; a string says what does not fit (400).
 */
export function parseSelection(value: unknown): Selection | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'selection is { where: [conditions] }.';
  const { where, ...rest } = value as Record<string, unknown>;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) return `A selection has no ${unknown}.`;
  if (!Array.isArray(where)) return 'selection is { where: [conditions] }.';
  if (where.length > MAX_CONDITIONS) return `A selection holds at most ${MAX_CONDITIONS} conditions.`;
  const conditions: RowCondition[] = [];
  for (const [place, one] of where.entries()) {
    const condition = conditionIn(one, place);
    if (typeof condition === 'string') return condition;
    conditions.push(condition);
  }
  return { where: conditions };
}

/** Whether a value fits a field of this kind. */
function fits(kind: 'text' | 'number' | 'date' | 'boolean', value: unknown): boolean {
  switch (kind) {
    case 'text':
      return isText(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'date':
      return isDay(value);
    case 'boolean':
      return typeof value === 'boolean';
  }
}

const EXPECTED = {
  text: `a text of at most ${MAX_TEXT} characters`,
  number: 'a number',
  date: 'a day, YYYY-MM-DD',
  boolean: 'true or false',
} as const;

/**
 * A selection against the Resource (OP-ED-12): every field one of its fields; a value of equals of the kind of its
 * field, a text, a number, a day or true or false; a range on a number or a date, its bounds of that kind and from
 * before before. A string says what does not fit (400); null when it fits.
 */
export function checkSelection(selection: Selection, source: EdaSource): string | null {
  for (const condition of selection.where) {
    const field = source.resource.fields.find((candidate) => candidate.name === condition.field);
    if (!field) return `${condition.field} is no field of this Resource.`;
    const kind = conditionKind(field.dataType);
    if (condition.kind === 'saysNothing') continue;
    if (kind === 'other') return `${field.name} is a ${field.dataType ?? 'field without a type'}: a selection on it is only saysNothing.`;
    if (condition.kind === 'equals') {
      if (!fits(kind, condition.value)) return `${field.name} equals ${EXPECTED[kind]}.`;
      continue;
    }
    if (kind !== 'number' && kind !== 'date') return `A range is on a number or a date; ${field.name} is a ${kind}.`;
    for (const bound of [condition.from, condition.before]) {
      if (bound !== undefined && !fits(kind, bound)) return `The range of ${field.name} is of ${kind === 'number' ? 'numbers' : 'days, YYYY-MM-DD'}.`;
    }
    // Days as YYYY-MM-DD sort as they follow each other.
    const { from, before } = condition;
    if (from !== undefined && before !== undefined && !(kind === 'number' ? Number(from) < Number(before) : String(from) < String(before))) {
      return `In the range of ${field.name}, from comes before before.`;
    }
  }
  return null;
}

/**
 * The values that say nothing in an EDA (DEC-ED-35): the lists in the parameters of its Disguised nulls (`{ lists }`)
 * once it is added with them, each list that fits in place of Data Hub's proposal; else that proposal.
 */
export function disguisedOf(params: Record<string, unknown> | undefined): DisguisedLists {
  const set = params?.lists;
  const { text, date, number, ninesOnly } = typeof set === 'object' && set !== null && !Array.isArray(set) ? (set as Record<string, unknown>) : {};
  const listOf = <T>(value: unknown, fit: (one: unknown) => one is T): T[] | null => (Array.isArray(value) && value.length <= 1000 && value.every(fit) ? value : null);
  return {
    text: listOf(text, isText) ?? DISGUISED_DEFAULTS.text,
    date: listOf(date, isDay) ?? DISGUISED_DEFAULTS.date,
    number: listOf(number, (one): one is number => typeof one === 'number' && Number.isFinite(one)) ?? DISGUISED_DEFAULTS.number,
    ninesOnly: typeof ninesOnly === 'boolean' ? ninesOnly : DISGUISED_DEFAULTS.ninesOnly,
  };
}
