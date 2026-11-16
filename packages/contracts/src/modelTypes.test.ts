import { describe, expect, it } from 'vitest';
import { goneOfType, invalidTypeFields, kindOf, missingOfType, MODEL_TYPES, rolesFor, rolesOf } from './modelTypes.js';

const fields = [
  { name: 'eventId', dataType: 'STRING' },
  { name: 'listingId', dataType: 'INT64' },
  { name: 'collectorDatetime', dataType: 'TIMESTAMP' },
  { name: 'createdOn', dataType: 'DATE' },
  { name: 'creditAmount', dataType: 'NUMERIC(10, 2)' },
  { name: 'tags', dataType: 'ARRAY<STRING>' },
];

describe('the model types and the fields they ask for (FR-CO-44, DEC-RC-21)', () => {
  it('has six model types, other last, and other asks for no field', () => {
    expect(MODEL_TYPES).toEqual(['event', 'state', 'fact', 'dimension', 'aggregate', 'other']);
    expect(rolesOf('other')).toEqual([]);
    expect(rolesOf(null)).toEqual([]);
  });

  it('reads the kind of a field from its type in BigQuery', () => {
    expect(kindOf('TIMESTAMP')).toBe('date');
    expect(kindOf('date')).toBe('date');
    expect(kindOf('NUMERIC(10, 2)')).toBe('number');
    expect(kindOf('INT64')).toBe('number');
    expect(kindOf('STRING')).toBe('text');
    expect(kindOf('ARRAY<STRING>')).toBe('other');
    expect(kindOf(null)).toBe('other');
  });

  it('offers a field only the roles its type fits', () => {
    expect(rolesFor('event', 'TIMESTAMP')).toEqual(['happenedAt']);
    expect(rolesFor('event', 'STRING')).toEqual([]);
    expect(rolesFor('state', 'DATE')).toEqual(['createdAt', 'updatedAt', 'asOf']);
    expect(rolesFor('state', 'INT64')).toEqual(['about']);
    expect(rolesFor('aggregate', 'INT64')).toEqual(['groupedBy', 'addsUp', 'uniqueCount']);
  });

  it('refuses a role of another model type, a field that does not fit, a field with two roles and a single role twice', () => {
    expect(invalidTypeFields('event', [{ field: 'collectorDatetime', role: 'happenedAt' }], fields)).toBeUndefined();
    expect(invalidTypeFields('event', [{ field: 'collectorDatetime', role: 'createdAt' }], fields)).toBe('an event has no role createdAt.');
    expect(invalidTypeFields('event', [{ field: 'eventId', role: 'happenedAt' }], fields)).toBe('the field eventId does not fit the role happenedAt.');
    expect(
      invalidTypeFields(
        'state',
        [
          { field: 'createdOn', role: 'createdAt' },
          { field: 'createdOn', role: 'updatedAt' },
        ],
        fields,
      ),
    ).toBe('the field createdOn holds more than one role.');
    expect(
      invalidTypeFields(
        'state',
        [
          { field: 'createdOn', role: 'createdAt' },
          { field: 'collectorDatetime', role: 'createdAt' },
        ],
        fields,
      ),
    ).toBe('the role createdAt takes one field.');
    expect(invalidTypeFields(null, [{ field: 'eventId', role: 'about' }], fields)).toBe('without a model type, eventId holds no role.');
  });

  it('says what is missing: a model type, a required role, the sentence of other', () => {
    expect(missingOfType(null, [], fields, '')).toEqual([{ kind: 'modelType' }]);
    expect(missingOfType('event', [], fields, '')).toEqual([{ kind: 'role', role: 'happenedAt' }]);
    expect(missingOfType('event', [{ field: 'collectorDatetime', role: 'happenedAt' }], fields, '')).toEqual([]);
    expect(missingOfType('state', [{ field: 'listingId', role: 'about' }], fields, '')).toEqual([
      { kind: 'role', role: 'createdAt' },
      { kind: 'role', role: 'updatedAt' },
    ]);
    expect(missingOfType('other', [], fields, '')).toEqual([{ kind: 'sentence' }]);
    expect(missingOfType('other', [], fields, 'generated simulation')).toEqual([]);
  });

  it('asks an aggregate for every number field to be marked, and a count or sum', () => {
    expect(missingOfType('aggregate', [{ field: 'eventId', role: 'groupedBy' }], fields, '')).toEqual([
      { kind: 'role', role: 'addsUp' },
      { kind: 'unmarked', field: 'listingId' },
      { kind: 'unmarked', field: 'creditAmount' },
    ]);
    expect(
      missingOfType(
        'aggregate',
        [
          { field: 'eventId', role: 'groupedBy' },
          { field: 'listingId', role: 'groupedBy' },
          { field: 'creditAmount', role: 'uniqueCount' },
        ],
        fields,
        '',
      ),
    ).toEqual([]);
  });

  it('counts a role whose field is gone as missing, and names it (DEC-RC-23)', () => {
    const typeFields = [{ field: 'happenedOn', role: 'happenedAt' as const }];
    expect(missingOfType('event', typeFields, fields, '')).toEqual([{ kind: 'role', role: 'happenedAt' }]);
    expect(goneOfType(typeFields, fields)).toEqual(typeFields);
    expect(goneOfType([{ field: 'collectorDatetime', role: 'happenedAt' }], fields)).toEqual([]);
  });
});
