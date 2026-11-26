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
  reliableSince: { from: 'day', day: '2025-03-01', why: 'February 2025 was a test of the export.' },
};

const status = (facts: JourneyFacts) => Object.fromEntries(journeyOf(facts).steps.map((step) => [step.id, step.status]));

describe('the Owner Journey (OP-CL-12)', () => {
  it('has fourteen steps in one order, the Key Fields before the fields, Reliable since before the gaps, each with its mark and its Learning Card', () => {
    expect(JOURNEY_STEPS.map((step) => `${step.number} ${step.id}`)).toEqual([
      '0 start', '1 data', '2 businessDescription', '3 keyFields', '4 fields', '5 intendedUse', '6 pitfalls', '7 since', '8 gaps', '9 admin', '10 messages', '11 publish', '12 after',
    ]);
    expect(JOURNEY_STEPS.filter((step) => step.mark === 'required').map((step) => step.id)).toEqual([...REQUIRED_TO_PUBLISH, 'publish']);
    expect(JOURNEY_STEPS.find((step) => step.id === 'admin')?.mark).toBe('eda');
    // The Known Gaps are advised, not required (DEC-MR-22).
    expect(JOURNEY_STEPS.find((step) => step.id === 'gaps')).toMatchObject({ mark: 'advised', answers: ['goneThrough'] });
    expect(JOURNEY_STEPS.every((step) => step.cards.length > 0)).toBe(true);
  });

  it('is not ready while a step required to publish is open, and says which, in the order of the journey (DEC-MR-15, DEC-MR-16)', () => {
    const journey = journeyOf(SEARCH_CONSOLE);
    expect(journey.ready).toBe(false);
    expect(journey.open).toEqual(['businessDescription', 'keyFields', 'fields', 'since']);
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
    expect(status(FILLED)).toMatchObject({ admin: 'open', messages: 'open', publish: 'open' });
  });

  it('takes "nothing to add" as an answer to the pitfalls, with who and when (DEC-MR-16)', () => {
    const empty: JourneyFacts = { ...FILLED, pitfalls: '', knownGaps: 0 };
    expect(journeyOf(empty).open).toEqual(['pitfalls']);
    const said: JourneyFacts = {
      ...empty,
      records: [{ step: 'pitfalls', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:00:00Z' }],
    };
    const journey = journeyOf(said);
    expect(journey.ready).toBe(true);
    expect(journey.steps.find((step) => step.id === 'pitfalls')?.records).toEqual([{ step: 'pitfalls', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:00:00Z' }]);
    // Reliable since is a step of its own, and "nothing" is no answer to it (DEC-MR-18).
    expect(journeyOf({ ...said, reliableSince: null }).open).toEqual(['since']);
  });

  it('publishes a Resource without a Known Gap: the gaps are advised, and Claude records that the Owner went through them (DEC-MR-22)', () => {
    const none: JourneyFacts = { ...FILLED, knownGaps: 0 };
    const journey = journeyOf(none);
    expect(journey.ready).toBe(true);
    expect(journey.steps.find((step) => step.id === 'gaps')).toMatchObject({ mark: 'advised', status: 'open', passed: false, missing: ['knownGaps'] });
    const through = journeyOf({ ...none, records: [{ step: 'gaps', answer: 'goneThrough', by: 'An Claes', at: '2026-11-21T10:00:00Z' }] });
    expect(through.steps.find((step) => step.id === 'gaps')).toMatchObject({ passed: true });
    expect(through.next).not.toBe('gaps');
    // "Nothing to add", said before, still counts.
    const before = journeyOf({ ...none, records: [{ step: 'gaps', answer: 'nothing', by: 'An Claes', at: '2026-11-15T10:01:00Z' }] });
    expect(before.steps.find((step) => step.id === 'gaps')).toMatchObject({ status: 'done', missing: [] });
  });

  it('takes From its first row as Reliable since, and not set as neither (FR-RC-31)', () => {
    const since = (reliableSince: JourneyFacts['reliableSince']) => journeyOf({ ...FILLED, reliableSince }).steps.find((step) => step.id === 'since');
    expect(since({ from: 'firstRow', day: null, why: '' })).toMatchObject({ status: 'done', missing: [] });
    expect(since(null)).toMatchObject({ status: 'open', missing: ['reliableSince'] });
  });

  it('a Key Field without a Business Description keeps the step Fields open, and names it', () => {
    const journey = journeyOf({ ...FILLED, keyFields: ['data_date', 'clicks'] });
    expect(journey.open).toEqual(['fields']);
    expect(journey.steps.find((step) => step.id === 'fields')?.fieldsMissing).toEqual(['clicks']);
  });

  it('goes on where it stopped: the next step is the first not gone through, an advised one passed on purpose', () => {
    expect(journeyOf({ ...FILLED, records: [{ step: 'data', answer: 'goneThrough', by: 'An', at: '2026-11-12T09:00:00Z' }] }).next).toBe('admin');
    const passed: JourneyFacts = {
      ...FILLED,
      records: ['data', 'admin', 'messages'].map((step) => ({ step: step as 'data', answer: 'goneThrough' as const, by: 'An', at: '2026-11-12T09:00:00Z' })),
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
