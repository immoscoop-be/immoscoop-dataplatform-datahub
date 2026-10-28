import { createHash } from 'node:crypto';

/** A column of an exposed table, as registry tells it (TR-AR-08). */
export interface Column {
  name: string;
  position: number | null;
  dataType: string | null;
  description: string;
}

/** Why a column is no field of its Resource: it holds several values, a record, JSON or bytes (DEC-SR-33). */
export type LeftOutReason = 'array' | 'struct' | 'json' | 'bytes';

export interface LeftOut {
  name: string;
  dataType: string | null;
  reason: LeftOutReason;
}

/** The types of BigQuery that are no plain field, as the catalog of dbt writes them. */
const LEFT_OUT: readonly [RegExp, LeftOutReason][] = [
  [/^ARRAY\b/i, 'array'],
  [/^(STRUCT|RECORD)\b/i, 'struct'],
  [/^JSON\b/i, 'json'],
  [/^BYTES\b/i, 'bytes'],
];

/**
 * The plain fields of a Resource, and the columns left out of it (DEC-SR-33). The catalog lists the
 * fields inside a record as columns of their own, such as `address.city`; they are left out with
 * the record they are in.
 */
export function splitColumns(columns: readonly Column[]): { fields: Column[]; leftOut: LeftOut[] } {
  const reasons = new Map<string, LeftOutReason>();
  for (const column of columns) {
    const reason = LEFT_OUT.find(([type]) => type.test(column.dataType?.trim() ?? ''))?.[1];
    if (reason && !column.name.includes('.')) {
      reasons.set(column.name.toLowerCase(), reason);
    }
  }
  const fields: Column[] = [];
  const leftOut: LeftOut[] = [];
  for (const column of columns) {
    const [top = column.name] = column.name.split('.');
    const reason = column.name.includes('.') ? (reasons.get(top.toLowerCase()) ?? 'struct') : reasons.get(column.name.toLowerCase());
    if (reason) {
      leftOut.push({ name: column.name, dataType: column.dataType, reason });
    } else {
      fields.push(column);
    }
  }
  return { fields, leftOut };
}

/** Why a Resource has the Level it got at Registration: a code in its Log, never free text (FR-SR-11). */
export type LevelReason = 'described' | 'table-undescribed' | 'fields-undescribed';

/**
 * The Level at Registration (FR-SR-07, DEC-MR-12): 2 · Described when dbt describes the table and at
 * least one of its fields; otherwise 1 · Available. Never higher.
 */
export function levelAtRegistration(description: string, fields: readonly Column[]): { level: 1 | 2; reason: LevelReason } {
  if (description.trim() === '') {
    return { level: 1, reason: 'table-undescribed' };
  }
  if (!fields.some((field) => field.description.trim() !== '')) {
    return { level: 1, reason: 'fields-undescribed' };
  }
  return { level: 2, reason: 'described' };
}

/** The hashes of a Fingerprint (FR-SR-08), each over the fields in the order of their names. */
export interface Fingerprint {
  /** The names of the fields. */
  structure: string;
  /** Each field with its type. */
  types: string;
  /** The description of the table, and each field with its description. */
  descriptions: string;
  /** The checksum of the code in the manifest; none for a source. */
  code: string | null;
}

export function fingerprint(description: string, fields: readonly Column[], checksum: string | null): Fingerprint {
  const sorted = [...fields].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return {
    structure: hash(sorted.map((field) => field.name)),
    types: hash(sorted.map((field) => [field.name, field.dataType])),
    descriptions: hash([description, ...sorted.map((field) => [field.name, field.description])]),
    code: checksum,
  };
}
