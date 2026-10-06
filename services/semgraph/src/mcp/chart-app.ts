import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../core/i18n.ts';
import type { Registry } from '../core/registry.ts';

/** REQ-092: the MCP App that shows the chart in the conversation. */
export const CHART_APP_URI = 'ui://semgraph/chart.html';

/**
 * The page of the app, self-contained: the MCP Apps SDK (its bundle with dependencies) and our script are
 * inlined, since the sandbox in Claude loads nothing from outside. There is no build step: the bundle is an
 * ES module whose final export statement becomes a plain object, `McpApps`.
 */
export async function chartAppHtml(registry: Registry): Promise<string> {
  const [template, bundle] = await Promise.all([
    readFile(new URL('./chart-app.html', import.meta.url), 'utf8'),
    readFile(fileURLToPath(import.meta.resolve('@modelcontextprotocol/ext-apps/app-with-deps')), 'utf8'),
  ]);
  const labels = Object.fromEntries(
    [...registry.locales.keys()].map((locale) => {
      const t = createTranslator(registry.locales, locale);
      return [locale, { download: t('app.download'), fullscreen: t('app.fullscreen'), notDrawn: t('app.notDrawn') }];
    }),
  );
  return template
    .replace('/*BUNDLE*/', () => inlineModule(bundle))
    .replace('/*LABELS*/null', () => JSON.stringify(labels).replace(/</g, '\\u003c'));
}

function inlineModule(bundle: string): string {
  const match = /export\s*\{([^}]*)\};?\s*$/.exec(bundle);
  if (!match || bundle.indexOf('export{') !== match.index || /<\/script/i.test(bundle)) {
    throw new Error('The MCP Apps bundle no longer has the expected form: one export statement at the end');
  }
  const members = match[1]!.split(',').map((member) => {
    const [local, exported = local] = member.trim().split(/\s+as\s+/) as [string, string?];
    return `${exported}:${local}`;
  });
  return `${bundle.slice(0, match.index)}const McpApps={${members.join(',')}};`;
}

/**
 * The origin Claude serves the app from: the first 32 hex characters of the SHA-256 of the server URL, under
 * claudemcpcontent.com. Only known when the URL of /mcp is (MCP_RESOURCE_URL).
 */
export function claudeUiDomain(serverUrl: string): string {
  return `${createHash('sha256').update(serverUrl).digest('hex').slice(0, 32)}.claudemcpcontent.com`;
}
