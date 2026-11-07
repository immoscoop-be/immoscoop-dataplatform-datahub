import { describe, expect, it } from 'vitest';
import { renderLog } from '@datahub/contracts/log';
import { logText } from './log.js';

describe('the text of a Log Entry', () => {
  it('is built from the template of its Log ID when it is read (DEC-SR-09)', () => {
    expect(logText('COL-003', { old: 'DigiKom', new: 'Sales', actor: 'An' })).toBe('Owner Unit changed from DigiKom to Sales by An');
    expect(logText('RES-001', { exposure: 'datahub_orders', key: 'p.d.orders', run: '1' })).toBe('Registered through exposure datahub_orders');
  });

  it('names a field in words, and leaves a Display Name as it is', () => {
    expect(logText('COL-002', { field: 'description', old: 'Old.', new: 'New.', actor: 'Dirk' })).toBe('Description changed by Dirk');
    expect(renderLog('COL-002', { field: 'icon', old: 'coins', new: 'bank', actor: 'Dirk' }, 'nl')).toBe('Icoon gewijzigd door Dirk');
    expect(logText('COL-006', { resource: 'customers', actor: 'Dirk' })).toBe('customers added by Dirk');
  });
});
