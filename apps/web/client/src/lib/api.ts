import type { Session } from './session.js';

/** The session ended: the page signs in again. */
export class SignedOut extends Error {
  constructor() {
    super('The session has ended');
  }
}

/** What was asked for does not exist, or may not be seen: the page does not say which (DEC-UX-32). */
export class NotFound extends Error {
  constructor(path: string) {
    super(`Nothing at ${path}`);
  }
}

/** The service refused or failed what was asked: its status, and the code of its error when it gave one. */
export class Refused extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    /** What the service said about it, in its own words. */
    readonly detail?: string,
  ) {
    super(message);
  }
}

export type Call = (path: string, init?: { method?: string; body?: unknown }) => Promise<Response>;

/** Calls a service of Data Hub, named for its errors, with the Access Token of the User. */
export function createCall(
  service: string,
  base: string,
  session: Pick<Session, 'accessToken'>,
  request: typeof fetch = (input, init) => fetch(input, init),
): Call {
  return async (path, init = {}) => {
    const token = await session.accessToken();
    if (!token) {
      throw new SignedOut();
    }
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await request(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 401) {
      throw new SignedOut();
    }
    if (response.status === 404) {
      throw new NotFound(path);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
      throw new Refused(
        `${service} answered ${response.status} to ${init.method ?? 'GET'} ${path}`,
        response.status,
        typeof body.error === 'string' ? body.error : undefined,
        typeof body.message === 'string' ? body.message : undefined,
      );
    }
    return response;
  };
}
