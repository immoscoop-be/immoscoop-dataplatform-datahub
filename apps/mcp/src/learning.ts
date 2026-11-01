import { readdir, readFile } from 'node:fs/promises';
import { type Card, parseCard, TOPICS } from '@datahub/learning';

/** A written Learning Card, as `explain` offers it: only cards that are written, as a pop-out does (DEC-LR-28). */
export interface Explanation {
  number: string;
  title: string;
  coreIdea: string;
  gain: string;
  score: number;
}

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

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * The written cards that explain a term, best first (FR-CL-15): its words in the title count most, then in the
 * core idea, what knowing it brings and its metaphor. A name such as `creditLead` is split into its words.
 */
export async function explain(term: string, limit = 5): Promise<Explanation[]> {
  const asked = new Set(words(term.replace(/([a-z])([A-Z])/g, '$1 $2')).filter((word) => word.length > 2));
  if (asked.size === 0) return [];
  const found: Explanation[] = [];
  for (const card of await cards()) {
    const title = TOPICS.find((topic) => topic.number === card.number)?.title.en ?? card.number;
    const inTitle = words(title).filter((word) => asked.has(word)).length;
    const inText = words(`${card.core.rule} ${card.gain} ${card.core.metaphor.title} ${card.core.metaphor.text}`).filter((word) => asked.has(word)).length;
    const score = inTitle * 3 + inText;
    if (score > 0) found.push({ number: card.number, title, coreIdea: card.core.rule, gain: card.gain, score });
  }
  return found.sort((a, b) => b.score - a.score || a.number.localeCompare(b.number)).slice(0, limit);
}
