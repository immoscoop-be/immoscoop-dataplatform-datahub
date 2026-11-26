import { journeyStep, REQUIRED_TO_PUBLISH } from '@datahub/contracts/journey';
import { dateFieldOf } from '@datahub/contracts/reliable';
import type { FlowStep } from '@datahub/ui/containers/FlowBox.svelte';
import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
import type { ResourceDetail } from './catalogue.js';
import { checklistOf, stepName } from './journey.js';
import type { ResourceSpot } from './routes.js';

/**
 * The steps of the Flow Box of a Resource (DEC-UX-304): the steps required to publish, the same list as its Maturity,
 * then reading it back and publishing it, which ends the flow. The Known Gaps are advised, so not in it (DEC-MR-22).
 */
export type FlowStepId = 'businessDescription' | 'keyFields' | 'fields' | 'intendedUse' | 'pitfalls' | 'since' | 'publish';
export const FLOW_STEPS: readonly FlowStepId[] = [...(REQUIRED_TO_PUBLISH as readonly Exclude<FlowStepId, 'publish'>[]), 'publish'];

/** Where each step is done: a part of the Overview or Columns; publishing opens the publication (DEC-UX-303). */
export const FLOW_PLACES: Readonly<Record<FlowStepId, ResourceSpot | null>> = {
  businessDescription: 'description',
  keyFields: 'querying',
  fields: 'columns',
  intendedUse: 'behaviour',
  pitfalls: 'behaviour',
  since: 'gaps',
  publish: null,
};

export const isFlowStep = (value: string): value is FlowStepId => (FLOW_STEPS as readonly string[]).includes(value);

/** What each step asks, why and how, and the words of its way there (DEC-UX-304, DEC-UX-305). */
const TEXTS: Readonly<Record<FlowStepId, { what: string; why: string; how: string; go: string }>> = {
  businessDescription: { what: 'flow.businessDescription.what', why: 'flow.businessDescription.why', how: 'flow.businessDescription.how', go: 'flow.go.businessDescription' },
  keyFields: { what: 'flow.keyFields.what', why: 'flow.keyFields.why', how: 'flow.keyFields.how', go: 'flow.go.keyFields' },
  fields: { what: 'flow.fields.what', why: 'flow.fields.why', how: 'flow.fields.how', go: 'flow.go.fields' },
  intendedUse: { what: 'flow.intendedUse.what', why: 'flow.intendedUse.why', how: 'flow.intendedUse.how', go: 'flow.go.intendedUse' },
  pitfalls: { what: 'flow.pitfalls.what', why: 'flow.pitfalls.why', how: 'flow.pitfalls.how', go: 'flow.go.pitfalls' },
  since: { what: 'flow.since.what', why: 'flow.since.why', how: 'flow.since.how', go: 'flow.go.since' },
  publish: { what: 'flow.publish.what', why: 'flow.publish.why', how: 'flow.publish.how', go: 'flow.go.publish' },
};

export interface FlowOf {
  steps: FlowStep[];
  /** The step to do now: the first still open, or none once it is published. */
  now: FlowStepId | undefined;
  /** How far it is, in words. */
  progress: string;
  /** What is left, under the steps. */
  foot: string | undefined;
  ready: boolean;
  published: boolean;
}

const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

/** What a step done holds, in a few words, such as "1 Jan 2025, on week_start". */
function holds(resource: ResourceDetail, id: FlowStepId): string {
  const card = resource.card;
  const none = (step: 'pitfalls') => resource.journey?.steps.find((one) => one.id === step)?.records.find((record) => record.answer === 'nothing');
  switch (id) {
    case 'keyFields':
      return card.keyFields.join(', ');
    case 'fields':
      return t('flow.done.fields');
    case 'pitfalls': {
      const said = none('pitfalls');
      return card.pitfalls || !said ? t('flow.done.written') : t('flow.done.none', { by: said.by });
    }
    case 'since': {
      const reliable = card.reliableSince;
      const on = dateFieldOf(card.dateField, resource.details.modelType, resource.details.typeFields ?? [], resource.fields).field;
      if (!reliable) return t('flow.done.written');
      const where = on ? t('reliable.on', { field: on }) : '';
      return reliable.from === 'firstRow' ? [t('reliable.firstRow'), where].filter(Boolean).join(', ') : [day(reliable.day ?? ''), where].filter(Boolean).join(', ');
    }
    default:
      return t('flow.done.written');
  }
}

/**
 * The Flow Box of a Resource, read from its state each time (DEC-UX-306): each step done or open with what it holds or
 * misses, Why, What and How, its Learning Card and the way to its place; the step to do now is the first still open.
 */
export function flowOf(resource: ResourceDetail, options: { here?: ResourceSpot | null; cardTitle?: (card: string) => string | undefined } = {}): FlowOf {
  const journey = resource.journey;
  const lines = journey ? checklistOf(journey).required : [];
  const published = resource.published;
  const ready = Boolean(journey?.ready);
  const steps: FlowStep[] = FLOW_STEPS.map((id, index) => {
    const last = id === 'publish';
    const line = lines.find((one) => one.step === id);
    const done = last ? published : (line?.done ?? false);
    const cardNumber = journeyStep(last ? 'publish' : id).cards[0];
    const title = cardNumber ? options.cardTitle?.(cardNumber) : undefined;
    const said = last ? (published ? t('flow.done.published') : ready ? t('flow.publish.ready') : t('flow.publish.after')) : done ? [holds(resource, id), line?.what].filter(Boolean).join('; ') : line?.what || t('flow.open');
    const texts = TEXTS[id];
    const go = last ? (ready && !published ? t(texts.go) : undefined) : done ? t('flow.go.look') : t(texts.go);
    return {
      id,
      name: last ? t('flow.step.publish') : stepName(id),
      said,
      done,
      ...(last ? { icon: 'globe-simple-fill' as const } : { number: index + 1 }),
      warn: !done && !last,
      what: t(texts.what),
      why: t(texts.why),
      how: t(texts.how),
      ...(cardNumber && title ? { card: { number: cardNumber, title } } : {}),
      ...(go ? { go } : {}),
      here: options.here !== undefined && options.here !== null && FLOW_PLACES[id] === options.here,
    };
  });
  const required = steps.filter((step) => step.id !== 'publish');
  const doneCount = required.filter((step) => step.done).length;
  const now = (steps.find((step) => !step.done)?.id as FlowStepId | undefined) ?? undefined;
  const open = required.length - doneCount;
  return {
    steps,
    now,
    progress: t('flow.progress', { done: doneCount, total: required.length }),
    foot: published ? undefined : open > 0 ? t('flow.foot.open', { count: open }) : t('flow.foot.ready'),
    ready,
    published,
  };
}
