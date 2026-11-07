import type { Translator } from '../i18n.ts';
import { DOCS_PATH } from '../openapi.ts';
import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';

/** One example as the gallery shows it: drawn, or refused with the reason. */
export interface GalleryExample {
  name: string;
  title: string;
  href: string;
  outcome: 'ok' | 'deviation' | 'refused' | 'invalid';
  /** The first refusal or input error, in the words of the locale. */
  message?: string;
  /** REQ-107: the same chart in another size or mode: a row per mode, a link per size. */
  variants?: { label: string; links: { label: string; href: string }[] }[];
}

export interface GallerySemgraph {
  id: string;
  title: string;
  answers: string;
  /** The inside of the semgraph's icon (REQ-060), from our own files. */
  icon: string;
  links: { figma: string; learning: string };
  examples: GalleryExample[];
}

export interface GalleryInput {
  t: Translator;
  tokens: Tokens;
  /** The other locales, to switch to. */
  locales: string[];
  semgraphs: GallerySemgraph[];
  planned: string[];
}

/**
 * REQ-083: one page with every chart the service offers and all of its examples. Each example is a
 * picture that links to the chart itself, where hover and links work (a picture in an img has neither).
 * A refused example shows why. No scripts and nothing from outside: the page lives under a strict CSP.
 */
export function galleryPage({ t, tokens, locales, semgraphs, planned }: GalleryInput): string {
  const text = color(tokens, 'text');
  const muted = color(tokens, 'text/muted');
  const line = color(tokens, 'context/light');
  const link = color(tokens, 'focus/dark');
  const style = [
    `body{margin:0;background:${color(tokens, 'surface')};color:${text};font-family:${tokens.font.body};font-size:14px;line-height:1.5}`,
    'main{max-width:1360px;margin:0 auto;padding:24px 20px 48px}',
    `h1,h2{font-family:${tokens.font.title};font-weight:600;margin:0}`,
    'h1{font-size:24px}h2{font-size:18px}',
    `a{color:${link};text-decoration:none}a:hover,a:focus-visible{text-decoration:underline}`,
    `header p,.answers,.meta,figcaption{color:${muted}}`,
    `nav{display:flex;flex-wrap:wrap;gap:4px 16px;margin:8px 0 0}`,
    `section{border-top:1px solid ${line};padding:28px 0 8px;margin-top:28px}`,
    '.head{display:flex;gap:14px;align-items:flex-start}',
    `.head svg{flex:none;color:${muted}}`,
    '.answers{margin:2px 0 0;font-style:italic}',
    'code{font-family:' + tokens.font.mono + ';font-size:12px}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-top:18px}',
    `figure{margin:0;border:1px solid ${line};border-radius:6px;padding:10px;background:${color(tokens, 'surface')}}`,
    'figure img{display:block;width:100%;height:auto}',
    'figcaption{margin-top:8px;font-size:13px}',
    '.variants{margin:6px 0 0;font-size:12px}.variants div{display:flex;flex-wrap:wrap;gap:0 10px}.variants span{min-width:52px}',
    `.refused{display:flex;align-items:center;min-height:120px;padding:12px;border-radius:4px;background:${color(tokens, 'badge/surface')};color:${text};font-size:13px}`,
    `.badge{display:inline-block;margin-left:6px;padding:0 6px;border-radius:3px;background:${color(tokens, 'badge/surface')};color:${color(tokens, 'badge/text')};font-size:12px}`,
  ].join('');

  const count = semgraphs.reduce((sum, semgraph) => sum + semgraph.examples.length, 0);
  const sections = semgraphs.map((semgraph) => {
    const examples = semgraph.examples.map((example) => {
      const caption = `${escapeXml(example.title)}<br><code>${escapeXml(example.name)}</code>${example.outcome === 'ok' ? '' : `<span class="badge">${escapeXml(t(`gallery.outcome.${example.outcome}`))}</span>`}`;
      const picture = example.outcome === 'ok' || example.outcome === 'deviation'
        ? `<a href="${escapeXml(example.href)}"><img src="${escapeXml(example.href)}" alt="${escapeXml(example.title)}" loading="lazy"></a>`
        : `<a class="refused" href="${escapeXml(example.href)}">${escapeXml(example.message ?? t(`gallery.outcome.${example.outcome}`))}</a>`;
      // REQ-107: under the picture, the chart in every size, light and dark.
      const variants = example.variants?.length
        ? `<div class="variants">${example.variants
            .map((row) => `<div><span>${escapeXml(row.label)}</span>${row.links.map((link) => `<a href="${escapeXml(link.href)}">${escapeXml(link.label)}</a>`).join('')}</div>`)
            .join('')}</div>`
        : '';
      return `<figure>${picture}<figcaption>${caption}${variants}</figcaption></figure>`;
    });
    return [
      `<section id="${escapeXml(semgraph.id)}">`,
      '<div class="head">',
      `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">${semgraph.icon}</svg>`,
      '<div>',
      `<h2>${escapeXml(semgraph.title)} <code>${escapeXml(semgraph.id)}</code></h2>`,
      `<p class="answers">${escapeXml(semgraph.answers)}</p>`,
      '<nav class="meta">',
      `<span>${escapeXml(t('gallery.examples', { count: semgraph.examples.length }))}</span>`,
      `<a href="/semgraphs/${escapeXml(semgraph.id)}">${escapeXml(t('gallery.contract'))}</a>`,
      `<a href="${escapeXml(semgraph.links.figma)}">Figma</a>`,
      `<a href="${escapeXml(semgraph.links.learning)}">${escapeXml(t('gallery.readingCard'))}</a>`,
      '</nav>',
      '</div>',
      '</div>',
      `<div class="grid">${examples.join('')}</div>`,
      '</section>',
    ].join('');
  });

  return [
    '<!doctype html>',
    `<html lang="${escapeXml(t.locale)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeXml(t('gallery.title'))}</title>`,
    `<style>${style}</style>`,
    '</head>',
    '<body><main>',
    '<header>',
    `<h1>${escapeXml(t('gallery.title'))}</h1>`,
    `<p>${escapeXml(t('gallery.intro', { semgraphs: semgraphs.length, examples: count }))}</p>`,
    '<nav>',
    ...semgraphs.map((semgraph) => `<a href="#${escapeXml(semgraph.id)}">${escapeXml(semgraph.title)}</a>`),
    '</nav>',
    '<nav class="meta">',
    `<a href="/semgraphs?locale=${escapeXml(t.locale)}">${escapeXml(t('gallery.json'))}</a>`,
    `<a href="${DOCS_PATH}">${escapeXml(t('gallery.api'))}</a>`,
    ...locales.map((locale) => `<a href="/gallery?locale=${escapeXml(locale)}" hreflang="${escapeXml(locale)}">${escapeXml(t(`gallery.language.${locale}`))}</a>`),
    '</nav>',
    '</header>',
    ...sections,
    planned.length > 0
      ? `<section id="planned"><h2>${escapeXml(t('gallery.planned'))}</h2><p class="answers">${escapeXml(t('gallery.plannedNote'))}</p><p>${planned.map((id) => `<code>${escapeXml(id)}</code>`).join(' · ')}</p></section>`
      : '',
    '</main></body>',
    '</html>',
  ].join('\n');
}
