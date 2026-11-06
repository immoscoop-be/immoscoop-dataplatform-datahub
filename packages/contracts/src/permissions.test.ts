import { describe, expect, it } from 'vitest';
import {
  can,
  canWith,
  completePermissions,
  NO_PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSIONS,
  permissionsSchema,
  rangesOf,
  reach,
  sees,
  STARTING_GROUPS,
  startingPermissions,
} from './permissions.js';

describe('the Permissions of Data Hub (TR-PL-03)', () => {
  it('has every Permission in every starting group, valid of its kind', () => {
    for (const group of Object.values(STARTING_GROUPS)) {
      expect(Object.keys(group.permissions).sort()).toEqual([...PERMISSION_KEYS].sort());
      expect(permissionsSchema.safeParse(group.permissions).success).toBe(true);
    }
    expect(permissionsSchema.safeParse(NO_PERMISSIONS).success).toBe(true);
  });

  it('gives Admin every Permission, and Lens user only Lenses (DEC-PL-07)', () => {
    const admin = startingPermissions('admin');
    expect(PERMISSION_KEYS.every((key) => can(admin, key))).toBe(true);
    expect(sees(admin)).toBe('all');
    const lens = startingPermissions('lensUser');
    expect(can(lens, 'queries.make')).toBe(false);
    expect(can(lens, 'resources.preview')).toBe(false);
    expect(canWith(lens, 'messages.write', 'kinds', 'remark')).toBe(false);
    expect(canWith(lens, 'messages.write', 'kinds', 'question')).toBe(true);
    expect(lens['claude.results'].values.show).toBe('card');
  });

  it('gives a Business analyst what everyone could do before, the Entity mapping excepted (DEC-PL-03)', () => {
    const analyst = startingPermissions('businessAnalyst');
    expect(sees(analyst)).toBe('public');
    expect(reach(analyst, 'collections.manage')).toBe('theirs');
    expect(reach(analyst, 'messages.reply')).toBe('every');
    expect(canWith(analyst, 'resources.describe', 'attributes', 'pitfalls')).toBe(true);
    expect(canWith(analyst, 'resources.describe', 'attributes', 'entityMapping')).toBe(false);
    expect(can(analyst, 'resources.assign')).toBe(false);
    expect(can(analyst, 'admin.open')).toBe(false);
  });

  it('keeps always on what is always on, even in a group that says no', () => {
    expect(can(NO_PERMISSIONS, 'catalogue.see')).toBe(true);
    expect(sees(NO_PERMISSIONS)).toBe('theirs');
    expect(permissionsSchema.safeParse({ ...NO_PERMISSIONS, 'runs.ranges': { on: false, values: NO_PERMISSIONS['runs.ranges'].values } }).success).toBe(false);
  });

  it('refuses a value of the wrong kind, and a key Data Hub does not know', () => {
    const wrong = startingPermissions('businessAnalyst');
    (wrong['collections.manage'].values as Record<string, unknown>).reach = 'everyone';
    expect(permissionsSchema.safeParse(wrong).success).toBe(false);
    expect(permissionsSchema.safeParse({ ...startingPermissions('admin'), 'queries.export': { on: true, values: {} } }).success).toBe(false);
  });

  it('completes what is missing with no', () => {
    expect(completePermissions(undefined)).toEqual(NO_PERMISSIONS);
    const partial = completePermissions({ 'queries.make': { on: true, values: {} } });
    expect(can(partial, 'queries.make')).toBe(true);
    expect(can(partial, 'admin.open')).toBe(false);
  });

  it('turns the ranges into bytes (DEC-SR-29)', () => {
    expect(rangesOf(startingPermissions('businessAnalyst'))).toEqual({ approve: 100_000_000, request: 1_000_000_000, above: 'request' });
  });

  it('names a part of Data Hub for every Permission', () => {
    for (const key of PERMISSION_KEYS) expect(PERMISSIONS[key].part).toBeTruthy();
  });
});
