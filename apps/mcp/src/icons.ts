import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';

const drawings = new Map<string, Promise<string>>();

/**
 * The drawing of the icon of a Collection, in the light weight of Phosphor as the web app draws it (DEC-CO-19,
 * DEC-UX-164): the MCP App loads nothing from outside, so it comes with the data of its card. Only an icon a
 * Collection may carry is read; any other name, or one that cannot be read, gives no drawing.
 */
export function collectionIcon(name: unknown): Promise<string> {
  if (!isCollectionIcon(name)) return Promise.resolve('');
  let found = drawings.get(name);
  if (!found) {
    found = readFile(fileURLToPath(import.meta.resolve(`@phosphor-icons/core/assets/light/${name}-light.svg`)), 'utf8').then(
      (svg) => (svg.startsWith('<svg') ? svg.trim() : ''),
      () => '',
    );
    drawings.set(name, found);
  }
  return found;
}
