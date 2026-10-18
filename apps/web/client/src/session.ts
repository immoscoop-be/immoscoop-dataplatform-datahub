/** A sign-in problem the page explains to the User, by the code the server or identity gave. */
export class SignInProblem extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const problems: Record<string, string> = {
  access_denied: 'Only active accounts of the company can sign in.',
  server_error: 'Data Hub could not check your account with Google. Please try again in a minute.',
  temporarily_unavailable: 'Data Hub could not check your account with Google. Please try again in a minute.',
  expired: 'This sign-in took too long or was started in another window. Please try again.',
  refused: 'identity did not accept this sign-in. Please try again.',
};

/** The sentence for a sign-in problem. */
export function explain(code: string): string {
  return problems[code] ?? `Signing in did not work (${code}).`;
}

export interface SessionOptions {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type Session = ReturnType<typeof createSession>;

/**
 * The Access Token of the User. The server of the web app exchanges the Refresh Token in its cookie
 * for an Access Token, which is kept until shortly before it expires (TR-PF-27).
 */
export function createSession(options: SessionOptions = {}) {
  const request = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let cached: { token: string; until: number } | undefined;

  return {
    /**
     * The Access Token, or null without a session. If the renewal was refused, another tab may have
     * renewed at the same moment and changed the cookie: try once more.
     */
    async accessToken(): Promise<string | null> {
      if (cached && now() < cached.until) {
        return cached.token;
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await request('/auth/token', { method: 'POST' });
        const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
        if (response.ok && body.access_token && body.expires_in) {
          cached = { token: body.access_token, until: now() + (body.expires_in - 60) * 1000 };
          return cached.token;
        }
        // The session itself is still good when Google, identity or the server could not answer.
        if (body.error === 'temporarily_unavailable' || response.status >= 500) {
          throw new SignInProblem('temporarily_unavailable');
        }
        if (body.error !== 'renewal_refused') {
          return null;
        }
        await sleep(1000);
      }
      return null;
    },

    /** Ends the session at identity too, through the server of the web app. */
    async signOut(): Promise<void> {
      cached = undefined;
      await request('/auth/logout', { method: 'POST' });
    },
  };
}
