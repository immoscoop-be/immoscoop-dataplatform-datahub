import { describe, expect, it } from 'vitest';
import { blocks, inline } from './MessageText.svelte';

describe('the laid-out text of a Message (FR-CV-11)', () => {
  it('marks strong, struck and names as code, also a name in strong, and keeps an escaped mark as text', () => {
    expect(inline('**`lead_count`** was ~~old~~ \\*not\\* `a*b`')).toEqual([
      { text: 'lead_count', strong: true, struck: false, code: true },
      { text: ' was ', strong: false, struck: false, code: false },
      { text: 'old', strong: false, struck: true, code: false },
      { text: ' *not* ', strong: false, struck: false, code: false },
      { text: 'a*b', strong: false, struck: false, code: true },
    ]);
    // A mark that does not close is text.
    expect(inline('5 ** 2')).toEqual([{ text: '5 ** 2', strong: false, struck: false, code: false }]);
  });

  it('keeps paragraphs, items and quotes in the order they come', () => {
    const laid = blocks('**Two changed**\n\n> Why?\n\n**`lead_count`**\n- Before: x\n- Now: y');
    expect(laid.map((block) => block.kind)).toEqual(['paragraph', 'quote', 'paragraph', 'items']);
    expect(laid[3]).toMatchObject({ kind: 'items', items: [[{ text: 'Before: x' }], [{ text: 'Now: y' }]] });
  });
});
