import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { DOCS_PATH, OPENAPI_PATH, openApiDocument } from '../core/openapi.ts';

/**
 * Swagger UI only loads its own files: nothing from outside, no validator, and no upgrade to https, so it
 * also works on an internal http host.
 */
const DOCS_CSP = "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'";

/**
 * REQ-084: the API in OpenAPI 3.1 on /openapi.json, and Swagger UI on /docs to read it and try it out.
 * The document is ours (static mode): the plugins only show it.
 */
export async function docsRoutes(app: FastifyInstance, { registry }: Dependencies): Promise<void> {
  const document = openApiDocument(registry);
  await app.register(swagger, { mode: 'static', specification: { document: document as never } });
  await app.register(swaggerUi, {
    routePrefix: DOCS_PATH,
    staticCSP: true,
    transformStaticCSP: () => DOCS_CSP,
    validatorUrl: false,
    // The bar with the Fastify logo and a field for another document is not needed here.
    theme: { title: 'semgraph API', css: [{ filename: 'semgraph.css', content: '.swagger-ui .topbar{display:none}' }] },
    uiConfig: { docExpansion: 'list', deepLinking: true, defaultModelsExpandDepth: 0, tryItOutEnabled: true },
  });
  app.get(OPENAPI_PATH, async () => document);
}
