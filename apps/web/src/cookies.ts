/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}

export interface CookieOptions {
  /** Seconds until the browser forgets it; 0 deletes it. */
  maxAge: number;
  /** Lax lets the browser send it when the User comes back from signing in at identity. */
  sameSite: 'Strict' | 'Lax';
}

/**
 * A cookie that JavaScript cannot read, that only travels over HTTPS, and only to the sign-in
 * routes of the web app's own address (TR-PF-27).
 */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/auth',
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    'Secure',
    `SameSite=${options.sameSite}`,
  ].join('; ');
}
