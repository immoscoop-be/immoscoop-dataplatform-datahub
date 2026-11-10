import { randomBytes } from 'node:crypto';
import { type ServiceCallerVerifier, TokenError } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
import { startingPermissions } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { type Collection, createCollections, type Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { createPeople } from './identity.js';
import { migrations } from './migrations/index.js';
import { createMessages, type Messages } from './messages.js';
import { createNotifications, type Email, htmlOf, type Notifications, type Person, slackOf, type SlackMessage, subjectLine } from './notifications.js';
import { createSlack, slackTokenFrom } from './slack.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

describe('the text of a notification (FR-CV-15)', () => {
  it('takes the first line of the plain text as the subject of an e-mail, cut at a word and a quote closed', () => {
    expect(subjectLine('Dirk Vos refused the request on the lens Leads.\n“Too big.”')).toBe('Dirk Vos refused the request on the lens Leads.');
    const long = `Karel Leys asked a question about the lens Leads per source name: “${'Mailing brings only 3.8% of the leads this year '.repeat(4)}”`;
    const subject = subjectLine(long);
    expect(subject.length).toBeLessThanOrEqual(141);
    expect(subject).toMatch(/ year…”$|…”$/);
    expect(subject.startsWith('Karel Leys asked a question')).toBe(true);
  });

  it('lays the text out as HTML with only its own marks, and escapes every value', () => {
    expect(htmlOf('**Karel** asked\n\n> <script>alert(1)</script>\n\n- ~~old~~\n- `lead_count`')).toBe(
      '<p style="margin:0 0 10px;"><b style="font-weight:600;">Karel</b> asked</p>' +
        '<blockquote style="margin:0 0 10px;padding-left:12px;border-left:2px solid #dedad3;">&#60;script&#62;alert(1)&#60;/script&#62;</blockquote>' +
        '<ul style="margin:0 0 10px;padding-left:18px;"><li><del style="color:#8a867f;">old</del></li><li><code style="font-family:Menlo,Consolas,monospace;font-size:13px;">lead_count</code></li></ul>',
    );
  });

  it('lays the text out in the mark-up of Slack', () => {
    expect(slackOf('**Karel** asked\n\n> Why <now>?\n\n- ~~old~~\n- `x`')).toBe('*Karel* asked\n\n> Why &lt;now&gt;?\n\n• ~old~\n• `x`');
  });
});

describe('who to notify, as identity knows them (DEC-LN-07, TR-PL-08)', () => {
  it('asks identity for the Users, the members of Groups and who has a Permission on, and nothing when nobody is asked', async () => {
    const sent: { url: string; body: unknown; authorization: string | null }[] = [];
    const dirk = { id: 'u-dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos', language: 'nl', groups: [], permissions: ['messages.dataTeam'] };
    const identity = (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify({ people: [dirk] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const people = createPeople('https://identity.test', async () => 'catalogue-id-token', identity);

    expect(await people.find({ users: [], groups: [], permissions: [] })).toEqual([]);
    expect(sent).toEqual([]);
    expect(await people.find({ users: ['u-karel'], groups: ['g-credit'], permissions: ['messages.dataTeam'] })).toEqual([dirk]);
    expect(sent).toEqual([
      {
        url: 'https://identity.test/internal/people',
        body: { users: ['u-karel'], groups: ['g-credit'], permissions: ['messages.dataTeam'] },
        authorization: 'Bearer catalogue-id-token',
      },
    ]);
  });
});

describe('Slack, through the app of Data Hub (DEC-LN-05)', () => {
  const answers = (users: Record<string, string>) => {
    const calls: { method: string; body: string }[] = [];
    const request = (async (input: string | URL | Request, init?: RequestInit) => {
      const method = String(input).split('/').pop() ?? '';
      const body = String(init?.body ?? '');
      calls.push({ method, body });
      const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
      if (method === 'users.lookupByEmail') {
        const email = new URLSearchParams(body).get('email') ?? '';
        return json(users[email] ? { ok: true, user: { id: users[email] } } : { ok: false, error: 'users_not_found' });
      }
      if (method === 'conversations.open') return json({ ok: true, channel: { id: `D-${(JSON.parse(body) as { users: string }).users}` } });
      return json({ ok: true });
    }) as typeof fetch;
    return { calls, request };
  };
  const message: SlackMessage = { text: 'Karel asked', blocks: [] };

  it('finds a User by their address, opens the direct message with them and posts there', async () => {
    const { calls, request } = answers({ 'an@immoscoop.be': 'U1' });
    const slack = createSlack(async () => 'xoxb-token', request);
    expect(await slack.send('an@immoscoop.be', message)).toBe('sent');
    expect(calls.map((call) => call.method)).toEqual(['users.lookupByEmail', 'conversations.open', 'chat.postMessage']);
    expect(JSON.parse(calls[2]!.body)).toMatchObject({ channel: 'D-U1', text: 'Karel asked', unfurl_links: false });
    // Someone not in Slack gets e-mail alone; without a token, Slack is off.
    expect(await slack.send('jan@immoscoop.be', message)).toBe('absent');
    expect(await createSlack(async () => null, request).send('an@immoscoop.be', message)).toBe('off');
  });

  it('reads the token again later, and is off only while the secret has no value', async () => {
    let clock = 0;
    let value: () => Promise<string> = async () => {
      throw new Error('The secret projects/p/secrets/datahub-slack-bot-token/versions/latest could not be read: 404 Secret Version not found');
    };
    const missing: unknown[] = [];
    const token = slackTokenFrom(() => value(), (error) => missing.push(error), () => clock);
    expect(await token()).toBeNull();
    value = async () => 'xoxb-token\n';
    expect(await token()).toBeNull();
    clock += 11 * 60 * 1000;
    expect(await token()).toBe('xoxb-token');
    expect(missing).toHaveLength(1);

    value = async () => {
      throw new Error('The secret could not be read: 503 unavailable');
    };
    clock += 11 * 60 * 1000;
    await expect(token()).rejects.toThrow(/503/);
  });
});

describe.skipIf(!url)('notifications by e-mail and in Slack (DEC-LN-02, DEC-LN-03, DEC-LN-07)', () => {
  const schema = `catalogue_notify_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let messages: Messages;
  let notifications: Notifications;
  let credit: Collection;
  // A little ahead of the database, whose clock stamps what is due.
  let clock = new Date(Date.now() + 60_000);

  const CREDIT = { id: 'g-credit', email: 'credit-team@immoscoop.be', name: 'credit-team' };
  // Known to Data Hub from their last sign-in: An and Jan in the Owner Unit, Dirk in Admin, which gets the Messages
  // for the Data Team, Karel elsewhere.
  const known: Person[] = [
    { id: 'u-an', email: 'an@immoscoop.be', name: 'An Claes', language: 'en', groups: ['g-credit'], permissions: [] },
    { id: 'u-jan', email: 'jan@immoscoop.be', name: 'Jan Peeters', language: 'nl', groups: ['g-credit'], permissions: [] },
    { id: 'u-dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos', language: 'nl', groups: [], permissions: ['messages.dataTeam'] },
    { id: 'u-karel', email: 'karel@immoscoop.be', name: 'Karel Leys', language: 'nl', groups: [], permissions: [] },
  ];
  const an: Viewer = { id: 'u-an', name: 'An Claes', groups: ['g-credit'], permissions: startingPermissions('businessAnalyst') };
  const karel: Viewer = { id: 'u-karel', name: 'Karel Leys', groups: [], permissions: startingPermissions('businessAnalyst') };
  const dirk: Viewer = { id: 'u-dirk', name: 'Dirk Vos', groups: [], permissions: startingPermissions('admin') };
  /** What catalogue asked identity, each time it looked for whom to notify. */
  let asked: { users: string[]; groups: string[]; permissions: string[] }[] = [];

  let mails: Email[] = [];
  let slacked: { email: string; message: SlackMessage }[] = [];
  let mailDown = false;

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const collections = createCollections(database.db);
    messages = createMessages(database.db);
    credit = await collections.create({ name: 'Credit leads', description: 'Leads for credit.', icon: 'coins', ownerUnit: CREDIT, visibility: 'public' }, an);
    notifications = createNotifications(database.db, {
      // identity answers who it knows: the Users asked for, the members of the Groups, and who has a Permission on,
      // each with which of those Groups and Permissions they have (TR-PL-08).
      people: {
        async find(question) {
          const { users, groups, permissions } = question;
          asked.push(question);
          return known
            .filter((person) => users.includes(person.id) || person.groups.some((group) => groups.includes(group)) || person.permissions.some((key) => permissions.includes(key)))
            .map((person) => ({
              ...person,
              groups: person.groups.filter((group) => groups.includes(group)),
              permissions: person.permissions.filter((key) => permissions.includes(key)),
            }));
        },
      },
      mail: {
        async send(email) {
          if (mailDown) throw new Error('421 the relay does not know this address');
          mails.push(email);
        },
      },
      slack: {
        async send(email, message) {
          if (email === 'jan@immoscoop.be') return 'absent';
          slacked.push({ email, message });
          return 'sent';
        },
      },
      webUrl: 'https://web.test',
      dataTeam: { email: 'datahub-datateam@immoscoop.be', permission: 'messages.dataTeam' },
      now: () => clock,
    });
  });

  beforeEach(async () => {
    // What earlier tests wrote is sent already.
    await notifications.deliver();
    mails = [];
    slacked = [];
    asked = [];
    mailDown = false;
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  const sightOf = async (viewer: Viewer) => messages.sight(viewer, await createCollections(database.db).list(viewer));

  it('notifies each member of an Owner Unit of a Question by e-mail in their language, and in Slack (FR-UM-21)', async () => {
    const lens = '0b9c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d';
    await messages.keepLens(lens, { name: 'Leads per source name', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-an', authorName: 'An Claes' });
    const question = await messages.write(await sightOf(karel), { kind: 'lens', id: lens }, 'question', 'Mailing brings only 3.8% of the leads <this> year?');

    expect(await notifications.deliver()).toMatchObject({ sent: 1, failed: 0, abandoned: 0 });
    // A Group of Data Hub has no address: An and Jan each get one, in their own language.
    expect(mails.map((mail) => mail.to)).toEqual(['an@immoscoop.be', 'jan@immoscoop.be']);
    expect(mails[0]?.subject).toBe('Karel Leys asked a question about the lens Leads per source name: “Mailing brings only 3.8% of the leads <this> year?”');
    const mail = mails[1];
    expect(mail?.subject).toBe('Karel Leys stelde een vraag over de lens Leads per source name: “Mailing brings only 3.8% of the leads <this> year?”');
    expect(mail?.html).toContain('Lens · Credit leads');
    expect(mail?.html).toContain('&#60;this&#62;');
    expect(mail?.html).toContain(`href="https://web.test/lenses/${lens}/messages/${question.id}"`);
    expect(mail?.html).toContain('Je krijgt dit als lid van credit-team, de Owner Unit van deze Lens.');
    expect(mail?.html).toContain('<a href="https://web.test/messages" style="color:#1d1d1b;">Message Centre</a>');
    expect(mail?.text).toContain(`Openen in context: https://web.test/lenses/${lens}/messages/${question.id}`);

    // An reads Slack in English; Jan is not in Slack, and gets the e-mail alone.
    expect(slacked.map((sent) => sent.email)).toEqual(['an@immoscoop.be']);
    expect(slacked[0]?.message.text).toBe('Karel Leys asked a question about the lens Leads per source name: “Mailing brings only 3.8% of the leads <this> year?”');
    expect(slacked[0]?.message.blocks).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: '*Karel Leys* asked a question about the lens Leads per source name\n\n> Mailing brings only 3.8% of the leads &lt;this&gt; year?' } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in context' }, url: `https://web.test/lenses/${lens}/messages/${question.id}` }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Lens · Credit leads · You get this as a member of credit-team, the Owner Unit of this Lens.' }] },
    ]);

    // A reply of An reaches Karel, who started the conversation, by his own address; never An herself.
    await messages.reply(question.id, await sightOf(an), 'Since March, newsletter leads count only through their link.');
    await notifications.deliver();
    expect(mails.slice(2).map((sent) => [sent.to, sent.subject])).toEqual([['karel@immoscoop.be', 'An Claes antwoordde over de lens Leads per source name: “Since March, newsletter leads count only through their link.”']]);
    expect(mails[2]?.html).toContain('Je krijgt dit omdat je dit gesprek begon.');
    expect(slacked.slice(1).map((sent) => sent.email)).toEqual(['karel@immoscoop.be']);
  });

  it('notifies the Owner Unit and the Data Team of a Signal, and nobody twice', async () => {
    const lens = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
    await messages.keepLens(lens, { name: 'Weekly leads', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-an', authorName: 'An Claes' });
    await messages.write(await sightOf(an), { kind: 'lens', id: lens }, 'signal', 'The last week is empty.');
    await notifications.deliver();
    // An wrote it: Jan of the Owner Unit gets it, An neither an e-mail nor a direct message (TR-UM-07).
    expect(mails.map((mail) => mail.to)).toEqual(['jan@immoscoop.be', 'datahub-datateam@immoscoop.be']);
    expect(slacked.map((sent) => sent.email)).toEqual(['dirk@immoscoop.be']);
    // The Data Team in Slack: the Users who get the Messages for the Data Team, asked of identity by that Permission (TR-PL-08).
    expect(asked).toEqual([{ users: [], groups: ['g-credit'], permissions: ['messages.dataTeam'] }]);
  });

  it('tells a User alone that they were moved to another Permission group, and the Data Team that someone got Admin back (FR-PL-12, EC-PL-03)', async () => {
    await messages.userNotice({
      type: 'MSG-USR-01',
      userId: 'u-karel',
      actor: 'Dirk Vos',
      from: 'Lens user',
      to: 'Business analyst',
      gains: ['Make and run queries'],
      losses: [],
      deleted: false,
    });
    await notifications.deliver();
    // Karel by his own address, in his language, because it is about him; nobody else, and not the Data Team.
    expect(mails.map((mail) => [mail.to, mail.subject])).toEqual([['karel@immoscoop.be', 'Dirk Vos van het Data Team zette je in de Permission group Business analyst; je zat in Lens user.']]);
    expect(mails[0]?.text).toContain('Je kan nu ook: Make and run queries.');
    expect(mails[0]?.html).toContain('Je krijgt dit omdat het over jou gaat.');
    expect(mails[0]?.html).toContain('href="https://web.test/messages/');
    expect(slacked.map((sent) => sent.email)).toEqual(['karel@immoscoop.be']);
    expect(asked).toEqual([{ users: ['u-karel'], groups: [], permissions: [] }]);
    mails = [];
    slacked = [];
    asked = [];

    await messages.userNotice({ type: 'MSG-USR-02', userId: 'u-dirk', name: 'Dirk Vos' });
    await notifications.deliver();
    expect(mails.map((mail) => [mail.to, mail.subject])).toEqual([['datahub-datateam@immoscoop.be', 'Dirk Vos kreeg de Permission group Admin terug: geen enkele User van Admin kon nog aanmelden.']]);
    expect(mails[0]?.html).toContain('Je krijgt dit als lid van het Data Team.');
    expect(slacked.map((sent) => sent.email)).toEqual(['dirk@immoscoop.be']);
    expect(asked).toEqual([{ users: [], groups: [], permissions: ['messages.dataTeam'] }]);
  });

  it('tells the writer of a Request the decision, by their own address, and the author of its Lens', async () => {
    const lens = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';
    await messages.keepLens(lens, { name: 'Leads per source, all weeks', collectionId: credit.id, resourceIds: [], state: 'waiting', authorId: 'u-karel', authorName: 'Karel Leys' });
    const request = await database.db
      .insertInto('messages')
      .values({ type: 'MSG-LEN-01', subjectKind: 'lens', subjectId: lens, writerId: 'u-karel', params: { writer: 'Karel Leys', reads: '6200000000', threshold: '1000000000', text: '' }, state: 'waiting', lastWriterId: 'u-karel' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await notifications.deliver();
    // The Request itself goes to the Data Team.
    expect(mails.map((mail) => mail.to)).toEqual(['datahub-datateam@immoscoop.be']);
    mails = [];
    slacked = [];

    await messages.decide(request.id, 'refused', 'It reads 6.2 GB every run.', { id: 'u-dirk', name: 'Dirk Vos' }, await sightOf(dirk));
    await notifications.deliver();
    expect(mails.map((mail) => [mail.to, mail.subject])).toEqual([['karel@immoscoop.be', 'Dirk Vos heeft de aanvraag voor de lens Leads per source, all weeks geweigerd.']]);
    expect(mails[0]?.html).toContain('Je krijgt dit omdat je de aanvraag stuurde.');
    expect(slacked.map((sent) => sent.email)).toEqual(['karel@immoscoop.be']);
  });

  it('tells the writer of a Question that someone else closed it, and nobody when they close it themselves (FR-CV-16, MSG-CNV-07)', async () => {
    const lens = '3e4f5a6b-7c8d-4e9f-8a0b-2c3d4e5f6a7b';
    await messages.keepLens(lens, { name: 'Leads per region', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-an', authorName: 'An Claes' });
    const question = await messages.write(await sightOf(karel), { kind: 'lens', id: lens }, 'question', 'Why is Limburg empty?');
    await notifications.deliver();
    mails = [];
    slacked = [];

    // Closed by An of its Owner Unit, with a line why: Karel hears it, by his own address.
    const closed = await messages.close(question.id, await sightOf(an), 'Limburg comes in next week.');
    expect(closed).toMatchObject({ state: 'closed' });
    await notifications.deliver();
    expect(mails.map((mail) => [mail.to, mail.subject])).toEqual([['karel@immoscoop.be', 'An Claes sloot het bericht over de lens Leads per region.']]);
    expect(mails[0]?.text).toContain('“Limburg comes in next week.”');
    expect(slacked.map((sent) => sent.email)).toEqual(['karel@immoscoop.be']);
    mails = [];
    slacked = [];

    // Reopened, then closed by Karel himself, without a line: nobody hears it.
    await messages.reopen(question.id, await sightOf(karel));
    await messages.close(question.id, await sightOf(karel), '');
    await notifications.deliver();
    expect(mails).toEqual([]);
    expect(slacked).toEqual([]);
  });

  it('tries again what failed, later, without sending again what went out, and gives up after the last try', async () => {
    const lens = '3e4f5a6b-7c8d-4e9f-0a1b-2c3d4e5f6a7b';
    await messages.keepLens(lens, { name: 'Leads by agency', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-an', authorName: 'An Claes' });
    const remark = await messages.write(await sightOf(karel), { kind: 'lens', id: lens }, 'remark', 'Agency 12 merged with 14.');
    mailDown = true;
    expect(await notifications.deliver()).toMatchObject({ sent: 0, failed: 1, failures: [{ messageId: remark.id, failure: 'email: 421 the relay does not know this address' }] });
    expect(slacked.map((sent) => sent.email)).toEqual(['an@immoscoop.be']);
    // Not due yet.
    expect(await notifications.deliver()).toMatchObject({ sent: 0, failed: 0 });

    mailDown = false;
    clock = new Date(clock.getTime() + 2 * 60_000);
    expect(await notifications.deliver()).toMatchObject({ sent: 1 });
    expect(mails.map((mail) => mail.to)).toEqual(['an@immoscoop.be', 'jan@immoscoop.be']);
    expect(slacked).toHaveLength(1);

    const second = await messages.write(await sightOf(karel), { kind: 'lens', id: lens }, 'remark', 'And agency 15 closed.');
    mailDown = true;
    for (let attempt = 0; attempt < 6; attempt++) {
      await notifications.deliver();
      clock = new Date(clock.getTime() + 5 * 60 * 60_000);
    }
    const row = await database.db.selectFrom('notifications').selectAll().where('messageId', '=', second.id).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ attempts: 6, failure: 'email: 421 the relay does not know this address' });
    expect(row.doneAt).not.toBeNull();
  });

  it('tells the Owner of a Resource that was withdrawn, and the author of a Lens that grew into large', async () => {
    const { rows } = await sql<{ id: string }>`
      insert into resources (key, project_id, node_id, name, resource_type, requested_name, display_name, level, collection_id)
      values ('p.d.agency_reviews', '9367', 'model.p.agency_reviews', 'agency_reviews', 'model', 'Agency reviews', 'Agency reviews', 1, ${credit.id})
      returning id`.execute(database.db);
    const resource = rows[0]!;
    await database.db.insertInto('messages').values({ type: 'MSG-RES-06', subjectKind: 'resource', subjectId: resource.id, writerId: null, params: { run: '2026-10-27' }, state: null }).execute();
    const lens = '4f5a6b7c-8d9e-4f0a-1b2c-3d4e5f6a7b8c';
    await messages.keepLens(lens, { name: 'Leads per week', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-karel', authorName: 'Karel Leys' });
    await messages.grewLarge(lens, { reads: 240_000_000, threshold: 100_000_000 });
    await notifications.deliver();
    expect(mails.map((mail) => mail.to)).toEqual(['an@immoscoop.be', 'jan@immoscoop.be', 'karel@immoscoop.be']);
    expect(mails.slice(1).map((mail) => mail.subject)).toEqual([
      'Agency reviews werd ingetrokken: geen enkele exposure met de tag datahub steunt er nog op. Alleen het datateam en de owner zien hem nog.',
      'De lens Leads per week is groot geworden: één run leest nu 240 MB, boven 100 MB. Hij blijft draaien.',
    ]);
    expect(mails[1]?.html).toContain('<code style="font-family:Menlo,Consolas,monospace;font-size:13px;">datahub</code>');
    expect(mails[2]?.html).toContain('Je krijgt dit als auteur van deze Lens.');
  });

  it('tells who ran a deleted Lens lately, each by their own address, never who deleted it (MSG-LEN-06, FR-LE-18)', async () => {
    const lens = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
    await messages.keepLens(lens, { name: 'Leads per day', collectionId: credit.id, resourceIds: [], state: 'published', authorId: 'u-an', authorName: 'An Claes' });
    await messages.lensDeleted(lens, { name: 'Leads per day', actor: { id: 'u-an', name: 'An Claes' }, reason: 'Replaced by the weekly lens.', users: ['u-karel', 'u-dirk', 'u-an'] });
    await notifications.deliver();
    expect(mails.map((mail) => [mail.to, mail.subject])).toEqual([
      ['karel@immoscoop.be', 'An Claes verwijderde de lens Leads per day. Hij draait niet meer, ook niet in Excel.'],
      ['dirk@immoscoop.be', 'An Claes verwijderde de lens Leads per day. Hij draait niet meer, ook niet in Excel.'],
    ]);
    expect(mails[0]?.html).toContain('Replaced by the weekly lens.');
    expect(mails[0]?.html).toContain('Je krijgt dit omdat je deze lens de voorbije 30 dagen gebruikte.');
    // Its link goes to the Message itself: the Lens is no longer there.
    expect(mails[0]?.html).toContain('https://web.test/messages/');
    expect(slacked.map((sent) => sent.email)).not.toContain('an@immoscoop.be');
  });

  it('sends what a request wrote before it answers, and lets only the scheduler start a round', async () => {
    const issuer = await createTestIssuer();
    const scheduler: ServiceCallerVerifier = {
      async verify(token) {
        if (token !== 'scheduler') throw new TokenError('Service token rejected: not a service account that may call');
        return 'datahub-scheduler@project.iam.gserviceaccount.com';
      },
    };
    const app = await buildApp({ verifier: issuer.verifier, logger: false, notifications: { notifications, schedulerCallers: scheduler } });
    app.post('/write', async () => {
      await database.db.insertInto('messages').values({ type: 'MSG-RES-06', subjectKind: 'resource', subjectId: 'gone', writerId: null, params: { run: '2026-10-28', subject: 'Old reviews' }, state: null }).execute();
      return { written: true };
    });
    const token = await issuer.sign({ sub: 'u-dirk', as: 'admin' });
    expect((await app.inject({ method: 'POST', url: '/write', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    // A Resource without a Collection answers to the Data Team.
    expect(mails.map((mail) => mail.to)).toEqual(['datahub-datateam@immoscoop.be']);

    expect((await app.inject({ method: 'POST', url: '/internal/notifications/deliver', headers: { authorization: 'Bearer someone' } })).statusCode).toBe(401);
    const round = await app.inject({ method: 'POST', url: '/internal/notifications/deliver', headers: { authorization: 'Bearer scheduler' } });
    expect(round.json()).toEqual({ sent: 0, failed: 0, abandoned: 0 });
    await app.close();
  });
});
