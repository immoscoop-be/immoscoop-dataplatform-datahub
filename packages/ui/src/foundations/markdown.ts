/**
 * Markdown, read into pieces that a page builds itself, never as HTML (TR-CO-08): the intro of a Collection
 * (FR-CO-41). It knows what an Owner Unit writes in an intro: headings, paragraphs, lists, bold, italic, code
 * and links. HTML in it stays the text it is, and a link opens only an address with http, https or mailto, or
 * a path within Data Hub; any other link stays its text.
 */

/** A piece of a line. */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: readonly Inline[] }
  | { readonly kind: 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly Inline[] };

/** A block of the text. */
export type Block =
  | { readonly kind: 'heading'; readonly content: readonly Inline[] }
  | { readonly kind: 'paragraph'; readonly content: readonly Inline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] }
  | { readonly kind: 'code'; readonly text: string };

/** What a backslash keeps as it is. */
const ESCAPABLE = /[\\`*_[\]()#+\-.!>]/;
const WORD = /[\p{L}\p{N}]/u;
const isWord = (char: string | undefined) => char !== undefined && WORD.test(char);
const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);

/** The address of a link when it may be opened: http, https, mailto, or a path within Data Hub. */
export function safeHref(address: string): string | null {
  const href = address.trim();
  return /^(https?:\/\/|mailto:)\S+$/i.test(href) || /^\/(?!\/)\S*$/.test(href) ? href : null;
}

/** Where the marker that closes one opened before `from` is, or -1: code spans and escapes are skipped. */
function closing(text: string, from: number, marker: string): number {
  for (let at = from; at <= text.length - marker.length; at++) {
    const char = text[at];
    if (char === '\\') {
      at++;
      continue;
    }
    if (char === '`') {
      const end = text.indexOf('`', at + 1);
      if (end > at) at = end;
      continue;
    }
    if (!text.startsWith(marker, at)) continue;
    // A single marker next to another one is part of a double: both are skipped.
    if (marker.length === 1 && text[at + 1] === marker) {
      at++;
      continue;
    }
    if (isSpace(text[at - 1])) continue;
    // An underscore inside a word, as in lead_channel, closes nothing.
    if (marker[0] === '_' && isWord(text[at + marker.length])) continue;
    return at;
  }
  return -1;
}

/** One line, or the text of a paragraph, in pieces. */
export function parseInline(text: string): Inline[] {
  const pieces: Inline[] = [];
  let plain = '';
  const flush = () => {
    if (plain) pieces.push({ kind: 'text', text: plain });
    plain = '';
  };
  let at = 0;
  while (at < text.length) {
    const char = text[at]!;
    if (char === '\\' && at + 1 < text.length && ESCAPABLE.test(text[at + 1]!)) {
      plain += text[at + 1];
      at += 2;
      continue;
    }
    if (char === '`') {
      const end = text.indexOf('`', at + 1);
      if (end > at + 1) {
        flush();
        pieces.push({ kind: 'code', text: text.slice(at + 1, end) });
        at = end + 1;
        continue;
      }
    }
    if (char === '*' || char === '_') {
      const double = text[at + 1] === char;
      const marker = double ? char + char : char;
      const inside = at + marker.length;
      // It opens before a word, and an underscore not inside one.
      const opens = !isSpace(text[inside]) && !(char === '_' && isWord(text[at - 1]));
      const end = opens ? closing(text, inside, marker) : -1;
      if (end > inside) {
        flush();
        const children = parseInline(text.slice(inside, end));
        pieces.push(double ? { kind: 'strong', children } : { kind: 'em', children });
        at = end + marker.length;
        continue;
      }
      plain += marker;
      at += marker.length;
      continue;
    }
    if (char === '[') {
      // An address may hold one pair of brackets, as many on Wikipedia do.
      const link = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/.exec(text.slice(at));
      if (link) {
        flush();
        const href = safeHref(link[2]!);
        const children = parseInline(link[1]!);
        if (href) {
          pieces.push({ kind: 'link', href, children });
        } else {
          pieces.push(...children);
        }
        at += link[0].length;
        continue;
      }
    }
    plain += char;
    at++;
  }
  flush();
  // Text next to text is one piece.
  return pieces.reduce<Inline[]>((joined, piece) => {
    const last = joined.at(-1);
    if (last?.kind === 'text' && piece.kind === 'text') {
      joined[joined.length - 1] = { kind: 'text', text: last.text + piece.text };
    } else {
      joined.push(piece);
    }
    return joined;
  }, []);
}

/** A text in Markdown, in blocks: lines next to each other are one paragraph, a blank line ends one. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const endList = () => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (/^\s{0,3}```/.test(line)) {
      endParagraph();
      endList();
      const code: string[] = [];
      for (index++; index < lines.length && !/^\s{0,3}```/.test(lines[index]!); index++) code.push(lines[index]!);
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      endParagraph();
      endList();
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*?)(\s+#+)?\s*$/.exec(line);
    if (heading) {
      endParagraph();
      endList();
      blocks.push({ kind: 'heading', content: parseInline(heading[1]!) });
      continue;
    }
    const item = /^\s{0,3}(?:([-*+])|\d{1,9}[.)])\s+(.*)$/.exec(line);
    if (item) {
      endParagraph();
      const ordered = item[1] === undefined;
      if (list && list.ordered !== ordered) endList();
      list ??= { ordered, items: [] };
      list.items.push(item[2]!);
      continue;
    }
    // An indented line goes on with the item above it.
    if (list && /^\s/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    endList();
    paragraph.push(line.trim());
  }
  endParagraph();
  endList();
  return blocks;
}
