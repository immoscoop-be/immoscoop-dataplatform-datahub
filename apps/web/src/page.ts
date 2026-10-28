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
  /** The page, with the addresses of the services in it. */
  page: string;
  /** Every other file, by the path it is served at, such as `/assets/index-1a2b3c.js`. */
  files: ReadonlyMap<string, ClientFile>;
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Reads the built page once, at start-up. The page gets the addresses of identity, catalogue,
 * registry and semgraph in data attributes: the page itself holds no script and no style of its own.
 */
export async function loadClient(dir: string, services: { identityUrl: string; catalogueUrl: string; registryUrl: string; semgraphUrl: string }): Promise<Client> {
  const template = await readFile(join(dir, 'index.html'), 'utf8');
  const opening = '<html lang="nl">';
  if (!template.includes(opening)) {
    throw new Error(`${join(dir, 'index.html')} is not the page Vite builds from client/index.html.`);
  }
  const page = template.replace(
    opening,
    `<html lang="nl" data-identity="${escapeAttribute(services.identityUrl)}" data-catalogue="${escapeAttribute(services.catalogueUrl)}" data-registry="${escapeAttribute(services.registryUrl)}" data-semgraph="${escapeAttribute(services.semgraphUrl)}">`,
  );

  const files = new Map<string, ClientFile>();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    const type = TYPES[extname(entry.name)];
    if (!entry.isFile() || path === join(dir, 'index.html') || !type) {
      continue;
    }
    const served = `/${relative(dir, path).split(sep).join('/')}`;
    files.set(served, { body: await readFile(path), type, immutable: served.startsWith('/assets/') });
  }
  return { page, files };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
