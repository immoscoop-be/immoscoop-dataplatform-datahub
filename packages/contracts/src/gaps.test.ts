import { describe, expect, it } from 'vitest';
import { fieldsOf, type GapScope, gapScopeSchema, hasScope, scopeText } from './gaps.js';

describe('the scope of a Known Gap (FR-RC-24, DEC-RC-20)', () => {
  it('takes a period, fields and rows, each optional and combined', () => {
    const scope: GapScope = { period: { from: null, to: '2025-02-28' }, rows: { field: 'lead_source', is: 'oneOf', values: ['partner'] } };
    expect(gapScopeSchema.parse(scope)).toEqual(scope);
    expect(gapScopeSchema.parse({ fields: ['visitorId'] })).toEqual({ fields: ['visitorId'] });
    expect(gapScopeSchema.parse({ rows: { field: 'campaign', is: 'empty' } })).toEqual({ rows: { field: 'campaign', is: 'empty' } });
    expect(hasScope({})).toBe(false);
    expect(hasScope({ fields: [] })).toBe(false);
    expect(hasScope(scope)).toBe(true);
  });

  it('refuses a period open on both sides, one that ends before it starts, and anything else', () => {
    expect(gapScopeSchema.safeParse({ period: { from: null, to: null } }).success).toBe(false);
    expect(gapScopeSchema.safeParse({ period: { from: '2025-03-01', to: '2025-02-28' } }).success).toBe(false);
    expect(gapScopeSchema.safeParse({ period: { from: '1 March', to: null } }).success).toBe(false);
    expect(gapScopeSchema.safeParse({ rows: { field: 'lead_source', is: 'oneOf', values: [] } }).success).toBe(false);
    // A period names no field of its own: Fields says which it concerns (DEC-UX-178).
    expect(gapScopeSchema.safeParse({ period: { field: 'week_start', from: null, to: '2025-02-28' } }).success).toBe(false);
    expect(gapScopeSchema.safeParse({ when: 'always' }).success).toBe(false);
  });

  it('names its fields once each', () => {
    expect(fieldsOf({ period: { from: '2025-09-02', to: null }, fields: ['campaign', 'lead_source'], rows: { field: 'lead_source', is: 'empty' } })).toEqual(['campaign', 'lead_source']);
    expect(fieldsOf(null)).toEqual([]);
  });

  it('reads as data for Claude (FR-RC-25)', () => {
    expect(scopeText({ period: { from: null, to: '2025-02-28' }, rows: { field: 'lead_source', is: 'oneOf', values: ['partner'] } })).toBe(
      '[period: until 2025-02-28; rows: lead_source = partner]',
    );
    expect(scopeText({ period: { from: '2025-09-02', to: '2025-09-08' }, fields: ['lead_channel'], rows: { field: 'lead_source', is: 'oneOf', values: ['app', 'ios'] } })).toBe(
      '[period: from 2025-09-02 until 2025-09-08; fields: lead_channel; rows: lead_source in (app, ios)]',
    );
    expect(scopeText({ period: { from: '2026-01-01', to: null }, rows: { field: 'campaign', is: 'empty' } })).toBe('[period: from 2026-01-01; rows: campaign is empty]');
  });
});
