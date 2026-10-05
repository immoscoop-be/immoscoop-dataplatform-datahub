import type { PipelineResult } from './pipeline.ts';

/** The part of a logger the service uses; Fastify's logger (pino) has it. */
export interface Log {
  info(object: Record<string, unknown>, message: string): void;
  warn(object: Record<string, unknown>, message: string): void;
}

/**
 * One structured line per request: which semgraph, which outcome, which issue codes. This is the
 * start of the learning loop from the analysis, without storage. Data values are never logged, and
 * neither is who asked.
 */
export function logOutcome(log: Log, action: string, result: PipelineResult): void {
  log.info(
    {
      event: `semgraph.${action}`,
      semgraph: result.report.semgraph,
      outcome: result.report.outcome,
      codes: result.report.issues.map((issue) => issue.code),
      locale: result.report.locale,
    },
    `${action} ${result.report.semgraph ?? '-'}: ${result.report.outcome}`,
  );
  if (result.warnings.length > 0) log.warn({ warnings: result.warnings }, 'Vega reported warnings');
}
