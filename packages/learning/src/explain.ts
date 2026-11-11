import type { Card } from './card.js';

/** A written Learning Card, as `explain` of the MCP server offers it: only cards that are written, as a pop-out does (DEC-LR-28). */
export interface Explanation {
  number: string;
  title: string;
  coreIdea: string;
  gain: string;
  score: number;
}

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * The cards that explain a term, best first (FR-CL-15): its words in the title count most, then in the core idea,
 * what knowing it brings and its metaphor. A name such as `creditLead` is split into its words. It is the search of
 * `explain` in the MCP server, kept here so that `scripts/learning-card.ts links` measures what Claude finds.
 */
export function explainWith(term: string, cards: readonly Card[], titleOf: (number: string) => string, limit = 5): Explanation[] {
  const asked = new Set(words(term.replace(/([a-z])([A-Z])/g, '$1 $2')).filter((word) => word.length > 2));
  if (asked.size === 0) return [];
  const found: Explanation[] = [];
  for (const card of cards) {
    const title = titleOf(card.number);
    const inTitle = words(title).filter((word) => asked.has(word)).length;
    const inText = words(`${card.core.rule} ${card.gain} ${card.core.metaphor.title} ${card.core.metaphor.text}`).filter((word) => asked.has(word)).length;
    const score = inTitle * 3 + inText;
    if (score > 0) found.push({ number: card.number, title, coreIdea: card.core.rule, gain: card.gain, score });
  }
  return found.sort((a, b) => b.score - a.score || a.number.localeCompare(b.number)).slice(0, limit);
}
