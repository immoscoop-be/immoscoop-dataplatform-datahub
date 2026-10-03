import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { example, NOW, testRegistry } from './helpers.ts';

let app: FastifyInstance;

before(async () => {
  app = await buildApp({ registry: await testRegistry(), now: () => NOW, logger: false });
});
after(() => app.close());

const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object });

describe('API', () => {
  it('GET /healthz reports the versions', async () => {
    const response = await app.inject('/healthz');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: 'ok',
      version: '0.1.0',
      languageVersion: 'v0',
      tokensVersion: (await testRegistry()).tokens.version,
    });
  });

  it('GET /semgraphs lists what is available and what is planned', async () => {
    const body = (await app.inject('/semgraphs?locale=nl-BE')).json();
    assert.deepEqual(body.semgraphs.map((semgraph: { id: string }) => semgraph.id), ['movingWindowAverage', 'movingWindowMedian', 'calendarAverage', 'calendarMedian', 'periodComparison', 'kpiTile', 'kpiStatus', 'categoryComparison', 'distribution']);
    assert.equal(body.semgraphs[0].title, 'Voortschrijdend gemiddelde');
    assert.equal(body.semgraphs[3].title, 'Mediaan per kalenderperiode');
    assert.equal(body.semgraphs[4].title, 'Vergelijking met de vorige periode');
    assert.ok(body.planned.includes('funnel'));
    assert.ok(!body.planned.includes('periodComparison'));
    assert.equal(body.semgraphs[5].title, 'KPI-tegel');
    assert.equal(body.semgraphs[6].title, 'KPI-status');
    assert.equal(body.semgraphs[7].title, 'Vergelijking tussen categorieën');
    assert.equal(body.semgraphs[8].title, 'Verdeling');
  });

  it('GET /semgraphs/{id} returns metadata, schema and examples', async () => {
    const body = (await app.inject('/semgraphs/movingWindowAverage')).json();
    assert.equal(body.answers, 'How does this evolve, without the daily noise?');
    assert.deepEqual(body.attributes.measureType, ['additive', 'unique', 'perUnit']);
    assert.deepEqual(body.schema.properties.points.items.required, ['end', 'mean']);
    assert.equal(body.schema.properties.window.minimum, 1);
    assert.deepEqual(body.schema.properties.values.enum, ['off', 'last', 'lastAndPrevious', 'all']);
    assert.equal(body.schema.properties.values.default, 'last');
    assert.deepEqual(body.schema.properties.valueAxis.enum, ['zero', 'zoom']);
    const calendar = (await app.inject('/semgraphs/calendarMedian')).json();
    assert.deepEqual(calendar.schema.properties.unit.enum, ['week', 'month', 'quarter', 'year']);
    assert.deepEqual(Object.keys(calendar.schema.properties.points.items.properties), ['period', 'median', 'p25', 'p75', 'n']);
    assert.equal(calendar.schema.properties.window, undefined);
    assert.equal(calendar.schema.properties.values.default, 'lastAndPrevious');
    assert.ok(body.examples.some((entry: { name: string }) => entry.name === 'basic'));
  });

  it('GET /semgraphs/{id} for a planned semgraph says it is planned', async () => {
    const response = await app.inject('/semgraphs/funnel');
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().issues[0].code, 'plannedSemgraph');
  });

  it('POST /render returns an SVG with the version headers', async () => {
    const response = await post('/render', await example('basic'));
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/svg+xml; charset=utf-8');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(String(response.headers['content-security-policy']), /default-src 'none'/);
    assert.equal(response.headers['semgraph-language-version'], 'v0');
    assert.equal(response.headers['semgraph-tokens-version'], (await testRegistry()).tokens.version);
    assert.equal(response.headers['semgraph-deviations'], undefined);
    assert.match(response.body, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('POST /render names tolerated deviations in a header', async () => {
    const response = await post('/render', await example('window-10'));
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['semgraph-deviations'], 'windowNotMultipleOf7');
  });

  it('POST /render refuses a misleading chart with 422 and an explanation', async () => {
    const response = await post('/render', await example('unique-without-aggregation'));
    assert.equal(response.statusCode, 422);
    const body = response.json();
    assert.equal(body.outcome, 'refused');
    assert.equal(body.issues[0].code, 'uniqueAggregationRequired');
    assert.equal(body.locale, 'nl-BE');
  });

  it('POST /render rejects an unknown field with 400, also inside a block', async () => {
    const request = await example('basic');
    const response = await post('/render', { ...request, horizn: 28 });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().issues[0].code, 'unexpectedField');
    assert.equal(response.json().issues[0].field, '/horizn');

    const points = (request.points as object[]).map((point, index) => (index === 0 ? { ...point, email: 'x@y.be' } : point));
    const pii = (await post('/render', { ...request, points })).json();
    assert.equal(pii.issues[0].code, 'unexpectedBlockField');
    assert.equal(pii.issues[0].field, '/points/0/email');
    assert.match(pii.issues[0].alternative, /persoonsgegevens/);
  });

  it('POST /render requires measureType, in plain language', async () => {
    const { measureType: _, ...request } = await example('basic');
    const body = (await post('/render', { ...request, locale: 'en' })).json();
    assert.equal(body.outcome, 'invalid');
    assert.equal(body.issues[0].code, 'missingField');
    assert.equal(body.issues[0].message, 'The field measureType is required.');
  });

  it('POST /render says when a semgraph or format is not available yet', async () => {
    assert.equal((await post('/render', { semgraph: 'funnel' })).json().issues[0].code, 'plannedSemgraph');
    assert.equal((await post('/render', { semgraph: 'pieChart' })).json().issues[0].code, 'unknownSemgraph');
    const png = (await post('/render', { ...(await example('basic')), format: 'png' })).json();
    assert.equal(png.issues[0].code, 'formatNotAvailable');
  });

  it('POST /render falls back to English for an unknown locale, and says so', async () => {
    const response = await post('/validate', { ...(await example('basic')), locale: 'fr-BE' });
    const body = response.json();
    assert.equal(body.locale, 'en');
    assert.equal(body.outcome, 'ok');
    assert.equal(body.issues[0].code, 'localeFallback');
  });

  it('POST /validate always answers 200 with the outcome', async () => {
    for (const [name, outcome] of [
      ['basic', 'ok'],
      ['window-10', 'deviation'],
      ['unique-without-aggregation', 'refused'],
    ] as const) {
      const response = await post('/validate', await example(name));
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().outcome, outcome);
    }
    const invalid = await post('/validate', { semgraph: 'movingWindowAverage' });
    assert.equal(invalid.statusCode, 200);
    assert.equal(invalid.json().outcome, 'invalid');
  });

  it('answers broken requests in the same issue format', async () => {
    const json = await app.inject({ method: 'POST', url: '/render', payload: '{"semgraph":', headers: { 'content-type': 'application/json' } });
    assert.equal(json.statusCode, 400);
    assert.equal(json.json().issues[0].code, 'badRequest');

    const text = await app.inject({ method: 'POST', url: '/render', payload: 'hello', headers: { 'content-type': 'text/plain' } });
    assert.equal(text.statusCode, 415);
    assert.equal(text.json().issues[0].code, 'unsupportedMediaType');

    const large = await app.inject({
      method: 'POST',
      url: '/render',
      payload: JSON.stringify({ semgraph: 'movingWindowAverage', padding: 'x'.repeat(1_100_000) }),
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(large.statusCode, 413);
    assert.equal(large.json().issues[0].code, 'payloadTooLarge');

    const missing = await app.inject('/nothing');
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().issues[0].code, 'notFound');
  });

  it('GET /semgraphs/{id}/examples/{name} renders an example for the browser', async () => {
    const response = await app.inject('/semgraphs/movingWindowAverage/examples/missing-days');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/svg+xml; charset=utf-8');
    assert.equal((await app.inject('/semgraphs/movingWindowAverage/examples/../../package')).statusCode, 404);
  });

  it('REQ-083: GET /semgraphs is the overview of every chart on offer, each with links to all of its examples', async () => {
    const registry = await testRegistry();
    const body = (await app.inject('/semgraphs?locale=nl-BE')).json();
    assert.equal(body.gallery, '/gallery');
    assert.deepEqual(body.semgraphs.map((semgraph: { id: string }) => semgraph.id), [...registry.semgraphs.keys()]);
    for (const semgraph of body.semgraphs as { id: string; links: { figma: string }; examples: { name: string; title: string; href: string }[] }[]) {
      const loaded = registry.semgraphs.get(semgraph.id)!;
      assert.deepEqual(semgraph.examples.map((example) => example.name), [...loaded.examples.keys()], semgraph.id);
      assert.match(semgraph.links.figma, /^https:\/\/www\.figma\.com\//, semgraph.id);
      for (const example of semgraph.examples) {
        assert.ok(example.title.length > 0, example.href);
        // Every link leads to the drawn example, or to the reason it is refused.
        const response = await app.inject(example.href);
        assert.ok([200, 422].includes(response.statusCode), `${example.href}: ${response.statusCode}`);
      }
    }
  });

  it('REQ-083: GET /gallery shows every chart and every example to people, under a strict CSP; / leads there', async () => {
    const registry = await testRegistry();
    const root = await app.inject('/');
    assert.equal(root.statusCode, 302);
    assert.equal(root.headers.location, '/gallery');
    const response = await app.inject('/gallery?locale=nl-BE');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(String(response.headers['content-security-policy']), /default-src 'none'; img-src 'self'/);
    const html = response.body;
    assert.match(html, /<html lang="nl-BE">/);
    assert.match(html, /<h1>Semgraph: de grafieken<\/h1>/);
    assert.doesNotMatch(html, /<script/);
    for (const [id, loaded] of registry.semgraphs) {
      assert.match(html, new RegExp(`<section id="${id}">`), id);
      for (const name of loaded.examples.keys()) assert.ok(html.includes(`href="/semgraphs/${id}/examples/${name}"`), `${id}/${name}`);
    }
    // A drawn example is a picture; a refused one says why, in the language of the page.
    assert.ok(html.includes('<img src="/semgraphs/kpiStatus/examples/leads-since-launch"'));
    assert.doesNotMatch(html, /<img src="\/semgraphs\/movingWindowAverage\/examples\/unique-without-aggregation"/);
    assert.match(html, /<a class="refused" href="\/semgraphs\/movingWindowAverage\/examples\/unique-without-aggregation">Bij unieke aantallen/);
    assert.match(html, /<section id="planned">.*<code>funnel<\/code>/s);
    assert.match((await app.inject('/gallery?locale=en')).body, /<a class="refused"[^>]*>For unique counts/);
  });
});
