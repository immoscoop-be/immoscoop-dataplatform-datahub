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
    /** All the service answered, such as the Pre-flight of a query that cannot run. */
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type Call = (path: string, init?: { method?: string; body?: unknown }) => Promise<Response>;

const refusals = new Set<(permission: string) => void>();
const endings = new Set<() => void>();

/**
 * Hears that the session ended while the User works, a 401 or a renewal that identity refused, such as after the
 * working day of the web app, sessions ended in Admin or an account no longer active: the page then shows the
 * sign-in, instead of a loader that never ends. Answers how to stop hearing it.
 */
export function onSignedOut(listener: () => void): () => void {
  endings.add(listener);
  return () => endings.delete(listener);
}

/** The session ended: every page that listens hears it, and the call fails. */
function signedOut(): SignedOut {
  endings.forEach((listener) => listener());
  return new SignedOut();
}

/**
 * Hears every refusal of a service for a Permission the User lacks, a 403 with the key it needs (EC-PL-01): the
 * page then reads the Permissions of the User again. Answers how to stop hearing them.
 */
export function onPermissionRefused(listener: (permission: string) => void): () => void {
  refusals.add(listener);
  return () => refusals.delete(listener);
}

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
      throw signedOut();
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
      throw signedOut();
    }
    if (response.status === 404) {
      throw new NotFound(path);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.status === 403 && typeof body.permission === 'string') {
        const permission = body.permission;
        refusals.forEach((listener) => listener(permission));
      }
      throw new Refused(
        `${service} answered ${response.status} to ${init.method ?? 'GET'} ${path}`,
        response.status,
        typeof body.error === 'string' ? body.error : undefined,
        typeof body.message === 'string' ? body.message : undefined,
        body,
      );
    }
    return response;
  };
}
