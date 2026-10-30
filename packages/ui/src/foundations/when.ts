import type { Language } from '@datahub/contracts/messages';

const LOCALES: Record<Language, string> = { nl: 'nl-BE', en: 'en-GB' };

/** Seconds in each unit, largest first, up to four weeks; beyond that a day is named instead. */
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * When something happened, as the language says it: "2 dagen geleden", "yesterday", "now"; after four
 * weeks, the day itself, such as "3 sep. 2026". No sentence of the interface, so no translation file.
 */
export function ago(at: Date | string, language: Language, now: Date = new Date()): string {
  const moment = typeof at === 'string' ? new Date(at) : at;
  const seconds = Math.round((moment.getTime() - now.getTime()) / 1000);
  if (seconds < -28 * 24 * 3600) {
    return new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'short', year: 'numeric' }).format(moment);
  }
  const relative = new Intl.RelativeTimeFormat(LOCALES[language], { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return relative.format(0, 'second');
}

/** A day, such as "21 okt." or "3 Sep 2026" when it is in another year. */
export function day(at: Date | string, language: Language, now: Date = new Date()): string {
  const moment = typeof at === 'string' ? new Date(at) : at;
  const year = moment.getFullYear() === now.getFullYear() ? undefined : 'numeric';
  return new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'short', year }).format(moment);
}

/** How long ago a day was, as the language says it: "today", "gisteren", "3 days ago"; after four weeks, the day itself. */
export function daysAgo(date: string, language: Language, now: Date = new Date()): string {
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  if (days > 28) {
    return day(`${date}T12:00:00Z`, language, now);
  }
  return new Intl.RelativeTimeFormat(LOCALES[language], { numeric: 'auto' }).format(-days, 'day');
}
