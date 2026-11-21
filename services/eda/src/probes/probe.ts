import type { DataHubReading, ProbeKey, ProbeResult } from '@datahub/contracts/eda';
import type { EdaSource } from '../catalogue.js';

/** What a run of an EDA-Probe is set on: its fields, in the order of the Resource Card, and its parameters (DEC-ED-17). */
export interface ProbeSetting {
  fields: string[];
  params: Record<string, unknown>;
}

/** Everything an EDA-Probe needs to write its SQL and read its answer. */
export interface ProbeContext extends ProbeSetting {
  source: EdaSource;
  /** Today, `YYYY-MM-DD`, in the time zone of Immoscoop: what makes a period current (DEC-ED-23). */
  today: string;
}

/** The result of a run for one subject, the table as a whole ('') or a field, with Data Hub's reading (FR-ED-11). */
export interface Outcome {
  subject: string;
  data: ProbeResult;
  reading: DataHubReading;
}

/** An EDA-Probe Data Hub runs (DEC-ED-26): its parameters, its SQL and how its answer becomes results (TR-ED-03). */
export interface RunnableProbe {
  key: ProbeKey;
  /** Its parameters from a request, as kept; a string says what does not fit. */
  params(given: Record<string, unknown>, source: EdaSource, fields: string[]): Record<string, unknown> | string;
  /** One `SELECT` over its table that returns aggregates only, never rows of the table. */
  sql(context: ProbeContext): string;
  /** The answer of query as results, per subject, in the order of the Resource Card. */
  results(rows: readonly Record<string, unknown>[], context: ProbeContext): Outcome[];
}

/** A probe without parameters of its own: only `{}` fits. */
export function noParams(given: Record<string, unknown>): Record<string, unknown> | string {
  const unknown = Object.keys(given)[0];
  return unknown === undefined ? {} : `This EDA-Probe has no parameter ${unknown}.`;
}
