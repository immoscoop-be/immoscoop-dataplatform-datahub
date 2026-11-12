import type { Card } from './card.js';

/** A written Learning Card, as `explain` of the MCP server offers it: only cards that are written, as a pop-out does (DEC-LR-28). */
export interface Explanation {
  number: string;
  title: string;
  coreIdea: string;
  gain: string;
  score: number;
}

/** A written card to search: its English, with its title from the plan, and its Dutch translation when it has one. */
export interface ExplainSource {
  readonly card: Card;
  readonly title: string;
  readonly translation?: { readonly card: Card; readonly title: string };
}

/**
 * Words that say nothing about a concept, in English and in Dutch: a question is asked in either (DEC-LR-24). "data",
 * "week" and "day" are among them, as nearly every card holds them.
 */
const COMMON = new Set(
  (
    'the and for with what which who whom how why when where this that these those there here are was were been being ' +
    'does did doing done have has had get got can could should would will shall may might must need needs about from ' +
    'into onto than then they them their our your you yours its not yes but all any some each every one also just only ' +
    'very more most much many such own data week weeks day days ' +
    'het een van voor met wat wie hoe waarom wanneer waar dit dat deze die zijn was waren ben bent jij wij zij mijn ' +
    'jouw onze hun moet moeten kan kunnen mag mogen doen doet deed niet geen als dan hier over uit naar bij ook nog maar ' +
    'aan wordt worden heb hebt heeft hadden welke weken dag dagen'
  ).split(' '),
);

/** Endings stripped so that word forms meet: ownership, owning and owner; confirmed and Confirmation; eigenaars and eigenaar. */
const ENDINGS = ['ations', 'ation', 'ships', 'ship', 'ings', 'ing', 'ies', 'ers', 'er', 'ed', 'es', 's', 'e', 'en'];

/** A light stem: up to two endings off, as long as three letters remain. */
export function stem(word: string): string {
  let out = word;
  for (let round = 0; round < 2; round += 1) {
    const ending = ENDINGS.find((one) => out.endsWith(one) && out.length - one.length >= 3);
    if (!ending) break;
    out = out.slice(0, -ending.length);
  }
  return out;
}

/** The stems of the words of a text that say something: a name such as `creditLead` split into its words, common words left out. */
export function stems(text: string): string[] {
  const words = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((word) => word.length > 2 && !COMMON.has(word)).map(stem);
}

/** How well one language of a card answers: a stem in the title counts three times, in its text once. */
function scoreOf(asked: ReadonlySet<string>, card: Card, title: string): number {
  const inTitle = stems(title).filter((one) => asked.has(one)).length;
  const inText = stems(`${card.core.rule} ${card.gain} ${card.core.metaphor.title} ${card.core.metaphor.text} ${card.why.quote}`).filter((one) => asked.has(one)).length;
  return inTitle * 3 + inText;
}

/**
 * The cards that explain a term, best first (FR-CL-15). The term is matched by stems, without common words, against the
 * title, the core idea, what knowing it brings, the metaphor and the reader's question of Why now, in English and in
 * Dutch: the best of the two languages counts. It is the search of `explain` in the MCP server, kept here so that
 * `scripts/learning-card.ts links` measures what Claude finds.
 */
export function explainWith(term: string, sources: readonly ExplainSource[], limit = 5): Explanation[] {
  const asked = new Set(stems(term));
  if (asked.size === 0) return [];
  const found: Explanation[] = [];
  for (const { card, title, translation } of sources) {
    const score = Math.max(scoreOf(asked, card, title), translation ? scoreOf(asked, translation.card, translation.title) : 0);
    if (score > 0) found.push({ number: card.number, title, coreIdea: card.core.rule, gain: card.gain, score });
  }
  return found.sort((a, b) => b.score - a.score || a.number.localeCompare(b.number)).slice(0, limit);
}
