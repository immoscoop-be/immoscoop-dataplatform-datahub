import { describe, expect, it } from 'vitest';
import { createExcelKeyExchanger, excelKeyFrom } from './excel-key.js';

const token = (exp: number) => `e30.${Buffer.from(JSON.stringify({ sub: 'an', exp })).toString('base64url')}.sig`;

describe('the Excel key (TR-PF-07, DEC-CH-06)', () => {
  it('is read from Basic, as password, whatever the user name', () => {
    const basic = (text: string) => `Basic ${Buffer.from(text).toString('base64')}`;
    expect(excelKeyFrom(basic('an@immoscoop.be:dhx_abc:def'))).toBe('dhx_abc:def');
    expect(excelKeyFrom(basic('an@immoscoop.be:'))).toBeUndefined();
    expect(excelKeyFrom('Bearer dhx_abc')).toBeUndefined();
    expect(excelKeyFrom(undefined)).toBeUndefined();
  });

  it('is exchanged at identity once per token lifetime, and refused when identity does not know it', async () => {
    const calls: { url: string; body: string; authorization: string }[] = [];
    let clock = 1_000_000;
    const exchanger = createExcelKeyExchanger({
      identityUrl: 'https://identity.test',
      idToken: async (audience) => `id-token-for-${audience}`,
      now: () => clock,
      request: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body), authorization: new Headers(init.headers).get('authorization') ?? '' });
        const key = (JSON.parse(String(init.body)) as { key: string }).key;
        return key === 'dhx_good'
          ? new Response(JSON.stringify({ accessToken: token(Math.floor(clock / 1000) + 900) }), { status: 200 })
          : new Response('{}', { status: 401 });
      }) as typeof fetch,
    });
    const first = await exchanger.accessToken('dhx_good');
    expect(first).toBeTruthy();
    expect(await exchanger.accessToken('dhx_good')).toBe(first);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://identity.test/internal/excel-keys/exchange', authorization: 'Bearer id-token-for-https://identity.test' });
    clock += 15 * 60 * 1000;
    await exchanger.accessToken('dhx_good');
    expect(calls).toHaveLength(2);
    expect(await exchanger.accessToken('dhx_bad')).toBeUndefined();
  });
});
