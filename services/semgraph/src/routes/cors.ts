import type { FastifyInstance } from 'fastify';

/**
 * Pages on any site may call semgraph from the browser (CORS), such as the web app of Data Hub: it is
 * open to everyone and holds no data (DEC-PF-24 of Data Hub). Nothing is sent with credentials, so
 * the answer is simply "*". The browser asks first for a POST with JSON (the preflight).
 */
export function corsRoutes(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('access-control-allow-origin', '*')
      .header('access-control-expose-headers', 'Semgraph-Language-Version, Semgraph-Tokens-Version, Semgraph-Deviations');
    if (request.method === 'OPTIONS' && request.headers['access-control-request-method']) {
      return reply
        .code(204)
        .header('access-control-allow-methods', 'GET, POST')
        .header('access-control-allow-headers', 'content-type')
        .header('access-control-max-age', '600')
        .send();
    }
  });
}
