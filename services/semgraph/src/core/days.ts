import type { IssueSpec } from './issues.ts';
import type { Translator } from './i18n.ts';

/**
 * Days are handled as whole UTC day numbers (days since 1970-01-01), so day arithmetic never
 * meets daylight saving time. Only "which day is it now" depends on a time zone.
 */
const MS_PER_DAY = 86_400_000;

export const TIME_ZONE = 'Europe/Brussels';

/** "2026-09-30" -> day number, or undefined when it is not an existing calendar day. */
export function parseDay(text: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return date.getTime() / MS_PER_DAY;
}

export function formatDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The calendar day it is at `now` in the given time zone. */
export function currentDay(now: Date, timeZone = TIME_ZONE): number {
  const text = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parseDay(text)!;
}

/**
 * A day in the words of the locale, e.g. "30 sep" or "30 sep 2026", or in figures as in the footer
 * of Figma, "30/09", without depending on ICU data.
 */
export function localizeDay(t: Translator, day: number, style: 'short' | 'long' | 'numeric'): string {
  const date = new Date(day * MS_PER_DAY);
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return t(`date.${style}`, {
    day: style === 'numeric' ? twoDigits(date.getUTCDate()) : date.getUTCDate(),
    month: style === 'numeric' ? twoDigits(date.getUTCMonth() + 1) : t(`date.month.${date.getUTCMonth() + 1}`),
    year: date.getUTCFullYear(),
  });
}

/** A range of days, e.g. "17–23 sep", or "28 aug–3 sep" across months. */
export function localizeRange(t: Translator, from: number, to: number): string {
  const [start, end] = [new Date(from * MS_PER_DAY), new Date(to * MS_PER_DAY)];
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return t('date.rangeSameMonth', {
      from: start.getUTCDate(),
      to: end.getUTCDate(),
      month: t(`date.month.${end.getUTCMonth() + 1}`),
    });
  }
  return t('date.range', { from: localizeDay(t, from, 'short'), to: localizeDay(t, to, 'short') });
}

/** Input checks shared by every semgraph with daily values: existing days, one value per day. */
export function checkDailySeries(data: readonly { day: string }[], pointer = '/data'): IssueSpec[] {
  const issues: IssueSpec[] = [];
  const seen = new Set<number>();
  data.forEach(({ day }, index) => {
    const parsed = parseDay(day);
    if (parsed === undefined) {
      issues.push({ level: 'inputError', code: 'invalidDate', field: `${pointer}/${index}/day`, params: { value: day } });
    } else if (seen.has(parsed)) {
      issues.push({ level: 'inputError', code: 'duplicateDay', field: `${pointer}/${index}/day`, params: { day } });
    } else {
      seen.add(parsed);
    }
  });
  return issues;
}
