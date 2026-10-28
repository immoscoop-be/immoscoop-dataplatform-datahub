import type { IdTokenSource } from '@datahub/google';

export type Direction = 'upstream' | 'downstream';

/** A model in the lineage around a Resource, as registry gives it to catalogue (DEC-AR-06). */
export interface LineageNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  /** Such as `staging`, `mart` or `seed`. */
  layer: string;
  projectId: string;
  projectName: string | null;
  /** How many steps from the Resource; the Resource itself at 0. */
  distance: number;
}

export interface Lineage {
  direction: Direction;
  nodes: LineageNode[];
  edges: { parentId: string; childId: string }[];
  /** True when more models are reachable than registry returned. */
  truncated: boolean;
}

/** registry did not answer as it should; the lineage can be asked again later. */
export class RegistryUnavailable extends Error {}

export interface Registry {
  /** The lineage of a Node one way, or undefined when no Current Version holds the Node. */
  lineage(nodeId: string, direction: Direction): Promise<Lineage | undefined>;
}

/** Asks registry as the service account of catalogue, with a Google ID token for its address (DEC-AR-06). */
export function createRegistry(url: string, idToken: IdTokenSource, request: typeof fetch = fetch): Registry {
  return {
    async lineage(nodeId, direction) {
      let response: Response;
      try {
        response = await request(new URL(`/internal/nodes/${encodeURIComponent(nodeId)}/lineage?direction=${direction}`, url), {
          headers: { authorization: `Bearer ${await idToken(url)}` },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw new RegistryUnavailable('registry did not answer', { cause: error });
      }
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new RegistryUnavailable(`registry answered ${response.status}`);
      }
      return (await response.json()) as Lineage;
    },
  };
}
