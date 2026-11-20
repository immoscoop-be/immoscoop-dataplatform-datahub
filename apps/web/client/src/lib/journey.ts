import { type Journey, type JourneyMissing, type JourneyStepId, type JourneyStepState, REQUIRED_TO_PUBLISH } from '@datahub/contracts/journey';
import { t } from '@datahub/ui/foundations/texts.svelte.js';

/** Where a step leads in the web app: a part of the Overview, or Columns (DEC-MR-16). */
export type StepPlace = 'description' | 'behaviour' | 'gaps' | 'querying' | 'entities' | 'columns';

const NAMES: Partial<Record<JourneyStepId, string>> = {
  businessDescription: 'journey.step.businessDescription',
  keyFields: 'journey.step.keyFields',
  fields: 'journey.step.fields',
  intendedUse: 'journey.step.intendedUse',
  pitfalls: 'journey.step.pitfalls',
  since: 'journey.step.since',
  gaps: 'journey.step.gaps',
  parameters: 'journey.step.parameters',
  admin: 'journey.step.admin',
  messages: 'journey.step.messages',
};

const PLACES: Partial<Record<JourneyStepId, StepPlace>> = {
  businessDescription: 'description',
  keyFields: 'querying',
  fields: 'columns',
  intendedUse: 'behaviour',
  pitfalls: 'behaviour',
  since: 'gaps',
  gaps: 'gaps',
  parameters: 'querying',
  admin: 'entities',
};

const MISSING: Partial<Record<JourneyMissing, string>> = {
  businessDescription: 'journey.missing.businessDescription',
  keyFields: 'journey.missing.keyFields',
  intendedUse: 'journey.missing.intendedUse',
  pitfalls: 'journey.missing.pitfalls',
  knownGaps: 'journey.missing.knownGaps',
  reliableSince: 'journey.missing.reliableSince',
  parameters: 'journey.missing.parameters',
  modelType: 'journey.missing.modelType',
  grain: 'journey.missing.grain',
  mappings: 'journey.missing.mappings',
  openMessages: 'journey.missing.openMessages',
};

/** The name of a step, in the language of the User. */
export const stepName = (id: JourneyStepId): string => t(NAMES[id] ?? 'journey.step.businessDescription');

/** What a step misses, in words. */
function missingText(step: JourneyStepState, missing: JourneyMissing): string {
  if (missing === 'keyFieldDescriptions') {
    return step.fieldsMissing.length > 0 ? t('journey.missing.keyFieldDescriptions', { fields: step.fieldsMissing.join(', ') }) : t('journey.missing.keyFieldsFirst');
  }
  if (missing === 'otherFieldDescriptions') return t('journey.missing.otherFieldDescriptions', { count: step.othersMissing });
  const key = MISSING[missing];
  return key ? t(key) : '';
}

export interface CheckLine {
  step: JourneyStepId;
  name: string;
  what: string;
  /** Where it is done in Data Hub, if anywhere. */
  place: StepPlace | null;
}

/** The one list of what makes a Resource ready to publish, as the publication and Maturity show it (DEC-MR-15, DEC-MR-16). */
export function checklistOf(journey: Journey) {
  const line = (step: JourneyStepState, only?: (missing: JourneyMissing) => boolean): CheckLine => ({
    step: step.id,
    name: stepName(step.id),
    what: step.missing.filter((missing) => !only || only(missing)).map((missing) => missingText(step, missing)).join('; '),
    place: PLACES[step.id] ?? null,
  });
  const required = journey.steps.filter((step) => REQUIRED_TO_PUBLISH.includes(step.id));
  return {
    ready: journey.ready,
    required: required.map((step) => ({ ...line(step), done: step.status === 'done' })),
    done: required.filter((step) => step.status === 'done').map((step) => stepName(step.id)),
    open: required.filter((step) => step.status !== 'done').map((step) => line(step)),
    advised: [
      // An advised part of a required step, such as the other fields, holds nothing up.
      ...required.filter((step) => step.status === 'done' && step.missing.length > 0).map((step) => line(step)),
      ...journey.steps.filter((step) => step.mark === 'advised' && step.status !== 'done').map((step) => line(step)),
    ],
    eda: journey.steps.filter((step) => step.mark === 'eda' && step.status !== 'done').map((step) => line(step, (missing) => missing !== 'mappings')),
  };
}
