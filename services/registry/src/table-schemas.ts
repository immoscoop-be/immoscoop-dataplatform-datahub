import { type AccessTokenSource, CLOUD_PLATFORM } from '@datahub/google';

const API = 'https://bigquery.googleapis.com/bigquery/v2';

/** A column of a table as BigQuery keeps it, in the shape the catalog of dbt gives it (EC-AR-06). */
export interface SchemaColumn {
  name: string;
  position: number;
  /** In GoogleSQL, as the catalog writes it: `INT64`, `NUMERIC(10, 2)`, `STRUCT<city STRING>`, `ARRAY<STRING>`. */
  dataType: string;
  /** The description BigQuery keeps, which dbt writes there with `persist_docs`. */
  description: string;
}

/** Where a table is: its project, dataset and name in BigQuery. */
export interface TableAddress {
  project: string;
  dataset: string;
  table: string;
}

/**
 * The columns of the tables the catalog of a run lacks, read from BigQuery (EC-AR-06, TR-AR-15). Only the schema of
 * a table, as `tables.get` gives it: never a row, and nothing billed.
 */
export interface TableSchemas {
  /** Its columns; undefined when BigQuery has no such table or may not show it. Throws when BigQuery does not answer. */
  columns(address: TableAddress): Promise<SchemaColumn[] | undefined>;
}

/** BigQuery did not answer, or answered with an error other than an unknown or hidden table. */
export class SchemasUnavailable extends Error {}

interface SchemaField {
  name: string;
  type: string;
  mode?: string;
  fields?: SchemaField[];
  description?: string;
  maxLength?: string;
  precision?: string;
  scale?: string;
}

/** The names the API of BigQuery gives types, as GoogleSQL and the catalog of dbt name them. */
const TYPE_NAMES: Record<string, string> = { INTEGER: 'INT64', FLOAT: 'FLOAT64', BOOLEAN: 'BOOL', RECORD: 'STRUCT' };

/** The type of a field in GoogleSQL: a record with the types of its fields, a repeated field as an array. */
export function typeOf(field: SchemaField): string {
  const name = TYPE_NAMES[field.type] ?? field.type;
  const sized = field.maxLength ? `${name}(${field.maxLength})` : field.precision ? `${name}(${field.scale ? `${field.precision}, ${field.scale}` : field.precision})` : name;
  const base = name === 'STRUCT' ? `STRUCT<${(field.fields ?? []).map((inner) => `${inner.name} ${typeOf(inner)}`).join(', ')}>` : sized;
  return field.mode === 'REPEATED' ? `ARRAY<${base}>` : base;
}

/** The columns of a schema in their order, the fields of a record right after it, named `parent.child` as in the catalog. */
export function columnsOf(fields: readonly SchemaField[]): SchemaColumn[] {
  const flat: Omit<SchemaColumn, 'position'>[] = [];
  const walk = (list: readonly SchemaField[], prefix: string) => {
    for (const field of list) {
      flat.push({ name: `${prefix}${field.name}`, dataType: typeOf(field), description: field.description ?? '' });
      if (field.type === 'RECORD' || field.type === 'STRUCT') walk(field.fields ?? [], `${prefix}${field.name}.`);
    }
  };
  walk(fields, '');
  return flat.map((column, index) => ({ ...column, position: index + 1 }));
}

export function createTableSchemas(token: AccessTokenSource, request: typeof fetch = fetch): TableSchemas {
  return {
    async columns({ project, dataset, table }) {
      const url = `${API}/projects/${encodeURIComponent(project)}/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}?fields=schema`;
      let response: Response;
      try {
        response = await request(url, { headers: { authorization: `Bearer ${await token([CLOUD_PLATFORM])}` }, signal: AbortSignal.timeout(20_000) });
      } catch (error) {
        throw new SchemasUnavailable(`BigQuery did not answer for ${project}.${dataset}.${table}`, { cause: error });
      }
      // Not built yet, dropped, or in a project registry may not read: its columns stay those of the manifest.
      if (response.status === 404 || response.status === 403) {
        return undefined;
      }
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new SchemasUnavailable(`BigQuery answered ${response.status} for ${project}.${dataset}.${table}: ${detail.error?.message ?? ''}`.trim());
      }
      const found = (await response.json()) as { schema?: { fields?: SchemaField[] } };
      return columnsOf(found.schema?.fields ?? []);
    },
  };
}
