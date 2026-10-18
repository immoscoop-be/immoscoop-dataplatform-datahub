/** Average character width as a share of the font size; good enough to wrap text without measuring it. */
export const CHAR_WIDTH = 0.56;
/** The same for a monospaced font. */
export const MONO_CHAR_WIDTH = 0.6;

/** Greedy word wrap on estimated widths; the last allowed line ends in an ellipsis when cut. */
export function wrap(content: string, size: number, width: number, maxLines: number, charWidth = CHAR_WIDTH): string[] {
  const maxChars = Math.max(10, Math.floor(width / (size * charWidth)));
  const lines: string[] = [];
  let line = '';
  for (const word of content.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, maxChars - 1)}…`;
  return kept;
}

/**
 * Estimated width of a text in pixels, from the widths of a sans-serif such as Nunito or Arial per kind
 * of character, so short labels can be sized without measuring them.
 */
export function textWidth(content: string, size: number): number {
  let em = 0;
  for (const character of content) {
    if (/[ijl]/.test(character)) em += 0.24;
    else if (/[tfrI\s.,:;'!|()-]/.test(character)) em += 0.3;
    else if (/[mwMW]/.test(character)) em += 0.82;
    else if (/[A-Z]/.test(character)) em += 0.68;
    else em += 0.54;
  }
  return em * size;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
