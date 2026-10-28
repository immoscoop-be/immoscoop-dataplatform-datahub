import { describe, expect, it } from 'vitest';
import { type Column, fingerprint, levelAtRegistration, splitColumns } from './fields.js';

const column = (name: string, dataType: string | null, description = ''): Column => ({ name, position: null, dataType, description });

describe('the fields of a Resource', () => {
  it('are its plain columns only: arrays, records, JSON and bytes are left out, with why (DEC-SR-33)', () => {
    const { fields, leftOut } = splitColumns([
      column('listing_id', 'STRING'),
      column('price', 'NUMERIC(12, 2)'),
      column('location', 'GEOGRAPHY'),
      column('identifiers', 'ARRAY<STRUCT<name STRING, value STRING>>'),
      column('address', 'STRUCT<city STRING, zip STRING>'),
      column('address.city', 'STRING'),
      column('legacy', 'RECORD'),
      column('payload', 'JSON'),
      column('photo', 'BYTES'),
      column('hash', 'bytes(16)'),
    ]);
    expect(fields.map((field) => field.name)).toEqual(['listing_id', 'price', 'location']);
    expect(leftOut).toEqual([
      { name: 'identifiers', dataType: 'ARRAY<STRUCT<name STRING, value STRING>>', reason: 'array' },
      { name: 'address', dataType: 'STRUCT<city STRING, zip STRING>', reason: 'struct' },
      // A field inside a record goes with its record.
      { name: 'address.city', dataType: 'STRING', reason: 'struct' },
      { name: 'legacy', dataType: 'RECORD', reason: 'struct' },
      { name: 'payload', dataType: 'JSON', reason: 'json' },
      { name: 'photo', dataType: 'BYTES', reason: 'bytes' },
      { name: 'hash', dataType: 'bytes(16)', reason: 'bytes' },
    ]);
  });

  it('keep a column whose type is not known, such as one only the manifest describes', () => {
    expect(splitColumns([column('note', null)]).fields).toHaveLength(1);
  });
});

describe('the Level at Registration (FR-SR-07, DEC-MR-12)', () => {
  it('is Described when dbt describes the table and at least one field', () => {
    expect(levelAtRegistration('One row per saved search.', [column('id', 'STRING'), column('filters', 'STRING', 'What was saved.')])).toEqual({
      level: 2,
      reason: 'described',
    });
  });

  it('is Available otherwise, never higher', () => {
    expect(levelAtRegistration('  ', [column('id', 'STRING', 'The search.')])).toEqual({ level: 1, reason: 'table-undescribed' });
    expect(levelAtRegistration('One row per saved search.', [column('id', 'STRING', ' ')])).toEqual({ level: 1, reason: 'fields-undescribed' });
  });
});

describe('a Fingerprint (FR-SR-08)', () => {
  const fields = [column('id', 'STRING', 'The search.'), column('created_at', 'TIMESTAMP', 'When.')];
  const base = fingerprint('One row per saved search.', fields, 'sum-1');

  it('takes the names, the types and the descriptions apart, with the checksum of the code', () => {
    expect(base.code).toBe('sum-1');
    expect(base.structure).toMatch(/^[0-9a-f]{64}$/);
    // The order of the columns does not change it.
    expect(fingerprint('One row per saved search.', [...fields].reverse(), 'sum-1')).toEqual(base);
  });

  it('changes only the hash of what changed', () => {
    const retyped = fingerprint('One row per saved search.', [column('id', 'INT64', 'The search.'), fields[1]!], 'sum-1');
    expect(retyped).toMatchObject({ structure: base.structure, descriptions: base.descriptions });
    expect(retyped.types).not.toBe(base.types);
    const redescribed = fingerprint('Every saved search.', fields, 'sum-1');
    expect(redescribed).toMatchObject({ structure: base.structure, types: base.types });
    expect(redescribed.descriptions).not.toBe(base.descriptions);
  });
});
