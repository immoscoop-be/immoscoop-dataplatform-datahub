import type { Language } from '@datahub/contracts/messages';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import { day } from '@datahub/ui/foundations/when.js';

const LOCALES: Record<Language, string> = { nl: 'nl-BE', en: 'en-GB' };

/** The time of a moment, such as "08:12". */
export const clock = (at: Date | string, language: Language): string => new Intl.DateTimeFormat(LOCALES[language], { hour: '2-digit', minute: '2-digit' }).format(new Date(at));

/** When a run happened, as the history and the panel say it: "today, 08:12", "yesterday, 17:40", "23 Oct, 10:02". */
export function when(at: Date | string, language: Language, now: Date = new Date()): string {
  const moment = new Date(at);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const which = same(moment, now) ? t('query.today') : same(moment, new Date(now.getTime() - 86_400_000)) ? t('query.yesterday') : day(moment, language, now);
  return `${which.toLocaleLowerCase(LOCALES[language])}, ${clock(moment, language)}`;
}
