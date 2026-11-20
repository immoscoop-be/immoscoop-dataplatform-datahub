import { z } from 'zod';
import { type FieldOfType, kindOf, type ModelType, type TypeField, type TypeRole } from './modelTypes.js';

/**
 * Reliable Since and the Date Field of a Resource (DEC-RC-29, FR-RC-31, FR-RC-32): one definition for the catalogue,
 * the web app and Claude.
 *
 * Reliable Since is the day from which the whole table can be relied on, with why not earlier, or from its first row.
 * Not set is empty, never one of the two (FR-RC-31). It is read on the Date Field of the Resource, which its table type
 * gives; its Owner Unit or the Data Team may choose another date field, which Data Hub then calls unusual. A Resource
 * whose table type gives none gets the one they choose (DEC-RC-32).
 */

/** Reliable Since as set: from its first row, or from a later day with why not earlier. */
export interface ReliableSince {
  from: 'firstRow' | 'day';
  /** The day, `YYYY-MM-DD`, from a later day; null from its first row. */
  day: string | null;
  /** Why not earlier: required for a later day; empty from its first row, and for a day set before it was asked. */
  why: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);

/** What may be set: from its first row, or a later day with why; null clears it. */
export const reliableSinceSchema = z.discriminatedUnion('from', [
  z.object({ from: z.literal('firstRow') }).strict(),
  z
    .object({
      from: z.literal('day'),
      day: z.string().refine(isDay, 'A day is written as YYYY-MM-DD.'),
      why: z.string().trim().min(1, 'Why not earlier is required for a later day.').max(1000, 'Why not earlier is at most 1000 characters.'),
    })
    .strict(),
]);
export type ReliableSinceInput = z.infer<typeof reliableSinceSchema>;

/** The value as kept, from what was sent. */
export const reliableSinceOf = (input: ReliableSinceInput): ReliableSince =>
  input.from === 'firstRow' ? { from: 'firstRow', day: null, why: '' } : { from: 'day', day: input.day, why: input.why.trim() };

/** The roles whose field is the Date Field, per table type, the first held one first (DEC-RC-29). */
export const DATE_ROLES: Readonly<Partial<Record<ModelType, readonly TypeRole[]>>> = {
  event: ['happenedAt'],
  fact: ['occurredAt'],
  aggregate: ['period'],
  // A state: its created-at or its updated-at field, which the Owner picks; created first.
  state: ['createdAt', 'updatedAt'],
};

/** The date fields of a Resource: of type DATE, DATETIME or TIMESTAMP. */
export const dateFieldsOf = (fields: readonly FieldOfType[]): string[] => fields.filter((field) => kindOf(field.dataType) === 'date').map((field) => field.name);

/** The Date Field its table type gives: the field of its first time role that the Resource still has; null for none. */
export function typeDateField(type: ModelType | null, typeFields: readonly TypeField[], fields: readonly FieldOfType[]): { field: string; role: TypeRole } | null {
  const present = new Set(fields.map((field) => field.name));
  for (const role of (type && DATE_ROLES[type]) ?? []) {
    const held = typeFields.find((typeField) => typeField.role === role && present.has(typeField.field));
    if (held) return { field: held.field, role };
  }
  return null;
}

/** The Date Field of a Resource as it stands, and what to say about it (FR-RC-32). */
export interface DateField {
  /** The field Reliable Since is read on; null while there is none. */
  field: string | null;
  /** Given by its table type, or chosen by its Owner Unit or the Data Team. */
  source: 'type' | 'chosen' | null;
  /** The field its table type gives, with its role, whether chosen or not. */
  typeField: { field: string; role: TypeRole } | null;
  /** Another field than its table type gives: Data Hub warns (FR-RC-32). */
  unusual: boolean;
  /** The chosen field left the Resource. */
  gone: boolean;
}

/** The Date Field: the one chosen, else the one its table type gives (DEC-RC-29, DEC-RC-32). */
export function dateFieldOf(chosen: string | null, type: ModelType | null, typeFields: readonly TypeField[], fields: readonly FieldOfType[]): DateField {
  const typeField = typeDateField(type, typeFields, fields);
  if (chosen) {
    // A field of any of its time roles is usual: the Owner picks the created-at or the updated-at of a state.
    const roles = (type && DATE_ROLES[type]) ?? [];
    const usual = typeFields.some((typeField) => typeField.field === chosen && roles.includes(typeField.role));
    return { field: chosen, source: 'chosen', typeField, unusual: typeField !== null && !usual, gone: !fields.some((field) => field.name === chosen) };
  }
  return { field: typeField?.field ?? null, source: typeField ? 'type' : null, typeField, unusual: false, gone: false };
}

/** Reliable Since as Claude reads it, such as `from 2025-01-01 on week_start: 2024 was loaded once…`. */
export function reliableText(value: ReliableSince, dateField: string | null): string {
  const on = dateField ? ` on ${dateField}` : '';
  return value.from === 'firstRow' ? `from its first row${on}` : `from ${value.day}${on}${value.why ? `; not earlier because: ${value.why}` : ''}`;
}
