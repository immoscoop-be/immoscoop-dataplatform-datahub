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

/** What a job of dbt Cloud does: build after a merge, build pull requests, build on a schedule, or else. */
export type JobKind = 'merge' | 'ci' | 'scheduled' | 'other';

/** The Source Job of a dbt project, as the page Webhooks shows it (FR-AR-18). */
export interface SourceJobTile {
  projectId: string;
  projectName: string | null;
  job: { id: string; name: string | null; environmentName: string | null; kind: JobKind | null; generatesDocs: boolean | null };
  /** Who chose it and when; null for the one of the configuration of the environment. */
  setBy: string | null;
  setAt: string | null;
  lastSet: { runId: string; status: SetStatus; receivedAt: string; processedAt: string | null } | null;
  /** dbt Cloud answered; without it, only what Data Hub keeps itself shows. */
  dbtCloud: boolean;
}

/** A job of a dbt project in dbt Cloud, to choose a Source Job from. */
export interface DbtJob {
  id: string;
  name: string;
  projectId: string;
  environmentId: string | null;
  environmentName: string | null;
  kind: JobKind;
  generatesDocs: boolean;
  lastRun: { at: string | null; status: string | null } | null;
  current: boolean;
  /** Why it cannot be a Source Job of this environment: a CI job, or a job of another environment. */
  notChoosable: 'ci' | 'otherEnvironment' | null;
}

export type SetStatus = 'pending' | 'processing' | 'processed' | 'failed';
export type DeliveryReason = 'notARun' | 'otherAccount' | 'notSucceeded' | 'notSourceJob' | 'otherProject' | 'signature';

/** A delivery of the webhook of dbt Cloud, and what Data Hub did with it (FR-AR-19). */
export interface Delivery {
  id: string;
  receivedAt: string;
  outcome: 'recorded' | 'ignored' | 'refused';
  reason: DeliveryReason | null;
  eventType: string | null;
  webhookName: string | null;
  accountId: string | null;
  projectId: string | null;
  jobId: string | null;
  jobName: string | null;
  environmentName: string | null;
  runId: string | null;
  runStatus: string | null;
  runStartedAt: string | null;
  runFinishedAt: string | null;
  /** Its Artifact Set when it was recorded: pending, processed, or failed and why. */
  set: { status: SetStatus; error: string | null; processedAt: string | null; current: boolean } | null;
  /** It came from a Source Job of this environment. */
  sourceJob: boolean;
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
    /** The Source Job of every dbt project Data Hub follows, and where dbt Cloud sends the webhook (FR-AR-18). */
    async sourceJobs(): Promise<{ projects: SourceJobTile[]; webhookUrl: string }> {
      return (await call('/admin/source-jobs')).json() as Promise<{ projects: SourceJobTile[]; webhookUrl: string }>;
    },
    /** The jobs of a dbt project in dbt Cloud, to choose its Source Job from. */
    async jobsOf(projectId: string): Promise<{ environment: { id: string; name: string | null } | null; jobs: DbtJob[] }> {
      return (await call(`/admin/source-jobs/${encodeURIComponent(projectId)}/jobs`)).json() as Promise<{ environment: { id: string; name: string | null } | null; jobs: DbtJob[] }>;
    },
    /** Makes a job the Source Job of a dbt project, from the next run (FR-AR-18). */
    async setSourceJob(projectId: string, jobId: string): Promise<SourceJobTile> {
      return (await call(`/admin/source-jobs/${encodeURIComponent(projectId)}`, { method: 'PUT', body: { jobId } })).json() as Promise<SourceJobTile>;
    },
    /** Every delivery of the webhook of the last 30 days, and how many call for a look (FR-AR-19). */
    async deliveries(): Promise<{ deliveries: Delivery[]; toLookAt: number }> {
      return (await call('/admin/deliveries')).json() as Promise<{ deliveries: Delivery[]; toLookAt: number }>;
    },
    /** Fetches and processes a run again (FR-AR-14). */
    async reprocess(runId: string): Promise<void> {
      await call(`/runs/${encodeURIComponent(runId)}/reprocess`, { method: 'POST' });
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;
