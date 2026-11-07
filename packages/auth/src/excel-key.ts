import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';

/**
 * Excel signs in with an Excel key (TR-PF-07, DEC-CH-06): Power Query sends it with Basic, as password, with
 * the e-mail of the User as user name. A service exchanges it at identity for an Access Token of its User,
 * kept for the lifetime of that token, so that services only ever handle Access Tokens.
 */
export interface ExcelKeyExchanger {
  /** The Access Token of the User of a key; undefined when the key is not known, revoked or expired. */
  accessToken(key: string): Promise<string | undefined>;
}

export interface ExcelKeyExchangerOptions {
  /** The address of identity, also the audience of the Google ID token of the service that asks. */
  identityUrl: string;
  /** Google ID tokens of the service itself (TR-PF-05). */
  idToken: (audience: string) => Promise<string>;
  request?: typeof fetch;
  now?: () => number;
}

/** The Excel key in a header `Authorization: Basic …`, its password; undefined when there is none. */
export function excelKeyFrom(authorization: string | undefined): string | undefined {
  const encoded = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(authorization ?? '')?.[1];
  if (!encoded) return undefined;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  const key = colon >= 0 ? decoded.slice(colon + 1) : '';
  return key.length > 0 ? key : undefined;
}

/** Tokens are used again until a minute before they expire; at most this many keys are kept. */
const MARGIN_MS = 60 * 1000;
const KEPT = 1000;

export function createExcelKeyExchanger(options: ExcelKeyExchangerOptions): ExcelKeyExchanger {
  const request = options.request ?? fetch;
  const now = options.now ?? Date.now;
  // By the hash of a key, never the key itself.
  const kept = new Map<string, { token: string; until: number }>();

  return {
    async accessToken(key) {
      const id = createHash('sha256').update(key).digest('base64url');
      const cached = kept.get(id);
      if (cached && cached.until > now()) return cached.token;
      kept.delete(id);
      const response = await request(`${options.identityUrl}/internal/excel-keys/exchange`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await options.idToken(options.identityUrl)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (response.status === 401) return undefined;
      if (!response.ok) throw new Error(`identity answered ${response.status} to the exchange of an Excel key`);
      const { accessToken } = (await response.json()) as { accessToken: string };
      const exp = decodeJwt(accessToken).exp;
      if (exp) {
        if (kept.size >= KEPT) kept.delete(kept.keys().next().value!);
        kept.set(id, { token: accessToken, until: exp * 1000 - MARGIN_MS });
      }
      return accessToken;
    },
  };
}
