import { z } from 'zod';

/**
 * The scope of a Known Gap (FR-RC-24, DEC-RC-20): where it holds, of up to three kinds, each optional and combined as
 * they apply. A gap without one is free text, as every gap before.
 *
 * - `period`: the time it holds for, from and to, inclusive, as days; one side may be open, and one day has both the
 *   same (FR-RC-33). Which fields a gap concerns, `fields` says (DEC-UX-178); the date field it holds on is the Date
 *   Field of the Resource, unless it names another as `dateField` (DEC-RC-31, FR-RC-34)
 * - `fields`: the fields that are empty or unreliable where it holds
 * - `rows`: the rows it holds for: a field with one of some values, typed as they are in the data, or empty
 */
export interface GapScope {
  period?: { from: string | null; to: string | null; dateField?: string };
  fields?: string[];
  rows?: { field: string; is: 'oneOf'; values: string[] } | { field: string; is: 'empty' };
}

const field = z.string().trim().min(1).max(300);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A day is written as YYYY-MM-DD.');

/** What a scope may hold; whether its fields are fields of the Resource is checked against it. */
export const gapScopeSchema: z.ZodType<GapScope> = z
  .object({
    period: z
      .object({ from: day.nullable(), to: day.nullable(), dateField: field.optional() })
      .strict()
      .refine((period) => period.from !== null || period.to !== null, 'A period has a start, an end, or both.')
      .refine((period) => period.from === null || period.to === null || period.from <= period.to, 'A period starts before it ends.')
      .optional(),
    fields: z.array(field).min(1).max(20).optional(),
    rows: z
      .discriminatedUnion('is', [
        z.object({ field, is: z.literal('oneOf'), values: z.array(z.string().trim().min(1).max(200)).min(1).max(50) }).strict(),
        z.object({ field, is: z.literal('empty') }).strict(),
      ])
      .optional(),
  })
  .strict();

/** Whether a scope narrows anything down: one without a period, fields or rows is none. */
export function hasScope(scope: GapScope | null | undefined): scope is GapScope {
  return Boolean(scope && (scope.period || (scope.fields && scope.fields.length > 0) || scope.rows));
}

/** Every field a scope names, once each, in the order of fields, rows and the date field of its period. */
export function fieldsOf(scope: GapScope | null | undefined): string[] {
  if (!scope) return [];
  return [...new Set([...(scope.fields ?? []), ...(scope.rows ? [scope.rows.field] : []), ...(scope.period?.dateField ? [scope.period.dateField] : [])])];
}

/** A period of one day: from and to the same day (FR-RC-33). */
export const oneDay = (period: GapScope['period']): boolean => Boolean(period?.from && period.from === period.to);

/**
 * The scope as Claude reads it, as data after the gap (FR-RC-25), such as
 * `[period: until 2025-02-28; rows: lead_source = partner]`, or `[period: on 2026-10-21 on loaded_at]`.
 */
export function scopeText(scope: GapScope): string {
  const parts: string[] = [];
  if (scope.period) {
    const { from, to, dateField } = scope.period;
    const when = from && from === to ? `on ${from}` : from && to ? `from ${from} until ${to}` : from ? `from ${from}` : `until ${to}`;
    parts.push(`period: ${when}${dateField ? ` on ${dateField}` : ''}`);
  }
  if (scope.fields && scope.fields.length > 0) {
    parts.push(`fields: ${scope.fields.join(', ')}`);
  }
  if (scope.rows) {
    const rows = scope.rows;
    parts.push(`rows: ${rows.is === 'empty' ? `${rows.field} is empty` : rows.values.length === 1 ? `${rows.field} = ${rows.values[0]}` : `${rows.field} in (${rows.values.join(', ')})`}`);
  }
  return `[${parts.join('; ')}]`;
}
