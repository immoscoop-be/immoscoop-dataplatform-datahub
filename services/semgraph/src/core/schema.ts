import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import type { IssueSpec } from './issues.ts';

/** JSON Schema draft 2020-12, strict, without format plugins: dates and links are checked in code. */
export function createAjv(): Ajv2020 {
  return new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
}

export type { ValidateFunction };

const MAX_SCHEMA_ISSUES = 20;

const DATA_ITEM = /^\/data\/\d+$/;

/** Turns Ajv errors into issues with plain-language codes; the messages come from the locale files. */
export function schemaIssues(errors: readonly ErrorObject[] | null | undefined, semgraph: string): IssueSpec[] {
  const issues: IssueSpec[] = [];
  const seen = new Set<string>();
  for (const error of errors ?? []) {
    const issue = toIssue(error, semgraph);
    const key = `${issue.code} ${issue.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
    if (issues.length === MAX_SCHEMA_ISSUES) break;
  }
  return issues;
}

function toIssue(error: ErrorObject, semgraph: string): IssueSpec {
  const field = error.instancePath;
  const params = error.params as Record<string, unknown>;
  const issue = (code: string, at: string, extra: IssueSpec['params'] = {}): IssueSpec => ({
    level: 'inputError',
    code,
    field: at,
    params: extra,
  });
  switch (error.keyword) {
    case 'required':
      return issue('missingField', `${field}/${String(params.missingProperty)}`);
    case 'additionalProperties': {
      const at = `${field}/${String(params.additionalProperty)}`;
      return DATA_ITEM.test(field) ? issue('unexpectedDataField', at) : issue('unexpectedField', at, { semgraph });
    }
    case 'enum':
      return issue('invalidValue', field, { allowed: (params.allowedValues as unknown[]).join(', ') });
    case 'const':
      return issue('invalidValue', field, { allowed: String(params.allowedValue) });
    case 'type':
      return issue('invalidType', field, { expected: { t: `types.${String(params.type).split(',')[0]}` } });
    case 'minimum':
      return issue('tooSmall', field, { limit: Number(params.limit) });
    case 'maximum':
      return issue('tooLarge', field, { limit: Number(params.limit) });
    case 'minLength':
      return issue('tooShort', field, { limit: Number(params.limit) });
    case 'maxLength':
      return issue('tooLong', field, { limit: Number(params.limit) });
    case 'minItems':
      return issue('tooFew', field, { limit: Number(params.limit) });
    case 'maxItems':
      return issue('tooMany', field, { limit: Number(params.limit) });
    default:
      return issue('invalidFormat', field);
  }
}
