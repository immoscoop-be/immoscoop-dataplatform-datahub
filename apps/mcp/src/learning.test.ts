import { describe, expect, it } from 'vitest';
import { cards, explain } from './learning.js';

describe('explain offers in prod only the cards the Learning Centre of prod shows (DEC-LR-25, FR-CL-15)', () => {
  it('leaves a draft out in prod, and offers it in uat', async () => {
    const draft = (await cards()).find((source) => source.card.status === 'draft');
    expect(draft, 'a written card still in draft').toBeDefined();
    const numbers = async (environment: string) => (await explain(draft!.title, 5, environment)).map((card) => card.number);
    expect(await numbers('uat')).toContain(draft!.card.number);
    expect(await numbers('prod')).not.toContain(draft!.card.number);
  });

  it('offers in prod nothing but reviewed cards', async () => {
    const reviewed = new Set((await cards()).filter((source) => source.card.status === 'reviewed').map((source) => source.card.number));
    for (const term of ['Level', 'Resource', 'Lens', 'Owner', 'Broken']) {
      for (const card of await explain(term, 5, 'prod')) expect(reviewed.has(card.number), `${term}: ${card.number}`).toBe(true);
    }
  });
});
