import { DATE_FUNCTIONS, type DateFunction, dateFunctionOf, dayOf, isDay } from '@datahub/contracts/dates';
import type { Language } from '@datahub/contracts/messages';
import type { IconName } from '@datahub/ui/foundations/icons.js';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import type { Parameter, ParameterKind } from './query.js';

/** The standard list of kinds, each with its icon, its type in BigQuery, its name and what its field asks (DEC-UX-71). */
export const KINDS: readonly { kind: ParameterKind; icon: IconName; type: string; label: string; hint: string | null }[] = [
  { kind: 'date', icon: 'calendar-blank', type: 'DATE', label: 'param.kind.date', hint: 'param.hint.date' },
  { kind: 'period', icon: 'calendar-dots', type: '2 × DATE', label: 'param.kind.period', hint: null },
  { kind: 'number', icon: 'hash', type: 'INT64', label: 'param.kind.number', hint: 'param.hint.number' },
  { kind: 'decimal', icon: 'percent', type: 'NUMERIC', label: 'param.kind.decimal', hint: 'param.hint.decimal' },
  { kind: 'text', icon: 'text-aa', type: 'STRING', label: 'param.kind.text', hint: 'param.hint.text' },
  { kind: 'choice', icon: 'list-bullets', type: 'STRING', label: 'param.kind.choice', hint: null },
  { kind: 'several', icon: 'list-checks', type: 'ARRAY<STRING>', label: 'param.kind.several', hint: null },
  { kind: 'yesno', icon: 'toggle-left', type: 'BOOL', label: 'param.kind.yesno', hint: null },
];

export const kindOf = (kind: ParameterKind) => KINDS.find((candidate) => candidate.kind === kind) ?? (KINDS[0] as (typeof KINDS)[number]);

/** The @names a Parameter gives the SQL: its own, or for a Period `_from` and `_to`. */
export const namesOf = (parameter: Parameter): string[] => (parameter.kind === 'period' ? [`${parameter.name}_from`, `${parameter.name}_to`] : [parameter.name]);

/** An SQL name: a letter or _, then letters, digits or _. */
export const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Whether a text is a day of the calendar, as `2026-10-25`. */
export { isDay };

/** Whether a value is an SQL function rather than a value of its kind, as query tells them apart (DEC-LE-14). */
export function isFunction(kind: ParameterKind, value: string): boolean {
  switch (kind) {
    case 'date':
    case 'period':
      return !isDay(value);
    case 'number':
      return !/^-?\d{1,19}$/.test(value);
    case 'decimal':
      return !/^-?\d{1,29}(?:\.\d{1,9})?$/.test(value);
    case 'text':
      return /^[A-Za-z_][A-Za-z0-9_.]*\(.*\)$/s.test(value);
    default:
      return false;
  }
}

/**
 * The functions the field suggests, each with what it gives on a day (DEC-LE-14, DEC-UX-118): Data Hub works
 * these out itself; any other function is worked out at every run. The list is shared with the MCP App of a Lens.
 */
const LABELS: Record<DateFunction['key'], string> = {
  today: 'param.fn.today',
  minus3: 'param.fn.minus3',
  week: 'param.fn.week',
  month: 'param.fn.month',
  quarter: 'param.fn.quarter',
  year: 'param.fn.year',
  lastWeek: 'param.fn.lastWeek',
  lastMonth: 'param.fn.lastMonth',
};
export const SUGGESTED: readonly { key: string; label: string; sql: string; on: (today: Date) => Date }[] = DATE_FUNCTIONS.map((fn) => ({ ...fn, label: LABELS[fn.key] }));

/** The suggested function a value is, if it is one of them (DEC-LE-14). */
export const suggestedOf = (value: string) => SUGGESTED.find((candidate) => candidate.key === dateFunctionOf(value)?.key) ?? null;

/** The day a date value gives today: itself, or what a suggested function gives; null for any other function. */
export { dayOf };

const LOCALES: Record<Language, string> = { nl: 'nl-BE', en: 'en-GB' };

/** A day of the calendar as the language writes it, such as "1 Jan 2026". */
export const formatDay = (value: string, language: Language): string =>
  new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

/**
 * What a Parameter shows: its value, as written or as the language writes a date, and for a function what
 * it gives today, which Data Hub works out only for the suggested ones (DEC-UX-118).
 */
export function describe(parameter: Parameter, language: Language, today: Date = new Date()): { value: string; gives: string | null } {
  const shown = (value: string) => (isDay(value) ? formatDay(value, language) : value);
  const given = (value: string) => {
    const found = dayOf(value, today);
    return found ? formatDay(found, language) : null;
  };
  switch (parameter.kind) {
    case 'date':
      return { value: shown(parameter.value), gives: isFunction('date', parameter.value) ? (given(parameter.value) ? t('param.gives', { date: given(parameter.value) as string }) : t('param.everyRun')) : null };
    case 'period': {
      const value = t('param.period', { from: shown(parameter.value), to: shown(parameter.to) });
      if (!isFunction('period', parameter.value) && !isFunction('period', parameter.to)) return { value, gives: null };
      const from = given(parameter.value);
      const to = given(parameter.to);
      return { value, gives: from && to ? t('param.gives', { date: t('param.period', { from, to }) }) : t('param.everyRun') };
    }
    case 'several':
      return { value: parameter.value.join(', ') || t('param.nothing'), gives: null };
    case 'yesno':
      return { value: t(parameter.value ? 'param.yes' : 'param.no'), gives: null };
    case 'choice':
      return { value: parameter.value, gives: null };
    default:
      return { value: parameter.value, gives: isFunction(parameter.kind, parameter.value) ? t('param.everyRun') : null };
  }
}

/** The line of the SQL an @name is first on, from 1; null when it is not in it. Comments are not left out. */
export function lineOf(sql: string, name: string): number | null {
  const found = new RegExp(`@${name}(?![A-Za-z0-9_])`).exec(sql);
  return found ? sql.slice(0, found.index).split('\n').length : null;
}
