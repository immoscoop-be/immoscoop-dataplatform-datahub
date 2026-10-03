import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { createTranslator, resolveLocale } from '../core/i18n.ts';
import { runPipeline } from '../core/pipeline.ts';
import { galleryPage, type GalleryExample } from '../core/render/gallery.ts';
import { exampleLinks } from './semgraphs.ts';

/** The page only shows our own example pictures; no scripts, nothing from outside. */
const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
};

/** REQ-083: every chart on offer with its examples, as a page to look at. The root leads there too. */
export function galleryRoutes(app: FastifyInstance, { registry, now }: Dependencies): void {
  app.get('/', async (_request, reply) => reply.redirect('/gallery'));

  app.get<{ Querystring: { locale?: string } }>('/gallery', async (request, reply) => {
    const t = createTranslator(registry.locales, resolveLocale(request.query.locale, registry.locales.keys()).locale);
    const semgraphs = await Promise.all(
      [...registry.semgraphs.values()].map(async (loaded) => ({
        id: loaded.id,
        title: t(loaded.metadata.title),
        answers: t(loaded.metadata.answers),
        icon: loaded.icon,
        links: loaded.metadata.links,
        // Whether an example is drawn or refused today, without drawing it: the page links to the picture.
        examples: await Promise.all(
          exampleLinks(loaded).map(async (link): Promise<GalleryExample> => {
            // In the language of the page, so the reason for a refusal reads in it too.
            const example = { ...(loaded.examples.get(link.name) as object), locale: t.locale };
            const { report } = await runPipeline(registry, example, { now: now(), draw: false });
            const reason = report.issues.find((issue) => issue.level === 'refusal' || issue.level === 'inputError');
            return { ...link, outcome: report.outcome, ...(reason ? { message: reason.message } : {}) };
          }),
        ),
      })),
    );
    const html = galleryPage({
      t,
      tokens: registry.tokens,
      locales: [...registry.locales.keys()].filter((locale) => locale !== t.locale),
      semgraphs,
      planned: registry.catalog.filter((entry) => entry.status === 'planned').map((entry) => entry.id),
    });
    return reply.headers(HTML_HEADERS).send(html);
  });
}
