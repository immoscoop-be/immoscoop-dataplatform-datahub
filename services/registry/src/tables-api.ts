import { can } from '@datahub/contracts';
import type { FastifyInstance } from 'fastify';
import { forbidden, permissionsOf } from './access.js';
import { layerOf } from './internal.js';
import type { Reading } from './reading.js';

export interface TablesOptions {
  reading: Pick<Reading, 'knownTables'>;
}

/** How many tables one question names at most: more than any one query reads. */
const MOST = 50;
/** A table as BigQuery names it, `project.dataset.table`, without quotes. */
const TABLE = /^[^\s.,`]+\.[^\s.,`]+\.[^\s.,`]+$/;

/** A table Data Hub knows, as query hears of it for a power user's query (FR-SR-56). */
export interface KnownTable {
  /** `database.schema.table` in lowercase, as the Key of a Resource is (DEC-SR-04). */
  key: string;
  /** The same in its own case, as BigQuery knows it: BigQuery names are case-sensitive. */
  fullName: string;
  name: string;
  resourceType: string;
  layer: string;
  projectId: string;
  projectName: string | null;
  /** An exposure with the tag `datahub` depends on it: it is a Resource, read as one (DEC-SR-46). */
  resource: boolean;
  partition: { field: string; unit: string | null } | null;
}

/**
 * Which tables Data Hub knows, for a power user's query (FR-SR-56, DEC-SR-46): query asks with the Access Token of
 * the User, who needs `queries.outside`. Only names, layers and how a table is partitioned leave registry this way.
 */
export async function tableRoutes(app: FastifyInstance, options: TablesOptions): Promise<void> {
  app.get<{ Querystring: { relations?: string } }>('/known-tables', async (request, reply) => {
    if (!can(permissionsOf(request), 'queries.outside')) {
      return forbidden(reply, 'queries.outside', 'Only who may query tables outside Data Hub asks which tables Data Hub knows.');
    }
    const relations = (request.query.relations ?? '').split(',').map((relation) => relation.trim()).filter((relation) => relation !== '');
    if (relations.length === 0 || relations.length > MOST || !relations.every((relation) => relation.length <= 1024 && TABLE.test(relation))) {
      return reply.code(400).send({ error: 'invalid_request', message: `Name 1 to ${MOST} tables as project.dataset.table, separated by commas, in relations.` });
    }
    const rows = await options.reading.knownTables(relations);
    const tables: KnownTable[] = rows.map((row) => ({
      key: row.relation,
      fullName: [row.databaseName, row.schemaName, row.tableName].every((part) => part) ? `${row.databaseName}.${row.schemaName}.${row.tableName}` : row.relation,
      name: row.name,
      resourceType: row.resourceType,
      layer: layerOf(row),
      projectId: row.projectId,
      projectName: row.projectName,
      resource: row.resource,
      partition: row.partitionField ? { field: row.partitionField, unit: row.partitionUnit } : null,
    }));
    return { tables };
  });
}
