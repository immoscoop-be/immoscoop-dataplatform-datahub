import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { BigQuery } from './bigquery.js';
import type { Catalogue } from './catalogue.js';
import type { Lenses } from './lenses.js';
import type { Queries } from './queries.js';
import { createUpkeep, messageOf } from './upkeep.js';

const resources = [
  { key: 'immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume', displayName: 'Weekly lead volume' },
  { key: 'immoscoop-dataplatform.dbt_prod_stacks.lead_sources', displayName: 'Lead sources' },
];

describe('the Message on a Broken query or Lens (MSG-QRY-02, MSG-LEN-05)', () => {
  it('names a missing table by its Resource, and a column with the Resources it reads, on the day it was found', () => {
    const since = '2026-10-28T05:17:03.000Z';
    expect(messageOf({ kind: 'table', name: 'immoscoop-dataplatform.dbt_prod_stacks.Lead_Sources', since }, resources)).toEqual({
      since: '2026-10-28',
      missing: [{ kind: 'resource', resource: 'Lead sources' }],
    });
    // A table that is none of its Resources keeps the name BigQuery gave it.
    expect(messageOf({ kind: 'table', name: 'other.dataset.table', since }, resources).missing).toEqual([{ kind: 'resource', resource: 'other.dataset.table' }]);
    expect(messageOf({ kind: 'column', name: 'lead_channel', since }, resources.slice(0, 1)).missing).toEqual([{ kind: 'column', column: 'lead_channel', resource: 'Weekly lead volume' }]);
    expect(messageOf({ kind: 'column', name: 'lead_channel', since }, resources).missing).toEqual([
      { kind: 'column', column: 'lead_channel', resource: 'Weekly lead volume / Lead sources' },
    ]);
  });
});

describe('what reads a Resource whose table a User did not find (FR-SR-52)', () => {
  it('is checked at most once in ten minutes per Resource, however often they try', async () => {
    const asked: (readonly string[] | undefined)[] = [];
    let clock = 1_000_000;
    const upkeep = createUpkeep({
      queries: {
        toCheck: async (ids?: readonly string[]) => {
          asked.push(ids);
          return [];
        },
      } as unknown as Queries,
      lenses: { list: async () => [] } as unknown as Lenses,
      catalogue: {} as Catalogue,
      bigquery: {} as BigQuery,
      now: () => clock,
    });
    const log = { warn: () => undefined, error: () => undefined } as unknown as FastifyBaseLogger;
    await upkeep.lost(['weekly'], log);
    await upkeep.lost(['weekly', 'sources'], log);
    await upkeep.lost([], log);
    clock += 9 * 60_000;
    await upkeep.lost(['weekly'], log);
    clock += 60_000;
    await upkeep.lost(['weekly'], log);
    expect(asked).toEqual([['weekly'], ['sources'], ['weekly']]);
  });
});
