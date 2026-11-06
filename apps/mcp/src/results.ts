import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { answer } from './answers.js';
import type { Results } from './permits.js';

/**
 * How the result of a query or a Preview reaches Claude, as `claude.results` of the Permission group of the User says
 * (FR-CL-28, DEC-PL-05, TR-PL-09). In Claude, the rows go to Claude and to the MCP App, as before (DEC-CL-06). In a card
 * only, Claude reads the head of the result, never a value, while the MCP App reads the rows through tools only it
 * calls. Not in Claude, there is no MCP App: Claude offers "Open in Data Hub".
 */

/** What Claude may and may not do with a result in a card only; said with every such result, and in the instructions. */
export const CARD_RULE =
  'The User sees its rows in the card; their Permission group keeps the values from you. Answer from its shape only: its columns and their types, how many rows, what it read, and the Levels. Do not guess at values or sum them up, and do not ask the User to paste or read out rows. If something in it looks off to them, offer to help with a Signal.';

/** What Claude does with a result not shown in Claude. */
export const NONE_RULE =
  'The Permission group of the User does not show results in Claude: offer them "Open in Data Hub" with the link, where they see it. Do not ask them to paste or read out rows.';

/** Refused to Claude in a card only, where the rows show in the card only. */
export const ROWS_IN_CARD = `The rows of this result show in the card only. ${CARD_RULE}`;

/** Refused to Claude when results are not shown in Claude. */
export const ROWS_NOT_IN_CLAUDE = `The rows of this result are not shown in Claude. ${NONE_RULE}`;

export interface Column {
  name: string;
  type: string;
}

/** The shape of a result, as Claude reads it in a card only: its columns with their types, and how many rows. */
export interface Shape {
  columns: Column[];
  rows: number | null;
}

/** The shape of a page of a result, without a single row of it (FR-CL-28). */
export function shapeOf(page: unknown): Shape {
  const given = (page && typeof page === 'object' ? page : {}) as { columns?: unknown; totalRows?: unknown };
  const columns = Array.isArray(given.columns) ? given.columns : [];
  return {
    columns: columns.map((column: { name?: unknown; type?: unknown }) => ({ name: String(column?.name ?? ''), type: String(column?.type ?? '') })),
    rows: typeof given.totalRows === 'number' ? given.totalRows : null,
  };
}

/** A run as Claude reads it in a card only: which run, its state, what it read and how many rows; never its values. */
export function runShape(run: unknown): Record<string, unknown> {
  const given = (run && typeof run === 'object' ? run : {}) as Record<string, unknown>;
  const kept = ['ref', 'number', 'state', 'rowCount', 'processedBytes', 'partitions', 'startedAt', 'finishedAt'];
  return Object.fromEntries(kept.filter((key) => given[key] !== undefined).map((key) => [key, given[key]]));
}

/** The shape in words, for the first lines Claude reads: the MCP App may pass them on, so they hold no value. */
export function shapeText(shape: Shape, reads: string | null | undefined): string {
  const rows = shape.rows === null ? 'its rows' : `${shape.rows} ${shape.rows === 1 ? 'row' : 'rows'}`;
  const columns = shape.columns.length ? `, with the columns ${shape.columns.map((column) => `${column.name} (${column.type})`).join(', ')}` : '';
  return `${rows}${columns}${reads ? `; it read ${reads}` : ''}`;
}

/**
 * A result in a card only: the words for Claude first, then the head as data, never a value. The MCP App passes on
 * only the first, when the User approved a run (FR-CL-28).
 */
export function cardAnswer(head: Record<string, unknown>, note: string): CallToolResult {
  const data = { ...head, results: 'card' satisfies Results };
  return { content: [{ type: 'text', text: note }, { type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

/** A result not shown in Claude: what it is, and the link to open it in Data Hub, for Claude to offer (FR-CL-28). */
export function notInClaude(what: string, data: Record<string, unknown> & { page: string }): CallToolResult {
  return answer({ ...data, results: 'none' satisfies Results }, `${what} is not shown in Claude. ${NONE_RULE} Open in Data Hub: ${data.page}`);
}
