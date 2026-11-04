import { z } from 'zod';

/**
 * The scope of a Known Gap (FR-RC-24, DEC-RC-20): where it holds, of up to three kinds, each optional and combined as
 * they apply. A gap without one is free text, as every gap before.
 *
 * - `period`: the time it holds for, from and to, inclusive, as days; one side may be open. It names no field of its
 *   own: which fields a gap concerns, `fields` says (DEC-UX-178)
 * - `fields`: the fields that are empty or unreliable where it holds
 * - `rows`: the rows it holds for: a field with one of some values, typed as they are in the data, or empty
 */
export interface GapScope {
  period?: { from: string | null; to: string | null };
  fields?: string[];
  rows?: { field: string; is: 'oneOf'; values: string[] } | { field: string; is: 'empty' };
}

const field = z.string().trim().min(1).max(300);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A day is written as YYYY-MM-DD.');

/** What a scope may hold; whether its fields are fields of the Resource is checked against it. */
export const gapScopeSchema: z.ZodType<GapScope> = z
  .object({
    period: z
      .object({ from: day.nullable(), to: day.nullable() })
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

/** Every field a scope names, once each, in the order of fields and rows. */
export function fieldsOf(scope: GapScope | null | undefined): string[] {
  if (!scope) return [];
  return [...new Set([...(scope.fields ?? []), ...(scope.rows ? [scope.rows.field] : [])])];
}

/**
 * The scope as Claude reads it, as data after the gap (FR-RC-25), such as
 * `[period: until 2025-02-28; rows: lead_source = partner]`.
 */
export function scopeText(scope: GapScope): string {
  const parts: string[] = [];
  if (scope.period) {
    const { from, to } = scope.period;
    parts.push(`period: ${from && to ? `from ${from} until ${to}` : from ? `from ${from}` : `until ${to}`}`);
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
