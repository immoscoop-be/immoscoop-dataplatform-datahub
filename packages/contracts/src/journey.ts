/**
 * The Owner Journey (OP-CL-12, DEC-CL-17): the steps that take a Resource from 2 · Described to published, in one
 * order, and the one definition of when it is ready to publish (DEC-MR-15). The catalogue refuses a Publication while a
 * step required to publish is open; the publication in Data Hub, the publication in Claude and the journey through
 * Claude all show the steps from this module. Each step is marked as required to publish, needed for the EDA, or
 * advised (DEC-MR-16).
 *
 * The state comes from the Resource, never from a conversation: what its card holds, and what the Owner Unit said
 * where an empty answer is an answer, kept as a record with who and when. So a journey left halfway goes on where it
 * stopped, in any conversation, for any member of the Owner Unit.
 */

import type { SummarySource } from './summary.js';

export type JourneyStepId =
  | 'start'
  | 'data'
  | 'businessDescription'
  | 'keyFields'
  | 'fields'
  | 'intendedUse'
  | 'pitfalls'
  | 'gaps'
  | 'parameters'
  | 'admin'
  | 'messages'
  | 'publish'
  | 'after';

/** What a step asks: required to publish, needed for the EDA later, advised, or nothing of its own (DEC-MR-16). */
export type StepMark = 'required' | 'eda' | 'advised' | 'none';

/** What the Owner Unit said in a step where the card cannot tell it: gone through it, or nothing to add (DEC-MR-16). */
export type JourneyAnswer = 'goneThrough' | 'nothing';

export interface JourneyStep {
  id: JourneyStepId;
  /** Its number in the journey, from 0. */
  number: number;
  mark: StepMark;
  /** The Learning Cards that explain why the step matters, the first one first (DEC-UX-261). */
  cards: readonly string[];
  /** Where the step lives in Data Hub: the parts of the Overview, or its Columns or Messages. */
  parts: readonly SummarySource[];
  /** The tool of the MCP that writes its answer, if any. */
  writes: string | null;
  /** The answers the Owner Unit may record for it. */
  answers: readonly JourneyAnswer[];
  /** What it is, in English, as Claude reads it. */
  name: string;
}

/** The steps, in the order of the journey (OP-CL-12): the Key Fields before the fields, so that theirs come first. */
export const JOURNEY_STEPS: readonly JourneyStep[] = [
  { id: 'start', number: 0, mark: 'none', cards: ['K5.12', '4.7.1'], parts: ['maturity'], writes: null, answers: [], name: 'Start' },
  { id: 'data', number: 1, mark: 'none', cards: ['K5.1', '2.3.5'], parts: ['description'], writes: null, answers: ['goneThrough'], name: 'Know the data' },
  { id: 'businessDescription', number: 2, mark: 'required', cards: ['K5.14'], parts: ['description'], writes: 'update_resource_card', answers: [], name: 'Business Description' },
  { id: 'keyFields', number: 3, mark: 'required', cards: ['K5.15'], parts: ['querying'], writes: 'update_resource_card', answers: [], name: 'Key Fields' },
  { id: 'fields', number: 4, mark: 'required', cards: ['K5.14'], parts: ['columns'], writes: 'describe_fields', answers: ['goneThrough'], name: 'Fields' },
  { id: 'intendedUse', number: 5, mark: 'required', cards: ['3.3.3'], parts: ['behaviour'], writes: 'update_resource_card', answers: [], name: 'Intended use' },
  { id: 'pitfalls', number: 6, mark: 'required', cards: ['K5.16'], parts: ['behaviour'], writes: 'update_resource_card', answers: ['nothing'], name: 'Pitfalls' },
  { id: 'gaps', number: 7, mark: 'required', cards: ['K5.3', 'K5.17'], parts: ['gaps', 'behaviour'], writes: 'add_known_gap and update_resource_card', answers: ['nothing'], name: 'Known Gaps and reliable since' },
  { id: 'parameters', number: 8, mark: 'advised', cards: ['K5.15'], parts: ['querying'], writes: 'update_resource_card', answers: ['nothing'], name: 'Parameters' },
  { id: 'admin', number: 9, mark: 'eda', cards: ['2.3.6', 'K5.18'], parts: ['entities'], writes: 'write_message', answers: ['goneThrough'], name: 'Table type, grain and mappings' },
  { id: 'messages', number: 10, mark: 'advised', cards: ['4.7.1'], parts: ['messages'], writes: 'reply_to_message', answers: ['goneThrough'], name: 'Open Questions and Signals' },
  { id: 'publish', number: 11, mark: 'required', cards: ['K5.13', 'K5.2'], parts: ['maturity'], writes: 'publish_resource', answers: [], name: 'Read it back and publish' },
  { id: 'after', number: 12, mark: 'none', cards: ['K5.19', 'K5.2'], parts: ['maturity'], writes: null, answers: [], name: 'After' },
];

export const JOURNEY_STEP_IDS: readonly JourneyStepId[] = JOURNEY_STEPS.map((step) => step.id);

/** The steps that must be done before a Resource may be published (DEC-MR-16); reading back happens in the publication. */
export const REQUIRED_TO_PUBLISH: readonly JourneyStepId[] = ['businessDescription', 'keyFields', 'fields', 'intendedUse', 'pitfalls', 'gaps'];

/** What the Owner Unit said in a step, with who and when. */
export interface JourneyRecord {
  step: JourneyStepId;
  answer: JourneyAnswer;
  by: string;
  /** When, as an ISO date and time. */
  at: string;
}

/** What the journey reads from a Resource: its card, what the Data Admin recorded, and the records of the journey. */
export interface JourneyFacts {
  level: number;
  inCollection: boolean;
  published: boolean;
  businessDescription: string;
  keyFields: readonly string[];
  /** Every field, with its Business Description; empty when it has none. */
  fields: readonly { name: string; businessDescription: string }[];
  intendedUse: string;
  pitfalls: string;
  knownGaps: number;
  /** A day, `YYYY-MM-DD`, or null. */
  reliableSince: string | null;
  parameters: readonly string[];
  modelType: string | null;
  grain: readonly string[];
  /** The fields mapped to an Entity. */
  mappings: number;
  /** The Questions and Signals on it that are not closed. */
  openMessages: number;
  records: readonly JourneyRecord[];
}

/** Why a step is not done yet, in words each client phrases itself. */
export type JourneyMissing =
  | 'collection'
  | 'described'
  | 'businessDescription'
  | 'keyFields'
  | 'keyFieldDescriptions'
  | 'otherFieldDescriptions'
  | 'intendedUse'
  | 'pitfalls'
  | 'knownGaps'
  | 'reliableSince'
  | 'parameters'
  | 'modelType'
  | 'grain'
  | 'mappings'
  | 'openMessages'
  | 'published';

export interface JourneyStepState extends JourneyStep {
  /** Done: what it asks is on the card, or the Owner Unit answered; blocked: an earlier step must come first. */
  status: 'done' | 'open' | 'blocked';
  /** Gone through: done, or the Owner Unit passed it on purpose, such as an advised step left for later. */
  passed: boolean;
  /** What is missing; for an advised part of a required step, such as the other fields, it does not hold it up. */
  missing: JourneyMissing[];
  /** The Key Fields without a Business Description, for the step Fields. */
  fieldsMissing: string[];
  /** The other fields without a Business Description, advised. */
  othersMissing: number;
  /** What the Owner Unit said in this step, the newest of each answer. */
  records: JourneyRecord[];
}

export interface Journey {
  steps: JourneyStepState[];
  /** The one step that is next. */
  next: JourneyStepId;
  /** Ready to publish: in a Collection, Described, not published, and every step required to publish done (DEC-MR-15). */
  ready: boolean;
  /** The steps required to publish that are still open, in the order of the journey. */
  open: JourneyStepId[];
}

const filled = (text: string) => text.trim() !== '';

/** The state of the journey of a Resource, from its facts: the one definition of ready to publish (DEC-MR-15). */
export function journeyOf(facts: JourneyFacts): Journey {
  const said = (step: JourneyStepId, answer: JourneyAnswer) => facts.records.some((record) => record.step === step && record.answer === answer);
  const described = new Map(facts.fields.map((field) => [field.name, filled(field.businessDescription)]));
  const keyFieldsMissing = facts.keyFields.filter((name) => !described.get(name));
  const othersMissing = facts.fields.filter((field) => !facts.keyFields.includes(field.name) && !filled(field.businessDescription)).length;

  const missingOf = (id: JourneyStepId): JourneyMissing[] => {
    switch (id) {
      case 'start':
        return [...(facts.inCollection ? [] : ['collection' as const]), ...(facts.level >= 2 ? [] : ['described' as const])];
      case 'data':
        return [];
      case 'businessDescription':
        return filled(facts.businessDescription) ? [] : ['businessDescription'];
      case 'keyFields':
        return facts.keyFields.length > 0 ? [] : ['keyFields'];
      case 'fields':
        return [...(facts.keyFields.length > 0 && keyFieldsMissing.length === 0 ? [] : ['keyFieldDescriptions' as const]), ...(othersMissing > 0 ? ['otherFieldDescriptions' as const] : [])];
      case 'intendedUse':
        return filled(facts.intendedUse) ? [] : ['intendedUse'];
      case 'pitfalls':
        return filled(facts.pitfalls) || said('pitfalls', 'nothing') ? [] : ['pitfalls'];
      case 'gaps':
        return [...(facts.knownGaps > 0 || said('gaps', 'nothing') ? [] : ['knownGaps' as const]), ...(facts.reliableSince ? [] : ['reliableSince' as const])];
      case 'parameters':
        return facts.parameters.length > 0 || said('parameters', 'nothing') ? [] : ['parameters'];
      case 'admin':
        return [...(facts.modelType ? [] : ['modelType' as const]), ...(facts.grain.length > 0 ? [] : ['grain' as const]), ...(facts.mappings > 0 ? [] : ['mappings' as const])];
      case 'messages':
        return facts.openMessages > 0 ? ['openMessages'] : [];
      case 'publish':
      case 'after':
        return facts.published ? [] : ['published'];
    }
  };

  // What makes a step done: for the step Fields, the Key Fields described, the others being advised; for what the
  // Data Admin records, the table type and the grain the EDA needs, the mappings being advised.
  const doneOf = (id: JourneyStepId, missing: JourneyMissing[]): boolean => {
    switch (id) {
      case 'data':
        return said('data', 'goneThrough');
      case 'fields':
        return !missing.includes('keyFieldDescriptions');
      case 'admin':
        return !missing.includes('modelType') && !missing.includes('grain');
      default:
        return missing.length === 0;
    }
  };

  const opening = missingOf('start');
  const steps: JourneyStepState[] = JOURNEY_STEPS.map((step) => {
    const missing = missingOf(step.id);
    const done = doneOf(step.id, missing);
    const blocked =
      !done &&
      ((step.id !== 'start' && opening.length > 0 && !facts.published) ||
        (step.id === 'fields' && facts.keyFields.length === 0) ||
        (step.id === 'after' && !facts.published));
    const records = step.answers.flatMap((answer) => {
      const newest = facts.records.filter((record) => record.step === step.id && record.answer === answer).sort((a, b) => b.at.localeCompare(a.at))[0];
      return newest ? [newest] : [];
    });
    return {
      ...step,
      status: done ? 'done' : blocked ? 'blocked' : 'open',
      // An advised step, or one needed only for the EDA, is passed once the Owner Unit went through it.
      passed: done || (step.mark !== 'required' && records.length > 0),
      missing,
      fieldsMissing: step.id === 'fields' ? keyFieldsMissing : [],
      othersMissing: step.id === 'fields' ? othersMissing : 0,
      records,
    };
  });

  const open = steps.filter((step) => REQUIRED_TO_PUBLISH.includes(step.id) && step.status !== 'done').map((step) => step.id);
  const ready = facts.inCollection && facts.level >= 2 && !facts.published && open.length === 0;
  const next: JourneyStepId = facts.published
    ? 'after'
    : opening.length > 0
      ? 'start'
      : (steps.find((step) => !['start', 'publish', 'after'].includes(step.id) && !step.passed)?.id ?? 'publish');
  return { steps, next, ready, open };
}

/** The step, by its id. */
export const journeyStep = (id: JourneyStepId): JourneyStep => JOURNEY_STEPS.find((step) => step.id === id) as JourneyStep;

/** Whether a value is a step of the journey. */
export const isJourneyStep = (value: unknown): value is JourneyStepId => typeof value === 'string' && (JOURNEY_STEP_IDS as readonly string[]).includes(value);
