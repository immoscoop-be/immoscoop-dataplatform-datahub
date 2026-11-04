import type { GapScope } from '@datahub/contracts/gaps';
import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';

/** How the scope of a Known Gap reads on the page (FR-RC-24, DEC-UX-177): the same words for chips, lines and hovers. */

const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;

/** A day of a period, written as the page writes days. */
export function gapDay(value: string): string {
  return new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

/** The span of a period: "until 28 Feb 2025", "from 2 Sep 2025", or "2 Sep 2025 – 8 Sep 2025". */
export function spanOf(period: NonNullable<GapScope['period']>): string {
  if (period.from && period.to) return t('gaps.span.between', { from: gapDay(period.from), to: gapDay(period.to) });
  return period.from ? t('gaps.span.from', { from: gapDay(period.from) }) : t('gaps.span.until', { to: gapDay(period.to ?? '') });
}

/** The values of rows, as one of them: "partner or app". */
export function valuesOf(values: readonly string[]): string {
  return new Intl.ListFormat(LOCALES[currentLanguage()], { type: 'disjunction' }).format(values);
}

/** The scope in one line of plain text, for a hover: "until 28 Feb 2025 on week_start · fields lead_channel · lead_source is app". */
export function scopeLine(scope: GapScope): string {
  const parts: string[] = [];
  if (scope.period) parts.push(`${spanOf(scope.period)} ${t('gaps.on')} ${scope.period.field}`);
  if (scope.fields && scope.fields.length > 0) parts.push(t('gaps.line.fields', { names: scope.fields.join(', ') }));
  if (scope.rows) parts.push(scope.rows.is === 'empty' ? t('gaps.line.empty', { field: scope.rows.field }) : t('gaps.line.rows', { field: scope.rows.field, values: valuesOf(scope.rows.values) }));
  return parts.join(' · ');
}
