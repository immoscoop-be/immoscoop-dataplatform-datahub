import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

/** A file of the built page, kept in memory: the build is small and never changes while running. */
export interface ClientFile {
  body: Buffer;
  type: string;
  /** Vite names the files in `assets/` after their content, so they can be cached for good. */
  immutable: boolean;
}

/** The page of the web app as Vite built it (`client/`, into `dist/client`). */
export interface Client {
  /** The page with the addresses of the services and the nonce for its styles. */
  page(nonce: string): string;
  /** Every other file but the icons, by the path it is served at, such as `/assets/index-1a2b3c.js`. */
  files: ReadonlyMap<string, ClientFile>;
  /**
   * The drawing of an icon of a Collection, `icons/<name>.svg` (DEC-CO-14), or nothing when there is
   * no such icon. There are some 4,800, so each is read from disk the first time it is asked for, then
   * kept: reading them all at start-up, each as a route of its own, made the server too slow to start.
   */
  icon(file: string): Promise<Buffer | undefined>;
}

/** The folder of the drawings of the icons, and the names of its files. */
const ICONS = 'icons';
const ICON_FILE = /^[a-z0-9-]+\.svg$/;

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Reads the built page once, at start-up. The page gets the addresses of identity, catalogue, registry and semgraph in
 * data attributes and, per request, the nonce that lets Mantine add its `<style>` elements: the page
 * itself holds no script and no style of its own.
 */
export async function loadClient(dir: string, services: { identityUrl: string; catalogueUrl: string; registryUrl: string; semgraphUrl: string }): Promise<Client> {
  const template = await readFile(join(dir, 'index.html'), 'utf8');
  const opening = '<html lang="en">';
  if (!template.includes(opening) || !template.includes('</head>')) {
    throw new Error(`${join(dir, 'index.html')} is not the page Vite builds from client/index.html.`);
  }
  const withServices = template.replace(
    opening,
    `<html lang="en" data-identity="${escapeAttribute(services.identityUrl)}" data-catalogue="${escapeAttribute(services.catalogueUrl)}" data-registry="${escapeAttribute(services.registryUrl)}" data-semgraph="${escapeAttribute(services.semgraphUrl)}">`,
  );

  const files = new Map<string, ClientFile>();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    const type = TYPES[extname(entry.name)];
    if (!entry.isFile() || path === join(dir, 'index.html') || !type) {
      continue;
    }
    const served = `/${relative(dir, path).split(sep).join('/')}`;
    if (served.startsWith(`/${ICONS}/`)) {
      continue;
    }
    files.set(served, { body: await readFile(path), type, immutable: served.startsWith('/assets/') });
  }

  const icons = new Map<string, Buffer>();
  async function icon(file: string): Promise<Buffer | undefined> {
    if (!ICON_FILE.test(file)) {
      return undefined;
    }
    const known = icons.get(file);
    if (known) {
      return known;
    }
    const body = await readFile(join(dir, ICONS, file)).catch(() => undefined);
    if (body) {
      icons.set(file, body);
    }
    return body;
  }

  return {
    page: (nonce) => withServices.replace('</head>', `  <meta property="csp-nonce" nonce="${escapeAttribute(nonce)}" />\n  </head>`),
    files,
    icon,
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
