/**
 * The model types of a Resource and the fields each one asks for (DEC-RC-10, DEC-RC-21, FR-CO-44): one definition
 * for the catalogue, the web app and Claude. A model type says what one row is; each of its roles is a field it needs
 * structurally, such as when an `event` happened or what a `state` is about. A field holds at most one role, and a role
 * is offered only to a field whose type fits it.
 *
 * Two checks follow from it. Whether what was recorded fits (`invalidTypeFields`): every role belongs to the model type,
 * fits the type of its field, and a role that takes one field is not held twice. And what is still missing
 * (`missingOfType`): a model type, a required role, a number of an aggregate that is not marked, or the sentence of
 * `other`. A role whose field is gone from the Resource, removed or renamed in dbt, counts as missing (DEC-RC-23).
 */

/** The model types of a Resource, a fixed list (DEC-RC-10), with `other` for a Resource that fits none (DEC-RC-21). */
export const MODEL_TYPES = ['event', 'state', 'fact', 'dimension', 'aggregate', 'other'] as const;
export type ModelType = (typeof MODEL_TYPES)[number];

/** What kind of value a field holds, read from its type in BigQuery. */
export type FieldKind = 'date' | 'number' | 'text' | 'other';

/** The roles a field can hold for its model type (FR-CO-44). */
export const TYPE_ROLES = [
  'happenedAt',
  'about',
  'createdAt',
  'updatedAt',
  'asOf',
  'occurredAt',
  'measure',
  'describes',
  'groupedBy',
  'period',
  'addsUp',
  'uniqueCount',
] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

/**
 * A role of a model type: the kinds of field it fits, whether it is required (`one`: exactly one field; `atLeastOne`;
 * `counts`: the counts and sums of an aggregate, at least one of them and every number field marked) or optional, and
 * whether one field holds it at most.
 */
export interface RoleRule {
  role: TypeRole;
  fits: readonly FieldKind[];
  need: 'one' | 'optional' | 'atLeastOne' | 'counts';
  single: boolean;
}

const date = ['date'] as const;
const identifier = ['text', 'number'] as const;
const number = ['number'] as const;

const RULES: Record<ModelType, readonly RoleRule[]> = {
  event: [{ role: 'happenedAt', fits: date, need: 'one', single: true }],
  state: [
    { role: 'about', fits: identifier, need: 'one', single: true },
    { role: 'createdAt', fits: date, need: 'one', single: true },
    { role: 'updatedAt', fits: date, need: 'one', single: true },
    { role: 'asOf', fits: date, need: 'optional', single: true },
  ],
  fact: [
    { role: 'occurredAt', fits: date, need: 'one', single: true },
    { role: 'measure', fits: number, need: 'atLeastOne', single: false },
  ],
  dimension: [{ role: 'describes', fits: identifier, need: 'one', single: true }],
  aggregate: [
    { role: 'groupedBy', fits: ['text', 'number', 'date'], need: 'atLeastOne', single: false },
    { role: 'period', fits: date, need: 'optional', single: true },
    { role: 'addsUp', fits: number, need: 'counts', single: false },
    { role: 'uniqueCount', fits: number, need: 'counts', single: false },
  ],
  other: [],
};

/** The roles a model type asks for, in the order they are shown. */
export function rolesOf(type: ModelType | null): readonly RoleRule[] {
  return type ? RULES[type] : [];
}

const DATES = new Set(['DATE', 'DATETIME', 'TIMESTAMP']);
const NUMBERS = new Set(['INT64', 'INTEGER', 'INT', 'SMALLINT', 'BIGINT', 'TINYINT', 'BYTEINT', 'NUMERIC', 'DECIMAL', 'BIGNUMERIC', 'BIGDECIMAL', 'FLOAT64', 'FLOAT']);

/** The kind of a field, from its type in BigQuery, such as `TIMESTAMP` or `NUMERIC(10, 2)`. */
export function kindOf(dataType: string | null): FieldKind {
  const base = (dataType ?? '').trim().toUpperCase().replace(/\(.*$/, '');
  if (DATES.has(base)) return 'date';
  if (NUMBERS.has(base)) return 'number';
  if (base === 'STRING') return 'text';
  return 'other';
}

/** The roles a field may hold for a model type, by the kind of its type. */
export function rolesFor(type: ModelType | null, dataType: string | null): TypeRole[] {
  const kind = kindOf(dataType);
  return rolesOf(type)
    .filter((rule) => rule.fits.includes(kind))
    .map((rule) => rule.role);
}

/** A field holding a role of the model type of its Resource. */
export interface TypeField {
  field: string;
  role: TypeRole;
}

/** A field of a Resource, with its type in BigQuery. */
export interface FieldOfType {
  name: string;
  dataType: string | null;
}

/** What is still missing before the model type of a Resource has every field it asks for. */
export type MissingOfType =
  | { kind: 'modelType' }
  | { kind: 'role'; role: TypeRole }
  | { kind: 'unmarked'; field: string }
  | { kind: 'sentence' };

/**
 * Whether what was recorded fits the model type: every role belongs to it, fits the type of its field, a field holds
 * one role, and a role that takes one field is held once. A field that is not a field of the Resource is left to the
 * caller: a stranger when recording, a role whose field is gone when reading. Returns the problem as a sentence.
 */
export function invalidTypeFields(type: ModelType | null, typeFields: readonly TypeField[], fields: readonly FieldOfType[]): string | undefined {
  const rules = new Map(rolesOf(type).map((rule) => [rule.role, rule]));
  const types = new Map(fields.map((field) => [field.name, field.dataType]));
  const seen = new Set<string>();
  const held = new Map<TypeRole, number>();
  for (const { field, role } of typeFields) {
    const rule = rules.get(role);
    if (!rule) {
      return type ? `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type} has no role ${role}.` : `without a model type, ${field} holds no role.`;
    }
    if (seen.has(field)) {
      return `the field ${field} holds more than one role.`;
    }
    seen.add(field);
    if (types.has(field) && !rule.fits.includes(kindOf(types.get(field) ?? null))) {
      return `the field ${field} does not fit the role ${role}.`;
    }
    held.set(role, (held.get(role) ?? 0) + 1);
    if (rule.single && (held.get(role) ?? 0) > 1) {
      return `the role ${role} takes one field.`;
    }
  }
  return undefined;
}

/**
 * What is still missing for the model type of a Resource (FR-CO-44, FR-CO-45): a model type, each required role not
 * held by a field the Resource still has, each number of an aggregate that holds no role, or the sentence of `other`.
 * Empty when it is complete.
 */
export function missingOfType(type: ModelType | null, typeFields: readonly TypeField[], fields: readonly FieldOfType[], grainSentence: string): MissingOfType[] {
  if (!type) {
    return [{ kind: 'modelType' }];
  }
  if (type === 'other') {
    return grainSentence.trim() === '' ? [{ kind: 'sentence' }] : [];
  }
  const present = new Set(fields.map((field) => field.name));
  const held = typeFields.filter((typeField) => present.has(typeField.field));
  const holding = (role: TypeRole) => held.some((typeField) => typeField.role === role);
  const missing: MissingOfType[] = [];
  for (const rule of rolesOf(type)) {
    if (rule.need === 'one' || rule.need === 'atLeastOne') {
      if (!holding(rule.role)) missing.push({ kind: 'role', role: rule.role });
    }
  }
  if (type === 'aggregate') {
    if (!holding('addsUp') && !holding('uniqueCount')) {
      missing.push({ kind: 'role', role: 'addsUp' });
    }
    const marked = new Set(held.map((typeField) => typeField.field));
    for (const field of fields) {
      if (kindOf(field.dataType) === 'number' && !marked.has(field.name)) {
        missing.push({ kind: 'unmarked', field: field.name });
      }
    }
  }
  return missing;
}

/** The roles whose field is gone from the Resource, removed or renamed in dbt (DEC-RC-23, FR-RC-29). */
export function goneOfType(typeFields: readonly TypeField[], fields: readonly FieldOfType[]): TypeField[] {
  const present = new Set(fields.map((field) => field.name));
  return typeFields.filter((typeField) => !present.has(typeField.field));
}
