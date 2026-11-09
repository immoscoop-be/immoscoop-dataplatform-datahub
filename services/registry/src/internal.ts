import type { ServiceCallerVerifier } from '@datahub/auth';
import type { FastifyInstance } from 'fastify';
import type { Direction, NodeSummary, Reading } from './reading.js';

export interface InternalOptions {
  reading: Pick<Reading, 'lineage'>;
  /** Who may ask: catalogue, by a Google ID token for registry's own address. */
  serviceCallers: ServiceCallerVerifier;
}

/** How far the lineage around a Resource reaches: as far as registry walks one (TR-AR-06). */
const DEPTH = 50;

/** A model in the lineage around a Resource: what anyone who sees the Resource may read (DEC-AR-06). */
export interface LineageNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  layer: string;
  projectId: string;
  projectName: string | null;
  distance: number;
}

/**
 * The layer of a model: the one Colleciónes tags it with, else the folder it sits in under `models/`,
 * such as `staging`, else its kind, such as `seed`.
 */
export function layerOf(node: Pick<NodeSummary, 'layer' | 'filePath' | 'resourceType'>): string {
  const folder = /^models\/([^/]+)\//.exec(node.filePath ?? '')?.[1];
  return node.layer ?? folder ?? node.resourceType;
}

/**
 * What another service of Data Hub asks registry as itself, for a User it checked: the lineage around a
 * Resource, for its tab Lineage (DEC-AR-06). Only names, layers and projects leave registry this way.
 */
export async function internalRoutes(app: FastifyInstance, options: InternalOptions): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { direction?: string } }>(
    '/internal/nodes/:id/lineage',
    {
      config: { public: true },
      onRequest: async (request, reply) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
        try {
          await options.serviceCallers.verify(token);
        } catch (error) {
          request.log.warn({ err: error }, 'a call for the lineage around a Resource was refused');
          return reply.code(401).send({ error: 'unauthorized', message: 'Only catalogue asks for the lineage around a Resource.' });
        }
      },
    },
    async (request, reply) => {
      const direction = request.query.direction;
      if (direction !== 'upstream' && direction !== 'downstream') {
        return reply.code(400).send({ error: 'invalid_request', message: 'direction is upstream or downstream.' });
      }
      const lineage = await options.reading.lineage(request.params.id, direction as Direction, DEPTH);
      if (!lineage) {
        return reply.code(404).send({ error: 'not_found', message: 'No such Node in the Current Version of a dbt project.' });
      }
      // Exposures are how dbt tells Data Hub what to take, not models: they stay out.
      const nodes: LineageNode[] = lineage.nodes
        .filter((node) => node.resourceType !== 'exposure')
        .map((node) => ({
          uniqueId: node.uniqueId,
          name: node.name,
          resourceType: node.resourceType,
          layer: layerOf(node),
          projectId: node.projectId,
          projectName: node.projectName,
          distance: node.distance,
        }));
      const kept = new Set(nodes.map((node) => node.uniqueId));
      return {
        direction,
        nodes,
        edges: lineage.edges.filter((edge) => kept.has(edge.parentId) && kept.has(edge.childId)),
        truncated: lineage.truncated,
      };
    },
  );
}
