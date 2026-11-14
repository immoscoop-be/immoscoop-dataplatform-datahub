import { describe, expect, it } from 'vitest';
import { cards, explain } from './learning.js';

describe('explain offers in prod only the cards the Learning Centre of prod shows (DEC-LR-25, FR-CL-15)', () => {
  it('offers a card in uat whatever its status, and in prod as the shared rule says', async () => {
    for (const source of await cards()) {
      const numbers = async (environment: string) => (await explain(source.title, 5, environment)).map((card) => card.number);
      expect(await numbers('uat'), source.title).toContain(source.card.number);
      if (source.card.status === 'draft') expect(await numbers('prod'), source.title).not.toContain(source.card.number);
      else expect(await numbers('prod'), source.title).toContain(source.card.number);
    }
  });

  it('offers in prod nothing but reviewed cards', async () => {
    const reviewed = new Set((await cards()).filter((source) => source.card.status === 'reviewed').map((source) => source.card.number));
    for (const term of ['Level', 'Resource', 'Lens', 'Owner', 'Broken']) {
      for (const card of await explain(term, 5, 'prod')) expect(reviewed.has(card.number), `${term}: ${card.number}`).toBe(true);
    }
  });
});
