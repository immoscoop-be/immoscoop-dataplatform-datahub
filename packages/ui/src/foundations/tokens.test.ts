import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// One place for each value (DEC-PF-28): every colour, font, radius and duration of the interface is
// a token of docs/design/tokens.css. A component holds none itself, and uses only tokens that exist.

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const TOKENS = readFileSync(path.join(ROOT, 'docs/design/tokens.css'), 'utf8');
const FOLDERS = ['packages/ui/src', 'apps/web/client/src'];

/**
 * Custom properties that are no token but a contract between components: `--card` is the reading
 * surface of the frame a component is in, which focus follows (Layers and focus).
 */
const CONTRACTS = new Set(['--card']);

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return files(full);
    }
    return /\.(svelte|css)$/.test(entry.name) ? [full] : [];
  });
}

/** The CSS of a file, without comments: a stylesheet, or the style blocks of a component. */
function css(file: string): string {
  const text = readFileSync(file, 'utf8');
  const styles = file.endsWith('.css') ? text : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  return styles.replace(/\/\*[\s\S]*?\*\//g, '');
}

const declared = (text: string): Set<string> => new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] as string));
const TOKEN_NAMES = declared(TOKENS);
const SOURCES = FOLDERS.flatMap((folder) => files(path.join(ROOT, folder)));

describe('the values of the interface come from tokens.css (DEC-PF-28)', () => {
  it('reads every component and stylesheet', () => {
    expect(SOURCES.length).toBeGreaterThan(5);
  });

  it.each(SOURCES.map((file) => [path.relative(ROOT, file), file]))('%s holds no colour, font, radius or duration of its own', (_name, file) => {
    const styles = css(file);
    const found = [
      ...[...styles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => `colour ${m[0]}`),
      ...[...styles.matchAll(/\b(?:rgba?|hsla?|oklch|lab)\(/g)].map((m) => `colour ${m[0]}`),
      ...[...styles.matchAll(/font-family\s*:(?!\s*(?:var\(|inherit))[^;}]+/g)].map((m) => m[0]),
      ...[...styles.matchAll(/border-radius\s*:\s*[^;}]*\b\d+(?:\.\d+)?px/g)].map((m) => m[0]),
      ...[...styles.matchAll(/(?<![\w.-])\d+(?:\.\d+)?m?s\b/g)].map((m) => `duration ${m[0]}`),
    ];
    expect(found).toEqual([]);
  });

  it.each(SOURCES.map((file) => [path.relative(ROOT, file), file]))('%s uses only tokens that exist', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    const own = new Set([...declared(css(file)), ...[...text.matchAll(/style:(--[\w-]+)/g)].map((m) => m[1] as string)]);
    const used = [...css(file).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string);
    expect(used.filter((name) => !TOKEN_NAMES.has(name) && !own.has(name) && !CONTRACTS.has(name))).toEqual([]);
  });
});
