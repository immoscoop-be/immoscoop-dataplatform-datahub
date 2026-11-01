/** The services of Data Hub that mcp calls for a User. */
export type Service = 'catalogue' | 'query';

export interface DataHubOptions {
  catalogueUrl: string;
  queryUrl: string;
  /** The web app, for the links to the pages of Data Hub (FR-CL-06). */
  webUrl: string;
  fetch?: typeof fetch;
}

/** A service of Data Hub did not answer, or failed: mcp says so and never guesses (EC-CL-01). */
export class Unavailable extends Error {}

/**
 * A service refused, in words meant for the User: not found or not theirs to see (404), not allowed (403), or
 * not possible as it is (400, 409, 410, 422). Its body is kept, as a refusal of a run carries its Pre-flight.
 */
export class Refused extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface DataHub {
  get<T>(service: Service, path: string): Promise<T>;
  send<T>(service: Service, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T>;
  /** The address of a page of Data Hub, such as `/resources/…`. */
  page(path: string): string;
}

/** A run of a query in BigQuery can take a while; everything else answers fast. */
const RUN = /\/(runs|preview\/runs|preview\/choices)$/;

/**
 * catalogue and query, asked with the Access Token of the User, so that every answer is as they may see it
 * (TR-PF-05, FR-CL-02). mcp keeps nothing itself.
 */
export function createDataHub(options: DataHubOptions, authorization: string): DataHub {
  const request = options.fetch ?? fetch;
  const base: Record<Service, string> = { catalogue: options.catalogueUrl, query: options.queryUrl };

  async function call<T>(service: Service, method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await request(new URL(path, base[service]), {
        method,
        headers: { authorization, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(RUN.test(path.split('?')[0] ?? '') ? 120_000 : 20_000),
      });
    } catch (error) {
      throw new Unavailable(`${service} did not answer`, { cause: error });
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (response.ok) return parsed as T;
    const answer = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    if (response.status >= 500 || response.status === 401 || response.status === 429) {
      throw new Unavailable(`${service} answered ${response.status} for ${path.split('?')[0]}`);
    }
    const code = typeof answer.error === 'string' ? answer.error : String(response.status);
    const message = typeof answer.message === 'string' ? answer.message : `${service} answered ${response.status}.`;
    throw new Refused(response.status, code, message, answer);
  }

  return {
    get: (service, path) => call(service, 'GET', path),
    send: (service, method, path, body) => call(service, method, path, body),
    page: (path) => new URL(path, options.webUrl).toString(),
  };
}

/** The pages of Data Hub, as the web app names them. */
export const pages = {
  resource: (id: string) => `/resources/${encodeURIComponent(id)}`,
  collection: (id: string) => `/collections/${encodeURIComponent(id)}`,
  lens: (id: string) => `/lenses/${encodeURIComponent(id)}`,
  query: (id: string) => `/query/${encodeURIComponent(id)}`,
  newQuery: (resource?: string) => (resource ? `/query/new/${encodeURIComponent(resource)}` : '/query/new'),
  message: (id: string) => `/messages/${encodeURIComponent(id)}`,
  learningCard: (number: string) => `/learning/${encodeURIComponent(number)}`,
};
