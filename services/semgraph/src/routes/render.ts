import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Dependencies } from '../app.ts';
import { logOutcome } from '../core/log.ts';
import { runPipeline, type PipelineResult } from '../core/pipeline.ts';

const STATUS = { ok: 200, deviation: 200, refused: 422, invalid: 400 } as const;

/** An SVG from this service may be opened directly in a browser: no scripts, no external loads. */
const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
};

export function renderRoutes(app: FastifyInstance, { registry, now }: Dependencies): void {
  app.post('/validate', async (request) => {
    const result = await runPipeline(registry, request.body, { now: now(), draw: false });
    logOutcome(request.log, 'validate', result);
    return result.report;
  });

  app.post('/render', async (request, reply) => {
    const result = await runPipeline(registry, request.body, { now: now() });
    logOutcome(request.log, 'render', result);
    return send(reply, result);
  });

  // A demo in the browser: renders one of the example requests next to the semgraph.
  app.get<{ Params: { id: string; name: string } }>('/semgraphs/:id/examples/:name', async (request, reply) => {
    const example = registry.semgraphs.get(request.params.id)?.examples.get(request.params.name);
    if (example === undefined) return reply.callNotFound();
    const result = await runPipeline(registry, example, { now: now() });
    logOutcome(request.log, 'example', result);
    return send(reply, result);
  });

  function send(reply: FastifyReply, result: PipelineResult) {
    const status = STATUS[result.report.outcome];
    if (result.svg === undefined) return reply.code(status).send(result.report);
    reply.headers({
      ...SVG_HEADERS,
      'semgraph-language-version': registry.tokens.languageVersion,
      'semgraph-tokens-version': registry.tokens.version,
      ...(result.deviations.length > 0 ? { 'semgraph-deviations': result.deviations.join(', ') } : {}),
    });
    return reply.code(status).send(result.svg);
  }
}
