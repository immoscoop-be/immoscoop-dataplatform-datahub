import { missingOfType, rolesOf, type FieldOfType, type MissingOfType, type ModelType, type TypeField, type TypeRole } from '@datahub/contracts/model-types';
import { t } from '@datahub/ui/foundations/texts.svelte.js';

/**
 * The words of the model types and of the fields each one asks for (FR-CO-44, DEC-RC-24): the card of a model type,
 * the line of each field it needs, chosen or missing, and what is still missing in a few words. The rules themselves
 * are those of the contracts, the same for catalogue, the web app and Claude.
 */

/** The words of each role a field holds for its model type. A model type and a role stay names; their words are sentences. */
export const ROLE_KEYS: Readonly<Record<TypeRole, string>> = {
  happenedAt: 'role.happenedAt',
  about: 'role.about',
  createdAt: 'role.createdAt',
  updatedAt: 'role.updatedAt',
  asOf: 'role.asOf',
  occurredAt: 'role.occurredAt',
  measure: 'role.measure',
  describes: 'role.describes',
  groupedBy: 'role.groupedBy',
  period: 'role.period',
  addsUp: 'role.addsUp',
  uniqueCount: 'role.uniqueCount',
};

/** What the card of a model type says (DEC-UX-262): one row is, why it exists, counting, asks for, an example; a short line, and what it asks for in words. */
export interface TypeTexts {
  def: string;
  why: string;
  counting: string;
  asks: string;
  example: string;
  short: string;
  wants: string;
}

export const TYPE_KEYS: Readonly<Record<ModelType, TypeTexts>> = {
  event: {
    def: 'type.event.def',
    why: 'type.event.why',
    counting: 'type.event.counting',
    asks: 'type.event.asks',
    example: 'type.event.example',
    short: 'type.event.short',
    wants: 'type.event.wants',
  },
  state: {
    def: 'type.state.def',
    why: 'type.state.why',
    counting: 'type.state.counting',
    asks: 'type.state.asks',
    example: 'type.state.example',
    short: 'type.state.short',
    wants: 'type.state.wants',
  },
  fact: {
    def: 'type.fact.def',
    why: 'type.fact.why',
    counting: 'type.fact.counting',
    asks: 'type.fact.asks',
    example: 'type.fact.example',
    short: 'type.fact.short',
    wants: 'type.fact.wants',
  },
  dimension: {
    def: 'type.dimension.def',
    why: 'type.dimension.why',
    counting: 'type.dimension.counting',
    asks: 'type.dimension.asks',
    example: 'type.dimension.example',
    short: 'type.dimension.short',
    wants: 'type.dimension.wants',
  },
  aggregate: {
    def: 'type.aggregate.def',
    why: 'type.aggregate.why',
    counting: 'type.aggregate.counting',
    asks: 'type.aggregate.asks',
    example: 'type.aggregate.example',
    short: 'type.aggregate.short',
    wants: 'type.aggregate.wants',
  },
  other: {
    def: 'type.other.def',
    why: 'type.other.why',
    counting: 'type.other.counting',
    asks: 'type.other.asks',
    example: 'type.other.example',
    short: 'type.other.short',
    wants: 'type.other.wants',
  },
};

/** The short line of a model type, such as on the step of the fields and in the Description. */
export function shortOf(type: ModelType): string {
  return t(TYPE_KEYS[type].short);
}

/**
 * One line of what a model type asks for: a role that one field holds, the measures of a fact or what an aggregate is
 * grouped by, or the counts and sums of an aggregate together. Chosen, missing, or optional and not chosen.
 */
export interface NeedLine<T extends TypeField = TypeField> {
  /** The key of its label. */
  label: string;
  /** The roles it holds: one, or both of the counts and sums of an aggregate. */
  roles: readonly TypeRole[];
  /** The key of how much it needs, such as required or at least one. */
  need: string;
  state: 'ok' | 'missing' | 'optional';
  /** The fields that hold it, that the Resource still has. */
  fields: T[];
  /** The fields that held it and are gone from the Resource, removed or renamed in dbt (FR-RC-29). */
  gone: T[];
  /** The number fields of an aggregate that hold no role yet. */
  unmarked: string[];
}

/** What each kind of need says, required or not. */
const NEED_KEYS = {
  one: 'fields.need.required',
  atLeastOne: 'fields.need.atLeastOne',
  counts: 'fields.need.counts',
  asOf: 'fields.need.asOf',
  period: 'fields.need.period',
} as const;

/**
 * The lines of what a model type asks for (FR-CO-44), in the order of its roles, each with the fields that hold it and
 * whether it is chosen, missing or optional. `other` has no lines: its sentence is "One row per".
 */
export function needLines<T extends TypeField>(type: ModelType | null, typeFields: readonly T[], fields: readonly FieldOfType[], sentence: string): NeedLine<T>[] {
  const present = new Set(fields.map((field) => field.name));
  const missing = missingOfType(type, typeFields, fields, sentence);
  const unmarked = missing.flatMap((item) => (item.kind === 'unmarked' ? [item.field] : []));
  const lines: NeedLine<T>[] = [];
  for (const rule of rolesOf(type)) {
    if (rule.role === 'uniqueCount') continue;
    const counts = rule.need === 'counts';
    const roles: TypeRole[] = counts ? ['addsUp', 'uniqueCount'] : [rule.role];
    const holding = typeFields.filter((typeField) => roles.includes(typeField.role));
    const label = counts ? 'fields.line.counts' : rule.role === 'measure' ? 'fields.line.measure' : ROLE_KEYS[rule.role];
    const need = rule.need === 'optional' ? (rule.role === 'period' ? NEED_KEYS.period : NEED_KEYS.asOf) : NEED_KEYS[rule.need];
    const misses = missing.some((item) => item.kind === 'role' && roles.includes(item.role)) || (counts && unmarked.length > 0);
    const held = holding.filter((typeField) => present.has(typeField.field));
    lines.push({
      label,
      roles,
      need,
      state: misses ? 'missing' : held.length > 0 ? 'ok' : 'optional',
      fields: held,
      gone: holding.filter((typeField) => !present.has(typeField.field)),
      unmarked: counts ? unmarked : [],
    });
  }
  return lines;
}

/** The first letter in lower case, for words that go into a sentence, such as "when it happened". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/** A role in words, inside a sentence: the counts and sums of an aggregate together, the measures of a fact. */
export function roleWords(role: TypeRole): string {
  if (role === 'addsUp' || role === 'uniqueCount') return lower(t('fields.line.counts'));
  if (role === 'measure') return lower(t('fields.line.measure'));
  return lower(t(ROLE_KEYS[role]));
}

/** What is missing, in a few words, such as "misses when it happened" or "lead_count not marked" (FR-CO-45, DEC-UX-265). */
export function missingWords(missing: MissingOfType): string {
  switch (missing.kind) {
    case 'modelType':
      return t('missing.modelType');
    case 'role':
      return t('missing.role', { what: roleWords(missing.role) });
    case 'unmarked':
      return t('missing.unmarked', { field: missing.field });
    case 'sentence':
      return t('missing.sentence');
  }
}

/** A sentence by its key, with its words and its names, for the Sentence component. */
export interface Said {
  key: string;
  values: Record<string, string>;
  names: Record<string, string>;
}

/**
 * Why "Add Resource" waits, from the first thing that is missing: a model type, a role, the numbers of an aggregate
 * not marked yet, or the sentence of `other` (FR-CO-44).
 */
export function waitingFor(missing: readonly MissingOfType[], type: ModelType | null, list: (items: string[]) => string): Said | undefined {
  const first = missing[0];
  if (!first) return undefined;
  switch (first.kind) {
    case 'modelType':
      return { key: 'fields.missing.modelType', values: {}, names: {} };
    case 'role':
      return { key: 'fields.missing.role', values: { what: roleWords(first.role) }, names: { type: type ?? '' } };
    case 'unmarked':
      return { key: 'fields.missing.unmarked', values: {}, names: { fields: list(missing.flatMap((item) => (item.kind === 'unmarked' ? [item.field] : []))) } };
    case 'sentence':
      return { key: 'fields.missing.sentence', values: {}, names: { type: type ?? '' } };
  }
}
