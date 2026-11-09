import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'vitest';
import { parse } from 'yaml';
import {
  checkAttributes,
  checkConformance,
  checkDistinguishable,
  checkVocabulary,
  type ConformanceInput,
} from '../src/core/conformance.ts';
import { keysOf, type Catalog } from '../src/core/i18n.ts';
import { REPO_ROOT } from '../src/core/registry.ts';
import type { AttributeValues, SemgraphMetadata } from '../src/core/semgraph.ts';
import { testRegistry } from './helpers.ts';

async function input(): Promise<ConformanceInput> {
  const registry = await testRegistry();
  return {
    vocabulary: structuredClone(registry.vocabulary),
    catalog: structuredClone(registry.catalog),
    semgraphs: [...registry.semgraphs.values()].map(({ id, metadata }) => ({ id, metadata: structuredClone(metadata) })),
    locales: registry.locales,
  };
}

function metadata(id: string, attributes: Record<string, AttributeValues>): SemgraphMetadata {
  return {
    id,
    title: 'semgraphs.movingWindowAverage.title',
    answers: 'semgraphs.movingWindowAverage.answers',
    readingCard: 'readingCards.timeSeries',
    attributes,
    exampleQuestions: [],
    doNotUseWhen: [],
    data: { minimumPoints: 1 },
    links: { figma: 'https://example.org', learning: 'https://example.org' },
  };
}

describe('conformance', () => {
  it('the repository passes every check', async () => {
    assert.deepEqual(checkConformance(await input()), []);
  });

  it('the first fill of the analysis, with the new attributes and semgraphs, passes checks 1 to 4', async () => {
    const { vocabulary } = await testRegistry();
    const table = parse(await readFile(path.join(REPO_ROOT, 'test', 'fixtures', 'analysis-attributes.yml'), 'utf8')) as Record<
      string,
      Record<string, AttributeValues>
    >;
    const semgraphs = Object.entries(table).map(([id, attributes]) => metadata(id, attributes));
    assert.equal(semgraphs.length, 15);
    assert.deepEqual(checkVocabulary(vocabulary), []);
    assert.deepEqual(semgraphs.flatMap((semgraph) => checkAttributes(vocabulary, semgraph)), []);
    assert.deepEqual(checkDistinguishable(semgraphs), []);
  });

  describe('catches broken definitions', () => {
    it('1: an attribute or value outside the vocabulary', async () => {
      const { vocabulary } = await testRegistry();
      const problems = checkAttributes(vocabulary, metadata('x', {
        timeAxis: ['calendar'], breakdown: ['none'], comparisonBasis: ['none'], dataGrain: ['aggregated'],
        measureType: ['additive', 'percentage'], accumulation: ['perPeriod'], colour: ['pink'],
      }));
      assert.ok(problems.some((problem) => problem.includes('value percentage')));
      assert.ok(problems.some((problem) => problem.includes('attribute colour is not in the vocabulary')));
    });

    it('2: a missing attribute that applies, and a filled one that does not', async () => {
      const { vocabulary } = await testRegistry();
      const problems = checkAttributes(vocabulary, metadata('x', {
        timeAxis: ['calendar'], breakdown: ['none'], comparisonBasis: ['none'], dataGrain: ['aggregated'], partToWhole: ['yes'],
      }));
      assert.ok(problems.some((problem) => problem.includes('measureType applies but is missing')));
      assert.ok(problems.some((problem) => problem.includes('accumulation applies but is missing')));
      assert.ok(problems.some((problem) => problem.includes('partToWhole does not apply')));
    });

    it('3: two semgraphs that overlap in every attribute', () => {
      const base = { timeAxis: ['calendar'], breakdown: ['none'], comparisonBasis: ['none'], dataGrain: ['aggregated'], accumulation: ['perPeriod'] };
      // Different, but not disjoint: a unique metric fits both, so the choice aid cannot pick one.
      const problems = checkDistinguishable([
        metadata('a', { ...base, measureType: ['additive', 'unique'] }),
        metadata('b', { ...base, measureType: ['unique'] }),
      ]);
      assert.equal(problems.length, 1);
      assert.match(problems[0]!, /a and b are not disjoint/);
      // any is never disjoint either.
      assert.equal(checkDistinguishable([
        metadata('a', { ...base, measureType: 'any' }),
        metadata('b', { ...base, measureType: ['ratio'] }),
      ]).length, 1);
    });

    it('4: an askWhen that points to an unknown attribute or value', async () => {
      const vocabulary = structuredClone((await testRegistry()).vocabulary);
      vocabulary.find((attribute) => attribute.id === 'partToWhole')!.askWhen = { breakdown: 'categories' };
      vocabulary.find((attribute) => attribute.id === 'accumulation')!.askWhen = { axis: 'calendar' };
      const problems = checkVocabulary(vocabulary);
      assert.ok(problems.some((problem) => problem.includes('unknown value breakdown=categories')));
      assert.ok(problems.some((problem) => problem.includes('unknown attribute axis')));
    });

    it('5: a text key without English base text', async () => {
      const broken = await input();
      broken.semgraphs[0]!.metadata.answers = 'semgraphs.movingWindowAverage.doesNotExist';
      assert.ok(checkConformance(broken).some((problem) => problem.includes('doesNotExist has no English base text')));
    });

    it('a doNotUseWhen alternative that is not in the catalogue', async () => {
      const broken = await input();
      broken.semgraphs[0]!.metadata.doNotUseWhen.push({ intent: 'showSomething', use: 'pieChart' });
      assert.ok(checkConformance(broken).some((problem) => problem.includes('pieChart, which is not in semgraphs/catalog.yml')));
    });

    it('a folder that is missing from the catalogue', async () => {
      const broken = await input();
      broken.folders = ['movingWindowAverage', 'sparkline'];
      assert.ok(checkConformance(broken).some((problem) => problem.includes('semgraphs/sparkline is not in')));
    });
  });

  it('schema.json of every semgraph is the contract its classes compose', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const [id, semgraph] of (await testRegistry()).semgraphs) {
      const written = JSON.parse(await readFile(path.join(REPO_ROOT, 'semgraphs', id, 'schema.json'), 'utf8'));
      assert.deepEqual(written, semgraph.implementation.schema(), `${id}/schema.json is out of date: npm run schemas`);
    }
  });

  it('nl-BE translates every English text', async () => {
    const { locales } = await testRegistry();
    const english = keysOf(locales.get('en') as Catalog);
    const dutch = new Set(keysOf(locales.get('nl-BE') as Catalog));
    assert.deepEqual(english.filter((key) => !dutch.has(key)), []);
  });
});
