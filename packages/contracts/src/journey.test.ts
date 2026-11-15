import { describe, expect, it } from 'vitest';
import { JOURNEY_STEPS, journeyOf, REQUIRED_TO_PUBLISH, type JourneyFacts } from './journey.js';

/** The test case of the brief: Search Console impressions, Described, not published, two texts written before. */
const SEARCH_CONSOLE: JourneyFacts = {
  level: 2,
  inCollection: true,
  published: false,
  businessDescription: '',
  keyFields: [],
  fields: ['data_date', 'query', 'search_type', 'impressions', 'clicks', 'country'].map((name) => ({ name, businessDescription: '' })),
  intendedUse: 'The trend of our organic search visibility.',
  pitfalls: 'Do not average the position.',
  knownGaps: 0,
  reliableSince: null,
  parameters: [],
  modelType: null,
  grain: [],
  mappings: 0,
  openMessages: 1,
  records: [],
};

const FILLED: JourneyFacts = {
  ...SEARCH_CONSOLE,
  businessDescription: 'How often our site appears in Google.',
  keyFields: ['data_date', 'impressions'],
  fields: SEARCH_CONSOLE.fields.map((field) => (['data_date', 'impressions'].includes(field.name) ? { ...field, businessDescription: 'Described.' } : field)),
  knownGaps: 1,
  reliableSince: '2025-03-01',
};

const status = (facts: JourneyFacts) => Object.fromEntries(journeyOf(facts).steps.map((step) => [step.id, step.status]));

describe('the Owner Journey (OP-CL-12)', () => {
  it('has thirteen steps in one order, the Key Fields before the fields, each with its mark and its Learning Card', () => {
    expect(JOURNEY_STEPS.map((step) => `${step.number} ${step.id}`)).toEqual([
      '0 start', '1 data', '2 businessDescription', '3 keyFields', '4 fields', '5 intendedUse', '6 pitfalls', '7 gaps', '8 parameters', '9 admin', '10 messages', '11 publish', '12 after',
    ]);
    expect(JOURNEY_STEPS.filter((step) => step.mark === 'required').map((step) => step.id)).toEqual([...REQUIRED_TO_PUBLISH, 'publish']);
    expect(JOURNEY_STEPS.find((step) => step.id === 'admin')?.mark).toBe('eda');
    expect(JOURNEY_STEPS.every((step) => step.cards.length > 0)).toBe(true);
  });

  it('is not ready while a step required to publish is open, and says which, in the order of the journey (DEC-MR-15, DEC-MR-16)', () => {
    const journey = journeyOf(SEARCH_CONSOLE);
    expect(journey.ready).toBe(false);
    expect(journey.open).toEqual(['businessDescription', 'keyFields', 'fields', 'gaps']);
    expect(journey.next).toBe('data');
    // The step Fields waits for the Key Fields.
    expect(status(SEARCH_CONSOLE).fields).toBe('blocked');
    // The texts written before count: the declaration accepts them (DEC-MR-17).
    expect(status(SEARCH_CONSOLE).intendedUse).toBe('done');
    expect(status(SEARCH_CONSOLE).pitfalls).toBe('done');
  });

  it('is ready once every required step is done; advised steps and what the EDA needs hold nothing up', () => {
    const journey = journeyOf(FILLED);
    expect(journey.open).toEqual([]);
    expect(journey.ready).toBe(true);
    const fields = journey.steps.find((step) => step.id === 'fields');
    expect(fields).toMatchObject({ status: 'done', fieldsMissing: [], othersMissing: 4, missing: ['otherFieldDescriptions'] });
    expect(status(FILLED)).toMatchObject({ parameters: 'open', admin: 'open', messages: 'open', publish: 'open' });
  });

  it('takes "nothing to add" as an answer where none is one, with who and when (DEC-MR-16)', () => {
    const empty: JourneyFacts = { ...FILLED, pitfalls: '', knownGaps: 0 };
    expect(journeyOf(empty).open).toEqual(['pitfalls', 'gaps']);
    const said: JourneyFacts = {
      ...empty,
      records: [
        { step: 'pitfalls', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:00:00Z' },
        { step: 'gaps', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:01:00Z' },
      ],
    };
    const journey = journeyOf(said);
    expect(journey.ready).toBe(true);
    expect(journey.steps.find((step) => step.id === 'pitfalls')?.records).toEqual([{ step: 'pitfalls', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:00:00Z' }]);
    // Reliable since is no answer of "nothing": the gaps need a date as well.
    expect(journeyOf({ ...said, reliableSince: null }).open).toEqual(['gaps']);
  });

  it('a Key Field without a Business Description keeps the step Fields open, and names it', () => {
    const journey = journeyOf({ ...FILLED, keyFields: ['data_date', 'clicks'] });
    expect(journey.open).toEqual(['fields']);
    expect(journey.steps.find((step) => step.id === 'fields')?.fieldsMissing).toEqual(['clicks']);
  });

  it('goes on where it stopped: the next step is the first not gone through, an advised one passed on purpose', () => {
    expect(journeyOf({ ...FILLED, records: [{ step: 'data', answer: 'goneThrough', by: 'An', at: '2026-11-12T09:00:00Z' }] }).next).toBe('parameters');
    const passed: JourneyFacts = {
      ...FILLED,
      records: ['data', 'admin', 'messages'].map((step) => ({ step: step as 'data', answer: 'goneThrough' as const, by: 'An', at: '2026-11-12T09:00:00Z' })).concat([{ step: 'parameters' as 'data', answer: 'nothing' as 'goneThrough', by: 'An', at: '2026-11-12T09:00:00Z' }]),
    };
    expect(journeyOf(passed).next).toBe('publish');
    expect(journeyOf({ ...passed, published: true }).next).toBe('after');
  });

  it('starts nowhere before the Resource is in a Collection and Described', () => {
    const journey = journeyOf({ ...FILLED, level: 1 });
    expect(journey.ready).toBe(false);
    expect(journey.next).toBe('start');
    expect(journey.steps[0]).toMatchObject({ status: 'open', missing: ['described'] });
    expect(journey.steps.find((step) => step.id === 'businessDescription')?.status).toBe('done');
    expect(journeyOf({ ...FILLED, inCollection: false }).steps[0]?.missing).toEqual(['collection']);
  });
});
