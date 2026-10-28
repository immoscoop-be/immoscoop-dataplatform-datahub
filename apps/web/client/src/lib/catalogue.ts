import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** A Resource as catalogue gives it (TR-SR-05). */
export interface Resource {
  id: string;
  key: string;
  displayName: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  description: string;
  exposures: string[];
  collectionId: string | null;
  level: number;
  registeredAt: string;
  withdrawn: boolean;
}

export interface Field {
  name: string;
  position: number | null;
  dataType: string | null;
  description: string;
}

/** A Resource with its fields, and the columns of its table left out of it (DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Field[];
  leftOut: { name: string; dataType: string | null; reason: string }[];
}

/** An entry of a Log: its Log ID and parameters; the page builds its text in the language of the reader. */
export interface LogEntry {
  logId: string;
  params: Record<string, string>;
  at: string;
}

/** The calls of the page to catalogue, with the Access Token of the User. */
export function createCatalogue(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('catalogue', config.catalogueUrl, session, request);
  const resource = (id: string) => `/resources/${encodeURIComponent(id)}`;

  return {
    /** The Resources that wait for a Collection: only the Data Team may ask (FR-SR-35). */
    async waiting(): Promise<Resource[]> {
      return ((await (await call('/resources?collection=none')).json()) as { resources: Resource[] }).resources;
    },
    async resource(id: string): Promise<ResourceDetail> {
      return ((await (await call(resource(id))).json()) as { resource: ResourceDetail }).resource;
    },
    async log(id: string): Promise<LogEntry[]> {
      return ((await (await call(`${resource(id)}/log`)).json()) as { entries: LogEntry[] }).entries;
    },
  };
}

export type Catalogue = ReturnType<typeof createCatalogue>;
