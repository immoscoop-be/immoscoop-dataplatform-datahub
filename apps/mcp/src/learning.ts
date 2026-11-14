import { readdir, readFile } from 'node:fs/promises';
import { type Card, type ExplainSource, type Explanation, explainWith, parseCard, shownIn, TOPICS } from '@datahub/learning';

export type { Explanation };

/** The cards are files next to the package (TR-LR-01), shipped with it into the image of mcp. */
const CARDS = new URL('../cards/', import.meta.resolve('@datahub/learning'));

const read = async (number: string, language: 'en' | 'nl'): Promise<Card | undefined> => {
  try {
    return parseCard(await readFile(new URL(`${number}/${language}.md`, CARDS), 'utf8'));
  } catch {
    return undefined;
  }
};

let loaded: Promise<ExplainSource[]> | undefined;

/** The written cards, in English with their Dutch translation and their titles from the plan, read once per process. */
export function cards(): Promise<ExplainSource[]> {
  loaded ??= (async () => {
    const numbers = await readdir(CARDS).catch(() => [] as string[]);
    const sources = await Promise.all(
      numbers.map(async (number): Promise<ExplainSource | undefined> => {
        const card = await read(number, 'en');
        if (!card) return undefined;
        const title = TOPICS.find((topic) => topic.number === card.number)?.title;
        const dutch = await read(number, 'nl');
        return { card, title: title?.en ?? card.number, ...(dutch ? { translation: { card: dutch, title: title?.nl ?? card.number } } : {}) };
      }),
    );
    return sources.filter((source): source is ExplainSource => source !== undefined);
  })();
  return loaded;
}

/**
 * The written cards that explain a term, in English or Dutch, best first (FR-CL-15), with the search the package keeps
 * for the checks of a card. In prod only the reviewed ones, as the web app shows them, so that Claude never links to a
 * draft that the Learning Centre of prod does not show (DEC-LR-25).
 */
export async function explain(term: string, limit = 5, environment?: string): Promise<Explanation[]> {
  return explainWith(term, (await cards()).filter((source) => shownIn(environment, source.card)), limit);
}
