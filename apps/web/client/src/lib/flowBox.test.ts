import { journeyOf, type JourneyFacts, REQUIRED_TO_PUBLISH } from '@datahub/contracts/journey';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import en from '../texts/en.js';
import nl from '../texts/nl.js';
import type { ResourceDetail } from './catalogue.js';
import { FLOW_PLACES, FLOW_STEPS, flowOf } from './flowBox.js';

const FACTS: JourneyFacts = {
  level: 2,
  inCollection: true,
  published: false,
  businessDescription: 'The number of credit leads we send to KBC each week.',
  keyFields: ['week_start'],
  fields: [
    { name: 'week_start', businessDescription: 'The Monday of the week.' },
    { name: 'lead_source', businessDescription: '' },
  ],
  intendedUse: 'Weekly trends.',
  pitfalls: '',
  knownGaps: 0,
  reliableSince: { from: 'day', day: '2025-01-01', why: 'Earlier weeks are incomplete.' },
  modelType: null,
  grain: [],
  mappings: 0,
  openMessages: 0,
  records: [],
};

function resource(facts: JourneyFacts, published = false): ResourceDetail {
  return {
    id: 'r2',
    displayName: 'Weekly lead volume',
    published,
    collectionId: 'c1',
    fields: [
      { name: 'week_start', dataType: 'DATE', description: '', businessDescription: 'The Monday of the week.' },
      { name: 'lead_source', dataType: 'STRING', description: '', businessDescription: '' },
    ],
    details: { modelType: 'aggregate', typeFields: [{ field: 'week_start', role: 'period' }] },
    card: { keyFields: ['week_start'], pitfalls: '', knownGaps: [], reliableSince: { from: 'day', day: '2025-01-01', why: 'Earlier weeks are incomplete.' }, dateField: null },
    journey: journeyOf(facts),
  } as unknown as ResourceDetail;
}

beforeAll(() => {
  addTexts({ nl, en });
  setLanguage('en');
});
afterAll(() => setLanguage('nl'));

describe('the Flow Box of a Resource (FR-MR-20)', () => {
  it('holds the steps required to publish, the same list as Maturity, then reading it back and publishing', () => {
    expect(FLOW_STEPS).toEqual([...REQUIRED_TO_PUBLISH, 'publish']);
    expect(FLOW_PLACES.fields).toBe('columns');
    expect(FLOW_PLACES.publish).toBeNull();
  });

  it('is read from the Resource: the step to do now is the first still open, and done steps say what they hold (DEC-UX-306)', () => {
    const flow = flowOf(resource(FACTS), { here: 'behaviour', cardTitle: (card) => (card === 'K5.16' ? 'Pitfalls' : undefined) });
    expect(flow.steps.map((step) => [step.id, step.done])).toEqual([
      ['businessDescription', true],
      ['keyFields', true],
      ['fields', true],
      ['intendedUse', true],
      ['pitfalls', false],
      ['since', true],
      ['publish', false],
    ]);
    // The Known Gaps are advised, so not a step of it (DEC-MR-21).
    expect(flow.now).toBe('pitfalls');
    expect(flow.progress).toBe('5 of 6 steps required to publish done');
    expect(flow.foot).toMatch(/^1 step to go/);
    const pitfalls = flow.steps.find((step) => step.id === 'pitfalls')!;
    expect(pitfalls).toMatchObject({ number: 5, warn: true, go: 'Write the pitfalls', card: { number: 'K5.16', title: 'Pitfalls' }, here: true });
    expect(pitfalls.why).toMatch(/You know the traps/);
    expect(flow.steps.find((step) => step.id === 'since')?.said).toBe('1 Jan 2025, on week_start');
    expect(flow.steps.find((step) => step.id === 'keyFields')?.said).toBe('week_start');
    // An advised part of a done step is said with it; a done step goes to its place to look at it.
    expect(flow.steps.find((step) => step.id === 'fields')?.said).toContain('1 other field without a Business Description');
    expect(flow.steps.find((step) => step.id === 'fields')?.go).toBe('Look at it');
    // Publishing waits for the steps above: no way to it yet.
    expect(flow.steps.at(-1)).toMatchObject({ id: 'publish', said: 'After the steps above', icon: 'globe-simple-fill' });
    expect(flow.steps.at(-1)?.go).toBeUndefined();
  });

  it('ends on publishing once every step is done, and is through once it is published', () => {
    const ready = flowOf(resource({ ...FACTS, pitfalls: 'The current week is incomplete.', knownGaps: 1 } as JourneyFacts));
    expect(ready.now).toBe('publish');
    expect(ready.ready).toBe(true);
    expect(ready.steps.at(-1)).toMatchObject({ said: 'Every step above is done', go: 'Publish' });
    expect(ready.foot).toMatch(/^Every step required to publish is done/);
    const published = flowOf(resource({ ...FACTS, pitfalls: 'x', knownGaps: 1, published: true } as JourneyFacts, true));
    expect(published.published).toBe(true);
    expect(published.now).toBeUndefined();
    expect(published.foot).toBeUndefined();
  });
});
