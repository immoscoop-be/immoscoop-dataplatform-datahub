/**
 * The Summary of a Resource (FR-RC-19): everything Data Hub knows about it on one page, in one order to read it, the
 * same for every Resource, each part with its weight (DEC-RC-17). The page of the web app and what Claude reads through
 * the MCP (FR-CL-25) both follow this order; each leaves out a part with nothing in it.
 */

/** How much a part weighs, from what holds in every answer to background. */
export type Weight = 'readFirst' | 'beforeYouQuery' | 'whenInterpreting' | 'context';

export const WEIGHTS: readonly Weight[] = ['readFirst', 'beforeYouQuery', 'whenInterpreting', 'context'];

/** The name of each weight, and what it asks of whoever reads the Summary: in English, as Claude reads it. */
export const WEIGHT_MEANS: Readonly<Record<Weight, { name: string; asks: string }>> = {
  readFirst: { name: 'Read first', asks: 'Know this before anything else: it holds in every answer about the Resource.' },
  beforeYouQuery: { name: 'Before you query', asks: 'It decides how the SQL is written.' },
  whenInterpreting: { name: 'When interpreting results', asks: 'It decides what a result may be taken to say.' },
  context: { name: 'Context', asks: 'Background.' },
};

/** The parts of the Overview of a Resource, and where else a part of the Summary leads: its Columns or its Messages. */
export type SummarySource = 'description' | 'behaviour' | 'gaps' | 'querying' | 'entities' | 'maturity' | 'changes' | 'columns' | 'messages';

export type SummaryPart =
  | 'deprecated'
  | 'whatItIs'
  | 'oneRow'
  | 'useFor'
  | 'queryCheaply'
  | 'joins'
  | 'fields'
  | 'watchOut'
  | 'knownGaps'
  | 'qa'
  | 'standing'
  | 'colleagues'
  | 'changes';

/** The parts of the Summary in the order to read them, each with its weight and where it comes from (DEC-RC-17). */
export const SUMMARY: readonly { part: SummaryPart; weight: Weight; from: SummarySource | null }[] = [
  { part: 'deprecated', weight: 'readFirst', from: null },
  { part: 'whatItIs', weight: 'readFirst', from: 'description' },
  { part: 'oneRow', weight: 'readFirst', from: 'description' },
  { part: 'useFor', weight: 'readFirst', from: 'behaviour' },
  { part: 'queryCheaply', weight: 'beforeYouQuery', from: 'querying' },
  { part: 'joins', weight: 'beforeYouQuery', from: 'entities' },
  { part: 'fields', weight: 'beforeYouQuery', from: 'columns' },
  { part: 'watchOut', weight: 'whenInterpreting', from: 'behaviour' },
  { part: 'knownGaps', weight: 'whenInterpreting', from: 'gaps' },
  { part: 'qa', weight: 'whenInterpreting', from: 'messages' },
  { part: 'standing', weight: 'context', from: 'maturity' },
  { part: 'colleagues', weight: 'context', from: 'messages' },
  { part: 'changes', weight: 'context', from: 'changes' },
];

/** A thread on a Resource as far as its place in the Summary depends on it. */
export interface ThreadLike {
  /** The kind of its first Message: a question, remark or signal is written by a person. */
  kind: string;
  state: string | null;
  writer: { as: string | null } | null;
  replies?: readonly { kind?: string; writer: { as: string | null } | null }[];
}

const SAID = new Set(['question', 'remark', 'signal']);
const STAFF = new Set(['owner', 'dataTeam']);

/** Whether the Owner Unit or the Data Team started the thread or answered in it; closing it is no answer (FR-CV-16). */
export const touched = (thread: ThreadLike): boolean =>
  STAFF.has(thread.writer?.as ?? '') || (thread.replies ?? []).some((reply) => reply.kind !== 'closing' && STAFF.has(reply.writer?.as ?? ''));

/**
 * Splits the threads on a Resource as its Summary takes them (DEC-RC-18): its curated Q&A, every thread its Owner Unit
 * or the Data Team started or answered in, with the open Signals, whoever raised them, first; and what colleagues wrote
 * that they have not touched yet. Messages of Data Hub itself, and Requests, are no part of it. The order of each group
 * is that of the threads given, the newest first.
 */
export function curate<Thread extends ThreadLike>(threads: readonly Thread[]): { qa: Thread[]; colleagues: Thread[] } {
  const said = threads.filter((thread) => SAID.has(thread.kind) && thread.writer !== null);
  const openSignal = (thread: Thread) => thread.kind === 'signal' && thread.state === 'open';
  const qa = said.filter((thread) => openSignal(thread) || touched(thread));
  return {
    qa: [...qa.filter(openSignal), ...qa.filter((thread) => !openSignal(thread))],
    colleagues: said.filter((thread) => !qa.includes(thread)),
  };
}
