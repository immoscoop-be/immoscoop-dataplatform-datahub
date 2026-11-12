import { randomBytes } from 'node:crypto';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { CatalogueDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import type { SlackMessage } from './notifications.js';
import { codeMessage, createSlackAddresses, type SlackAddresses } from './slack-addresses.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

describe('the direct message with the code (OP-LN-08)', () => {
  it('gives the code in the language of the User, with a line for whoever did not ask', () => {
    expect(codeMessage('482913', 'en').text).toBe(
      'Your code for Data Hub is 482 913. Someone asked Data Hub to send their notifications to this Slack account. If that was not you, ignore this message.',
    );
    expect(codeMessage('482913', 'nl').text).toBe(
      'Je code voor Data Hub is 482 913. Iemand vroeg Data Hub om meldingen naar dit Slack-account te sturen. Was jij dat niet, negeer dan dit bericht.',
    );
    expect(codeMessage('007331', 'nl').blocks).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: 'Je code voor Data Hub is *007 331*.\nIemand vroeg Data Hub om meldingen naar dit Slack-account te sturen. Was jij dat niet, negeer dan dit bericht.' } },
    ]);
  });
});

describe.skipIf(!url)('the address by which Data Hub finds a User in Slack (FR-LN-07, OP-LN-08)', () => {
  const schema = `catalogue_slack_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let addresses: SlackAddresses;
  let issuer: TestIssuer;
  let app: FastifyInstance;
  let clock = new Date('2026-11-11T20:00:00Z');
  let codes: string[] = [];
  let sent: { email: string; message: SlackMessage }[] = [];
  let off = false;
  // In Slack: Max on his other address, An on hers.
  const accounts: Record<string, string> = { 'max@thenextimmoscoop.be': 'Max Passenier', 'an@immoscoop.be': 'An Claes' };
  const max = { id: 'u-max', email: 'Max@Immoscoop.be' };

  const slack = {
    async find(email: string) {
      if (off) return 'off' as const;
      return accounts[email] ? { name: accounts[email] } : null;
    },
    async send(email: string, message: SlackMessage) {
      if (off) return 'off' as const;
      if (!accounts[email]) return 'absent' as const;
      sent.push({ email, message });
      return 'sent' as const;
    },
  };

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    addresses = createSlackAddresses(database.db, slack, { now: () => clock, code: () => codes.shift() ?? '123456' });
    issuer = await createTestIssuer();
    app = await buildApp({ verifier: issuer.verifier, logger: false, slack: { addresses } });
  });

  beforeEach(async () => {
    await database.db.deleteFrom('slackAddresses').execute();
    await database.db.deleteFrom('slackCodes').execute();
    clock = new Date('2026-11-11T20:00:00Z');
    codes = ['123456', '654321', '111222'];
    sent = [];
    off = false;
  });

  afterAll(async () => {
    await app.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  it('finds the User by the address of their Google account first, and says when none has it', async () => {
    expect(await addresses.state({ id: 'u-an', email: 'an@immoscoop.be' })).toEqual({
      on: true,
      google: 'an@immoscoop.be',
      address: 'an@immoscoop.be',
      confirmedAt: null,
      name: 'An Claes',
    });
    expect(await addresses.state(max)).toMatchObject({ on: true, address: 'max@immoscoop.be', name: null });
  });

  it('is off without the token of the Slack app, so that no tile shows (OP-UX-78)', async () => {
    off = true;
    expect(await addresses.state(max)).toEqual({ on: false, google: 'max@immoscoop.be', address: 'max@immoscoop.be', confirmedAt: null, name: null });
    expect(await addresses.sendCode(max, 'max@thenextimmoscoop.be', 'nl')).toBe('off');
  });

  it('takes another address only once the code sent there is typed, and keeps the code as a hash', async () => {
    expect(await addresses.sendCode(max, 'nobody@immoscoop.be', 'nl')).toBe('absent');
    expect(await addresses.sendCode(max, ' Max@TheNextImmoscoop.be ', 'en')).toEqual({ name: 'Max Passenier', expiresAt: '2026-11-11T20:10:00.000Z' });
    expect(sent.map((one) => one.email)).toEqual(['max@thenextimmoscoop.be']);
    expect(sent[0]?.message.text).toContain('123 456');
    const kept = await database.db.selectFrom('slackCodes').selectAll().executeTakeFirstOrThrow();
    expect(kept.codeHash).not.toContain('123456');
    expect(kept.triesLeft).toBe(5);
    // Nothing changes before the code is typed.
    expect((await addresses.state(max)).address).toBe('max@immoscoop.be');

    expect(await addresses.confirm(max, '123 456')).toEqual({ state: 'confirmed' });
    clock = new Date('2026-11-11T20:03:00Z');
    expect(await addresses.state(max)).toEqual({
      on: true,
      google: 'max@immoscoop.be',
      address: 'max@thenextimmoscoop.be',
      confirmedAt: '2026-11-11T20:00:00.000Z',
      name: 'Max Passenier',
    });
    // The code is used up.
    expect(await addresses.confirm(max, '123456')).toEqual({ state: 'none' });

    await addresses.reset(max);
    expect(await addresses.state(max)).toMatchObject({ address: 'max@immoscoop.be', confirmedAt: null });
  });

  it('counts the tries, ends the code after the fifth wrong one, and after 10 minutes', async () => {
    await addresses.sendCode(max, 'max@thenextimmoscoop.be', 'nl');
    for (const triesLeft of [4, 3, 2, 1]) expect(await addresses.confirm(max, '000000')).toEqual({ state: 'wrong', triesLeft });
    expect(await addresses.confirm(max, 'abc')).toEqual({ state: 'wrong', triesLeft: 0 });
    expect(await addresses.confirm(max, '123456')).toEqual({ state: 'none' });

    // Only the newest code counts, and only for 10 minutes.
    await addresses.sendCode(max, 'max@thenextimmoscoop.be', 'nl');
    await addresses.sendCode(max, 'max@thenextimmoscoop.be', 'nl');
    expect(await addresses.confirm(max, '654321')).toEqual({ state: 'wrong', triesLeft: 4 });
    clock = new Date('2026-11-11T20:10:00Z');
    expect(await addresses.confirm(max, '111222')).toEqual({ state: 'expired' });
    expect((await addresses.state(max)).address).toBe('max@immoscoop.be');
  });

  it('says so when the Slack account of a confirmed address is gone, and the User gets e-mail alone (EC-LN-01)', async () => {
    await addresses.sendCode(max, 'max@thenextimmoscoop.be', 'nl');
    await addresses.confirm(max, '123456');
    delete accounts['max@thenextimmoscoop.be'];
    try {
      expect(await addresses.state(max)).toMatchObject({ address: 'max@thenextimmoscoop.be', confirmedAt: '2026-11-11T20:00:00.000Z', name: null });
    } finally {
      accounts['max@thenextimmoscoop.be'] = 'Max Passenier';
    }
  });

  it('serves each User only their own, behind their Access Token', async () => {
    const as = async (sub: string, email: string) => ({ authorization: `Bearer ${await issuer.sign({ sub, email, name: sub, groups: [] })}` });
    const headers = await as('u-max', 'max@immoscoop.be');
    expect((await app.inject({ method: 'GET', url: '/me/slack' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me/slack', headers })).json()).toMatchObject({ on: true, address: 'max@immoscoop.be', name: null });

    expect((await app.inject({ method: 'POST', url: '/me/slack/lookup', headers, payload: { email: 'not an address' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/me/slack/lookup', headers, payload: { email: 'nobody@immoscoop.be' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/me/slack/lookup', headers, payload: { email: 'max@thenextimmoscoop.be' } })).json()).toEqual({ name: 'Max Passenier' });

    const code = await app.inject({ method: 'POST', url: '/me/slack/code', headers, payload: { email: 'max@thenextimmoscoop.be', language: 'en' } });
    expect(code.statusCode).toBe(202);
    expect(code.json()).toEqual({ name: 'Max Passenier', expiresAt: '2026-11-11T20:10:00.000Z' });
    expect(sent[0]?.message.text).toMatch(/^Your code for Data Hub is \d{3} \d{3}\./);

    // An cannot confirm Max's code.
    const an = await as('u-an', 'an@immoscoop.be');
    expect((await app.inject({ method: 'POST', url: '/me/slack/confirm', headers: an, payload: { code: '000000' } })).statusCode).toBe(409);

    const wrong = await app.inject({ method: 'POST', url: '/me/slack/confirm', headers, payload: { code: '999999' } });
    expect([wrong.statusCode, wrong.json().triesLeft]).toEqual([400, 4]);
    const typed = sent[0]!.message.text.match(/(\d{3}) (\d{3})/)!;
    const right = await app.inject({ method: 'POST', url: '/me/slack/confirm', headers, payload: { code: `${typed[1]}${typed[2]}` } });
    expect(right.json()).toMatchObject({ address: 'max@thenextimmoscoop.be', name: 'Max Passenier' });
    expect((await app.inject({ method: 'GET', url: '/me/slack', headers: an })).json()).toMatchObject({ address: 'an@immoscoop.be' });

    expect((await app.inject({ method: 'DELETE', url: '/me/slack', headers })).json()).toMatchObject({ address: 'max@immoscoop.be', confirmedAt: null });
  });
});
