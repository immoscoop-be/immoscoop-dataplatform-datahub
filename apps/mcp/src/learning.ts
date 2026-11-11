import { readdir, readFile } from 'node:fs/promises';
import { type Card, type Explanation, explainWith, parseCard, TOPICS } from '@datahub/learning';

export type { Explanation };

/** The cards are files next to the package (TR-LR-01), shipped with it into the image of mcp. */
const CARDS = new URL('../cards/', import.meta.resolve('@datahub/learning'));

let loaded: Promise<Card[]> | undefined;

/** The written cards in English, read once per process. */
export function cards(): Promise<Card[]> {
  loaded ??= (async () => {
    const numbers = await readdir(CARDS).catch(() => [] as string[]);
    const read = await Promise.all(
      numbers.map(async (number) => {
        try {
          return parseCard(await readFile(new URL(`${number}/en.md`, CARDS), 'utf8'));
        } catch {
          return undefined;
        }
      }),
    );
    return read.filter((card): card is Card => card !== undefined);
  })();
  return loaded;
}

/** The written cards that explain a term, best first (FR-CL-15), with the search the package keeps for the checks of a card. */
export async function explain(term: string, limit = 5): Promise<Explanation[]> {
  return explainWith(term, await cards(), (number) => TOPICS.find((topic) => topic.number === number)?.title.en ?? number, limit);
}
