import { describe, expect, it } from 'vitest';
import type { FieldOfType, TypeField } from './modelTypes.js';
import { dateFieldOf, dateFieldsOf, reliableSinceOf, reliableSinceSchema, reliableText, typeDateField } from './reliable.js';

const FIELDS: FieldOfType[] = [
  { name: 'week_start', dataType: 'DATE' },
  { name: 'created_at', dataType: 'TIMESTAMP' },
  { name: 'updated_at', dataType: 'TIMESTAMP' },
  { name: 'lead_source', dataType: 'STRING' },
  { name: 'lead_count', dataType: 'INT64' },
];

describe('Reliable Since (DEC-RC-29, FR-RC-31)', () => {
  it('is From its first row, or a later day with why not earlier, which is required', () => {
    expect(reliableSinceSchema.parse({ from: 'firstRow' })).toEqual({ from: 'firstRow' });
    expect(reliableSinceOf(reliableSinceSchema.parse({ from: 'day', day: '2025-01-01', why: ' 2024 was a test. ' }))).toEqual({ from: 'day', day: '2025-01-01', why: '2024 was a test.' });
    expect(reliableSinceOf({ from: 'firstRow' })).toEqual({ from: 'firstRow', day: null, why: '' });
    expect(reliableSinceSchema.safeParse({ from: 'day', day: '2025-01-01', why: '  ' }).success).toBe(false);
    expect(reliableSinceSchema.safeParse({ from: 'day', day: '2025-02-30', why: 'Why.' }).success).toBe(false);
    expect(reliableSinceSchema.safeParse({ from: 'firstRow', day: '2025-01-01' }).success).toBe(false);
    expect(reliableSinceSchema.safeParse('2025-01-01').success).toBe(false);
  });

  it('reads as data for Claude, on its Date Field', () => {
    expect(reliableText({ from: 'day', day: '2025-01-01', why: '2024 was a test.' }, 'week_start')).toBe('from 2025-01-01 on week_start; not earlier because: 2024 was a test.');
    expect(reliableText({ from: 'firstRow', day: null, why: '' }, null)).toBe('from its first row');
  });
});

describe('the Date Field of a Resource (FR-RC-32, DEC-RC-32)', () => {
  const period: TypeField[] = [{ field: 'week_start', role: 'period' }, { field: 'lead_source', role: 'groupedBy' }];

  it('comes from its table type: the period of an aggregate, the created-at field of a state before its updated-at', () => {
    expect(typeDateField('aggregate', period, FIELDS)).toEqual({ field: 'week_start', role: 'period' });
    expect(typeDateField('state', [{ field: 'updated_at', role: 'updatedAt' }, { field: 'created_at', role: 'createdAt' }], FIELDS)).toEqual({ field: 'created_at', role: 'createdAt' });
    expect(typeDateField('event', [{ field: 'created_at', role: 'happenedAt' }], FIELDS)).toEqual({ field: 'created_at', role: 'happenedAt' });
    // A dimension, another table type, none recorded, or a role whose field is gone: none.
    expect(typeDateField('dimension', [], FIELDS)).toBeNull();
    expect(typeDateField(null, [], FIELDS)).toBeNull();
    expect(typeDateField('aggregate', [{ field: 'gone_week', role: 'period' }], FIELDS)).toBeNull();
  });

  it('is the one chosen, unusual when its table type gives another; else the one its table type gives', () => {
    expect(dateFieldOf(null, 'aggregate', period, FIELDS)).toEqual({ field: 'week_start', source: 'type', typeField: { field: 'week_start', role: 'period' }, unusual: false, gone: false });
    expect(dateFieldOf('created_at', 'aggregate', period, FIELDS)).toMatchObject({ field: 'created_at', source: 'chosen', unusual: true, gone: false });
    expect(dateFieldOf('week_start', 'aggregate', period, FIELDS)).toMatchObject({ source: 'chosen', unusual: false });
    expect(dateFieldOf('created_at', null, [], FIELDS)).toMatchObject({ field: 'created_at', unusual: false });
    expect(dateFieldOf('loaded_at', null, [], FIELDS)).toMatchObject({ gone: true });
    expect(dateFieldOf(null, 'dimension', [], FIELDS)).toMatchObject({ field: null, source: null });
  });

  it('is usual on either time field of a state, which its Owner picks', () => {
    const state: TypeField[] = [{ field: 'created_at', role: 'createdAt' }, { field: 'updated_at', role: 'updatedAt' }];
    expect(dateFieldOf('updated_at', 'state', state, FIELDS)).toMatchObject({ field: 'updated_at', source: 'chosen', unusual: false });
    expect(dateFieldOf('week_start', 'state', state, FIELDS)).toMatchObject({ unusual: true });
  });

  it('is chosen among the date fields of the Resource', () => {
    expect(dateFieldsOf(FIELDS)).toEqual(['week_start', 'created_at', 'updated_at']);
  });
});
