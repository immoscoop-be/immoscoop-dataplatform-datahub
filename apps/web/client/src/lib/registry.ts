import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** How many per subject a relation type holds; both while the Domain Model gives it both (DEC-RC-05). */
export type TypeCardinality = 'one' | 'many' | 'either';

/** The Domain Model in use, as the step that adds a Resource needs it (TR-AR-09). */
export interface DomainModelView {
  domain: string;
  version: string;
  release: string;
  relationTypes: { name: string; cardinality: TypeCardinality; description: string }[];
  /** Every identity: `entity.identifier`, and `entity.action` for the ID of an event. */
  identities: string[];
}

export type ProposalOrigin = 'dbt' | 'test' | 'domainModel' | 'name';

/** What registry proposes for the Resource on a Node (TR-AR-10). */
export interface Proposal {
  nodeId: string;
  builtOn: { name: string; entity: string | null; action: string | null; colleciones: boolean };
  storage: {
    partition: { field: string; unit: 'hour' | 'day' | 'month' | 'year' | null } | null;
    clusterBy: string[];
    requirePartitionFilter: boolean;
    from: string | null;
  };
  grain: { fields: string[]; origin: ProposalOrigin } | null;
  modelType: { value: 'event' | 'state'; origin: ProposalOrigin } | null;
  mappings: { field: string; kind: 'is' | 'relation' | 'performedBy'; relationType: string | null; identity: string; origin: ProposalOrigin }[];
  domainModel: { release: string } | null;
}

/** The calls of the page to registry, with the Access Token of the User; only the Data Team may ask. */
export function createRegistry(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('registry', config.registryUrl, session, request);
  return {
    /** The Domain Model, read from the collector at this moment (DEC-AR-05). */
    async domainModel(): Promise<DomainModelView> {
      return (await call('/domain-model')).json() as Promise<DomainModelView>;
    },
    async proposal(nodeId: string): Promise<Proposal> {
      return (await call(`/nodes/${encodeURIComponent(nodeId)}/proposal`)).json() as Promise<Proposal>;
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;
