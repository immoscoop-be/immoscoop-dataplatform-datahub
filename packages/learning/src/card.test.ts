import { describe, expect, it } from 'vitest';
import { CardError, parseCard, versionOf } from './card.js';

const CARD = `---
number: 1.2.2
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: You answer "why don't the weeks add up?" yourself.
---

# Why now

> The report says 61,000 visitors last month, but its four weeks add up to 82,000.
> Which one is wrong?
> — A colleague from sales

You will hear this question again,
every time a month is put next to its weeks.

Promise: why the weeks never add up to the month.

# Core idea

A **unique count** counts everyone once per period.

## Like a guest list

Someone who comes on Friday and Saturday is one guest of the weekend.

## For example

4,000 people on Monday and 3,000 on Tuesday are at most 7,000 people.

# See it

\`\`\`chart
{ "semgraph": "categoryComparison", "points": [] }
\`\`\`

Look at: the bar of the days added up.

You see: it is longer than the week.

# Check your understanding

## How many people sent a lead in two months together?

- [ ] 16,000
- [x] At least 9,000 and at most 16,000

Why: whoever sent one in both months counts once.

## Open Query and count the visitors of a month. What does it show?

Try it: [Open Query](/query/new)

- [x] A count over the whole month
- [ ] The days added up

Why: the month is counted over the month.

# You can now

recognise a unique count by its label.

## Where to next

- Deeper: 2.3.5
- Next to it: K3.4
- Apply: [Open Query](/query/new) Count the visitors of a month.
`;

describe('a Learning Card as a file (DEC-LR-24)', () => {
  it('reads its facts and its five steps', () => {
    const card = parseCard(CARD);
    expect(card).toMatchObject({ number: '1.2.2', status: 'draft', minutes: 5, added: '2026-10-29', translatedFrom: null });
    expect(card.why).toEqual({
      quote: 'The report says 61,000 visitors last month, but its four weeks add up to 82,000. Which one is wrong?',
      by: 'A colleague from sales',
      situation: 'You will hear this question again, every time a month is put next to its weeks.',
      promise: 'why the weeks never add up to the month.',
    });
    expect(card.core).toEqual({
      rule: 'A **unique count** counts everyone once per period.',
      metaphor: { title: 'Like a guest list', text: 'Someone who comes on Friday and Saturday is one guest of the weekend.' },
      example: { title: 'For example', text: '4,000 people on Monday and 3,000 on Tuesday are at most 7,000 people.' },
    });
    expect(card.see).toEqual({ chart: { semgraph: 'categoryComparison', points: [] }, lookAt: 'the bar of the days added up.', youSee: 'it is longer than the week.' });
    expect(card.questions).toEqual([
      { text: 'How many people sent a lead in two months together?', tryIt: null, options: [{ text: '16,000', right: false }, { text: 'At least 9,000 and at most 16,000', right: true }], why: 'whoever sent one in both months counts once.' },
      { text: 'Open Query and count the visitors of a month. What does it show?', tryIt: { label: 'Open Query', href: '/query/new' }, options: [{ text: 'A count over the whole month', right: true }, { text: 'The days added up', right: false }], why: 'the month is counted over the month.' },
    ]);
    expect(card.can).toEqual({
      now: 'recognise a unique count by its label.',
      choices: [{ kind: 'deeper', card: '2.3.5' }, { kind: 'next', card: 'K3.4' }, { kind: 'apply', label: 'Open Query', href: '/query/new', text: 'Count the visitors of a month.' }],
    });
  });

  it('takes a minimal card without See it and without questions (DEC-LR-23)', () => {
    const minimal = CARD.replace(/# See it[\s\S]*?# You can now/, '# You can now');
    const card = parseCard(minimal);
    expect(card.see).toBeNull();
    expect(card.questions).toEqual([]);
  });

  it.each([
    ['without its facts', CARD.replace(/^---\n/, ''), /starts with its facts/],
    ['a fact it does not know', CARD.replace('minutes: 5', 'minutes: 5\nscore: 10'), /"score" is no fact/],
    ['a wrong status', CARD.replace('status: draft', 'status: done'), /no valid status/],
    ['a step out of order', CARD.replace('# Core idea', '# Core-idea'), /no step/],
    ['no promise', CARD.replace('Promise:', 'In this card:'), /Promise/],
    ['no right answer', CARD.replace('- [x] At least', '- [ ] At least'), /exactly one answer/],
    ['no why', CARD.replace('Why: whoever', 'Because whoever'), /"Why: …"/],
    ['a chart that is no JSON', CARD.replace('"points": []', 'points'), /no JSON/],
    ['a link out of Data Hub', CARD.replace('Try it: [Open Query](/query/new)', 'Try it: [Open Query](https://example.com)'), /links into Data Hub/],
    ['one choice', CARD.replace(/- Next to it: K3.4\n- Apply: .*\n/, ''), /two or three choices/],
    ['a choice that is no card', CARD.replace('Deeper: 2.3.5', 'Deeper: grain'), /no number of a card/],
  ])('refuses a card %s, saying where', (_case, source, message) => {
    expect(() => parseCard(source)).toThrow(CardError);
    expect(() => parseCard(source)).toThrow(message);
  });

  it('names the version of its English text, which reviewing it does not change', async () => {
    const version = await versionOf(CARD);
    expect(version).toMatch(/^[0-9a-f]{12}$/);
    expect(await versionOf(CARD.replace('status: draft', 'status: reviewed'))).toBe(version);
    expect(await versionOf(CARD.replace('Like a guest list', 'Like a list of guests'))).not.toBe(version);
  });
});
