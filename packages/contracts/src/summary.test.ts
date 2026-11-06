import { describe, expect, it } from 'vitest';
import { curate, SUMMARY, WEIGHTS } from './summary.js';

const thread = (id: string, kind: string, as: string | null, state: string | null = null, replies: (string | null)[] = []) => ({
  id,
  kind,
  state,
  writer: { as },
  replies: replies.map((reply) => ({ writer: { as: reply } })),
});

describe('the Summary of a Resource (FR-RC-19, DEC-RC-17)', () => {
  it('reads its parts in one order, by weight, the deprecation first', () => {
    expect(SUMMARY[0]).toEqual({ part: 'deprecated', weight: 'readFirst', from: null });
    const weights = SUMMARY.map((entry) => WEIGHTS.indexOf(entry.weight));
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
    expect(new Set(SUMMARY.map((entry) => entry.part)).size).toBe(SUMMARY.length);
  });

  it('keeps every thread the Owner Unit or the Data Team touched as its curated Q&A, open Signals first (DEC-RC-18)', () => {
    const threads = [
      thread('a', 'question', null, 'open'),
      thread('b', 'question', null, 'answered', [null, 'owner']),
      thread('c', 'remark', 'dataTeam'),
      thread('d', 'signal', null, 'open'),
      thread('e', 'remark', null),
      thread('f', 'signal', null, 'answered', [null]),
      { id: 'g', kind: 'dataHub', state: null, writer: null },
      thread('h', 'request', 'owner', 'waiting'),
    ];
    const { qa, colleagues } = curate(threads);
    expect(qa.map((one) => one.id)).toEqual(['d', 'b', 'c']);
    expect(colleagues.map((one) => one.id)).toEqual(['a', 'e', 'f']);
  });

  it('takes closing a thread for no answer: closed by its Owner Unit alone, it stays with what colleagues noted (FR-CV-16)', () => {
    const closed = { id: 'i', kind: 'question', state: 'closed', writer: { as: null }, replies: [{ kind: 'closing', writer: { as: 'owner' } }] };
    const { qa, colleagues } = curate([closed]);
    expect(qa).toEqual([]);
    expect(colleagues.map((one) => one.id)).toEqual(['i']);
  });
});
