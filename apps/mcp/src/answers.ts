import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Refused, Unavailable } from './datahub.js';

/** The Levels of a Resource, as Data Hub names them (FR-MR-10); Claude names the Level wherever it uses one (FR-CL-05). */
const LEVELS = ['0 · Beta', '1 · Available', '2 · Described', '3 · Confirmed', '4 · Explored', '5 · Monitored'];

export const levelName = (level: number): string => LEVELS[level] ?? String(level);

/** An answer for Claude: a sentence when it helps, then the data, as text and as structured content. */
export function answer(data: Record<string, unknown>, note?: string): CallToolResult {
  const json = JSON.stringify(data);
  return { content: [{ type: 'text', text: note ? `${note}\n${json}` : json }], structuredContent: data };
}

/** A refusal for Claude to pass on. */
export function refusal(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/** Not found answers the same as not visible, so Claude says neither which nor what it might hold (FR-CL-02). */
export const NOT_FOUND =
  'Data Hub found nothing you may see there: it does not exist, or it is not shown to you. Say so to the User, without guessing what it might be or hold.';

/** A service that does not answer is said so, never answered from memory (EC-CL-01). */
export const UNAVAILABLE =
  'Data Hub could not answer just now. Tell the User to try again in a moment; do not answer from memory, nor from an earlier answer as if it were current.';

/** Runs a tool, and turns what a service refused, or a service that did not answer, into its answer. */
export async function attempt(work: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Refused) {
      return refusal(error.status === 404 ? NOT_FOUND : `Data Hub refused (${error.code}): ${error.message}`);
    }
    if (error instanceof Unavailable) return refusal(UNAVAILABLE);
    throw error;
  }
}

/** The text of a search result, without its marks. */
export const plain = (pieces: unknown): string =>
  Array.isArray(pieces) ? pieces.map((piece) => (piece && typeof piece === 'object' && 'text' in piece ? String(piece.text) : '')).join('') : String(pieces ?? '');

/** The first sentence of a description, for a list. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed.slice(0, 200) : trimmed.slice(0, end + 1);
}
