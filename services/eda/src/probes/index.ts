import { appliesTo, levelOf, PROBES, type ProbeKey } from '@datahub/contracts/eda';
import { kindOf } from '@datahub/contracts/model-types';
import type { EdaSource } from '../catalogue.js';
import { distributionOfCategories } from './categories.js';
import { dateRange } from './daterange.js';
import { distributionOfNumbers } from './distribution.js';
import { grainHolds } from './grain.js';
import { nullsPerKeyField } from './nulls.js';
import type { ProbeSetting, RunnableProbe } from './probe.js';
import { volumeOverTime } from './volume.js';

export type { Outcome, ProbeContext, ProbeSetting, RunnableProbe } from './probe.js';
export { checkSelection, disguisedOf, isWholeTable, parseSelection } from './selection.js';
export { AnswerMismatch } from './sql.js';

/**
 * The EDA-Probes Data Hub runs, each in a module of its own, in the order of the table: the four of the first build
 * (DEC-ED-26), and Date range and Distribution of categories (FR-ED-17, FR-ED-18).
 */
export const RUNNERS: Readonly<Partial<Record<ProbeKey, RunnableProbe>>> = {
  grainHolds,
  dateRange,
  volumeOverTime,
  nullsPerKeyField,
  distributionOfNumbers,
  distributionOfCategories,
};

/** Why an EDA-Probe is not run as asked: what was asked does not fit (400), or it cannot run on this Resource (422). */
export interface SettingProblem {
  problem: 'invalid' | 'blocked';
  message: string;
}

/** Why it cannot run on a Resource, in a sentence, by what it is missing (TR-ED-02). */
const BLOCKED: Record<'noGrain' | 'noRoleDate' | 'nothing', string> = {
  noGrain: 'The grain of this Resource is not recorded yet: the Data Team records its grain first (FR-ED-07).',
  noRoleDate: 'No field of this Resource holds the date of its model type yet: the Data Admin records it first (DEC-ED-23).',
  nothing: 'This Resource has no field this EDA-Probe can be set on.',
};

/** What kind of field an EDA-Probe can be set on, and what it says of one that does not fit. */
function fitting(probe: ProbeKey): { fits: (dataType: string | null) => boolean; kind: string } {
  switch (PROBES[probe].target) {
    case 'roleDate':
      return { fits: (dataType) => kindOf(dataType) === 'date', kind: 'a date' };
    case 'numbers':
      return { fits: (dataType) => kindOf(dataType) === 'number', kind: 'a number' };
    case 'texts':
      return { fits: (dataType) => kindOf(dataType) === 'text', kind: 'a text' };
    default:
      return { fits: () => true, kind: 'a field' };
  }
}

/**
 * The fields and parameters an EDA-Probe runs with on a Resource (DEC-ED-13, DEC-ED-17): the fields given, or those it
 * applies to by default, in the order of the Resource Card. The grain holds is always set on the grain; Date range and
 * Volume over time on dates, the date its role names first; Distribution of numbers on numbers; Distribution of
 * categories on texts (DEC-ED-33); Nulls per Key Field on any field.
 */
export function settingOf(probe: ProbeKey, source: EdaSource, given: { fields?: string[]; params?: Record<string, unknown> }): ProbeSetting | SettingProblem {
  const runner = RUNNERS[probe];
  if (!runner || !PROBES[probe].runs) return { problem: 'blocked', message: `Data Hub does not run ${PROBES[probe].name} yet (OP-ED-09).` };
  if (levelOf(probe, source.resource.modelType) === null) {
    return { problem: 'blocked', message: `${PROBES[probe].name} is not offered for ${source.resource.modelType ? `a Resource of the model type ${source.resource.modelType}` : 'a Resource without a model type'} (DEC-ED-12).` };
  }
  const applies = appliesTo(probe, source.resource);
  if (applies.block === 'noGrain' || applies.block === 'noRoleDate') return { problem: 'blocked', message: BLOCKED[applies.block] };

  const order = source.resource.fields.map((field) => field.name);
  let fields: string[];
  if (given.fields === undefined) {
    fields = applies.fields;
    if (fields.length === 0) {
      return { problem: 'blocked', message: applies.block ? BLOCKED[applies.block] : 'This Resource has no Key Field this EDA-Probe applies to: choose its fields.' };
    }
  } else {
    const { fits, kind } = fitting(probe);
    for (const name of given.fields) {
      const field = source.resource.fields.find((candidate) => candidate.name === name);
      if (!field) return { problem: 'invalid', message: `${name} is no field of this Resource.` };
      if (!fits(field.dataType)) return { problem: 'invalid', message: `${name} is not ${kind}, which ${PROBES[probe].name} is set on.` };
    }
    fields = order.filter((name) => given.fields?.includes(name));
    if (fields.length === 0) return { problem: 'invalid', message: 'Choose at least one field.' };
    // The grain holds reads the grain as recorded, all of its fields together (FR-ED-07).
    if (PROBES[probe].target === 'grain' && fields.join('\n') !== applies.fields.join('\n')) {
      return { problem: 'invalid', message: `The grain holds is set on the fields of the grain: ${applies.fields.join(', ')}.` };
    }
  }

  const params = runner.params(given.params ?? {}, source, fields);
  if (typeof params === 'string') return { problem: 'invalid', message: params };
  return { fields, params };
}
