import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, safeHref } from './markdown.js';

describe('Markdown, read into pieces (TR-CO-08)', () => {
  it('reads headings, paragraphs and lists', () => {
    const text = '### What you find here\nEvery credit lead,\nweek by week.\n\n- **Leads in**: how many\n- Response\n\n1. First\n2. Then';
    expect(parseMarkdown(text)).toEqual([
      { kind: 'heading', content: [{ kind: 'text', text: 'What you find here' }] },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'Every credit lead, week by week.' }] },
      {
        kind: 'list',
        ordered: false,
        items: [
          [{ kind: 'strong', children: [{ kind: 'text', text: 'Leads in' }] }, { kind: 'text', text: ': how many' }],
          [{ kind: 'text', text: 'Response' }],
        ],
      },
      { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'First' }], [{ kind: 'text', text: 'Then' }]] },
    ]);
  });

  it('reads bold, italic, code and links, nested', () => {
    expect(parseInline('Ask in `#credit-data`, *really **now***, or _see_ [the **guide**](https://example.com/guide).')).toEqual([
      { kind: 'text', text: 'Ask in ' },
      { kind: 'code', text: '#credit-data' },
      { kind: 'text', text: ', ' },
      { kind: 'em', children: [{ kind: 'text', text: 'really ' }, { kind: 'strong', children: [{ kind: 'text', text: 'now' }] }] },
      { kind: 'text', text: ', or ' },
      { kind: 'em', children: [{ kind: 'text', text: 'see' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://example.com/guide', children: [{ kind: 'text', text: 'the ' }, { kind: 'strong', children: [{ kind: 'text', text: 'guide' }] }] },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves names with underscores, lone stars and escapes as they are', () => {
    expect(parseInline('the field lead_channel_id and snake_case')).toEqual([{ kind: 'text', text: 'the field lead_channel_id and snake_case' }]);
    expect(parseInline('2 * 3 * 4, **not closed')).toEqual([{ kind: 'text', text: '2 * 3 * 4, **not closed' }]);
    expect(parseInline('\\*not italic\\*')).toEqual([{ kind: 'text', text: '*not italic*' }]);
  });

  it('never makes HTML, and opens only safe addresses', () => {
    expect(parseMarkdown('<script>alert(1)</script> <b>bold</b>')).toEqual([{ kind: 'paragraph', content: [{ kind: 'text', text: '<script>alert(1)</script> <b>bold</b>' }] }]);
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ kind: 'text', text: 'click' }]);
    expect(parseInline('[Leads in](/collections/c1)')).toEqual([{ kind: 'link', href: '/collections/c1', children: [{ kind: 'text', text: 'Leads in' }] }]);
    expect(safeHref('mailto:credit@example.com')).toBe('mailto:credit@example.com');
    expect(safeHref('//evil.example.com')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });

  it('keeps a block of code as it is', () => {
    expect(parseMarkdown('```\nselect *\n  from leads\n```\nAfter')).toEqual([
      { kind: 'code', text: 'select *\n  from leads' },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'After' }] },
    ]);
  });
});
