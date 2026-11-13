import { describe, expect, it } from 'vitest';
import { CONTRACT_PATH, createDomainModelSource, DomainModelUnavailable, identitiesOf, parseDomainModel } from './domain-model.js';
import { domainModelContract } from './fixtures.js';

/** A collector that answers each path with what it is given, and keeps what was asked. */
function collector(answers: Record<string, { status?: number; body: unknown }>) {
  const asked: string[] = [];
  const request = (async (url: URL | string) => {
    const path = new URL(url).pathname;
    asked.push(path);
    const answer = answers[path];
    if (!answer) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { request, asked };
}

describe('the Domain Model from the collector (TR-AR-09)', () => {
  it('reads the whole contract of the model, with its release and every identity', async () => {
    const { request, asked } = collector({ [CONTRACT_PATH]: { body: domainModelContract() } });
    const model = await createDomainModelSource('https://collector.test', request)();
    expect(asked).toEqual(['/domain-model/immoscoop']);
    expect(model.release).toBe('0.0.70');
    expect(identitiesOf(model)).toEqual(expect.arrayContaining(['subject.subjectId', 'user.userId', 'visitor.visitorId', 'homeLoanSimulation.generate']));
  });

  it('finds its version and release also on what wraps its Entities, or at its top; without them its Entities still serve', () => {
    const { meta, ...contract } = domainModelContract() as { meta: { domain: string; version: string; release: Record<string, string> } } & Record<string, unknown>;
    // Its meta on the wrapper, around the model.
    expect(parseDomainModel({ meta, model: contract })).toMatchObject({ domain: 'immoscoop', version: '0.1.0', release: '0.0.70' });
    // Its domain, version and release at the top, the release as text.
    expect(parseDomainModel({ ...contract, domain: 'immoscoop', version: '0.1.0', release: 'v0.0.71' })).toMatchObject({ domain: 'immoscoop', release: '0.0.71' });
    // Without a release, its version.
    expect(parseDomainModel({ ...contract, meta: { domain: 'immoscoop', version: '0.1.0' } }).release).toBe('0.1.0');
    // Without either, an empty release, which the web app sends on as none: catalogue refuses an empty one.
    const bare = parseDomainModel(contract);
    expect(bare.release).toBe('');
    expect(Object.keys(bare.entities).length).toBeGreaterThan(0);
  });

  it('takes a summary with an index of the Entities, without identifiers, for no Domain Model (EC-AR-05)', async () => {
    const summary = { meta: { domain: 'immoscoop', version: '0.1.0' }, entities: { user: { domain: 'identity', identifiers: ['subjectId', 'userId'], actions: ['signUp'] } } };
    const { request } = collector({ [CONTRACT_PATH]: { body: summary } });
    await expect(createDomainModelSource('https://collector.test', request)()).rejects.toBeInstanceOf(DomainModelUnavailable);
  });

  it('says so when the collector answers otherwise (EC-AR-05)', async () => {
    const { request } = collector({ [CONTRACT_PATH]: { status: 500, body: { error: 'down' } } });
    await expect(createDomainModelSource('https://collector.test', request)()).rejects.toBeInstanceOf(DomainModelUnavailable);
  });
});
