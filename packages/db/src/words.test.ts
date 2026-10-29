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
