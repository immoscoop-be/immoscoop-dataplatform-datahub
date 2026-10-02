import type { Translator } from './i18n.ts';

/**
 * inputError: the request is not valid (400).
 * refusal: the chart would mislead, so it is not drawn (422).
 * deviation: tolerated deviation from the chart language; drawn with a note in the footer.
 * info: nothing is wrong, but the caller should know what the service did.
 */
export type IssueLevel = 'inputError' | 'refusal' | 'deviation' | 'info';

export type Outcome = 'ok' | 'deviation' | 'refused' | 'invalid';

/** A parameter is shown as is, or translated when given as `{ t: key, params }`. */
export type IssueParam = string | number | { t: string; params?: Record<string, string | number> };

/** An issue as the rules produce it: a code with parameters, independent of the language. */
export interface IssueSpec {
  level: IssueLevel;
  code: string;
  /** JSON pointer into the request, e.g. "/window". */
  field?: string;
  params?: Record<string, IssueParam>;
  learnMore?: string;
}

/** An issue as the caller receives it: in plain language, in the requested locale. */
export interface Issue {
  level: IssueLevel;
  code: string;
  field?: string;
  message: string;
  alternative?: string;
  learnMore?: string;
}

export function outcomeOf(issues: readonly IssueSpec[]): Outcome {
  if (issues.some((issue) => issue.level === 'inputError')) return 'invalid';
  if (issues.some((issue) => issue.level === 'refusal')) return 'refused';
  if (issues.some((issue) => issue.level === 'deviation')) return 'deviation';
  return 'ok';
}

export function localizeParams(
  t: Translator,
  params: Record<string, IssueParam> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    result[name] = typeof value === 'object' ? t(value.t, value.params) : value;
  }
  return result;
}

export function localizeIssue(t: Translator, spec: IssueSpec): Issue {
  const params = {
    ...(spec.field === undefined ? {} : { field: displayField(spec.field) }),
    ...localizeParams(t, spec.params),
  };
  const alternativeKey = `issues.${spec.code}.alternative`;
  return {
    level: spec.level,
    code: spec.code,
    ...(spec.field === undefined ? {} : { field: spec.field }),
    message: t(`issues.${spec.code}.message`, params),
    ...(t.has(alternativeKey) ? { alternative: t(alternativeKey, params) } : {}),
    ...(spec.learnMore === undefined ? {} : { learnMore: spec.learnMore }),
  };
}

/** "/data/3/value" -> "data[3].value", as shown in messages. */
export function displayField(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((path, part) => (/^\d+$/.test(part) ? `${path}[${part}]` : path ? `${path}.${part}` : part), '');
}
