import { describe, expect, it } from 'vitest';
import { marked } from './words.js';

describe('a text with the words a question shares marked (DEC-UX-23)', () => {
  it('comes in pieces, the shared words apart', () => {
    expect(marked('Which \u0001sources\u0002 bring our \u0001leads\u0002?')).toEqual([
      { text: 'Which ', shared: false },
      { text: 'sources', shared: true },
      { text: ' bring our ', shared: false },
      { text: 'leads', shared: true },
      { text: '?', shared: false },
    ]);
  });

  it('is one piece without a shared word, and none when empty', () => {
    expect(marked('Weekly lead volume')).toEqual([{ text: 'Weekly lead volume', shared: false }]);
    expect(marked('')).toEqual([]);
  });
});

describe('the last word of a question, as the start of a word (DEC-UX-267)', () => {
  it('marks the words that start with it too, without accents or case', () => {
    expect(marked('Crédit leads, \u0001current\u0002 credits', 'cre')).toEqual([
      { text: 'Crédit', shared: true },
      { text: ' leads, ', shared: false },
      { text: 'current', shared: true },
      { text: ' ', shared: false },
      { text: 'credits', shared: true },
    ]);
  });

  it('marks nothing more without it', () => {
    expect(marked('Credit leads', null)).toEqual([{ text: 'Credit leads', shared: false }]);
  });
});
