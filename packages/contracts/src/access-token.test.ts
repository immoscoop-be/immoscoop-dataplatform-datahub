import { describe, expect, it } from 'vitest';
import { accessTokenClaims } from './access-token.js';
import { NO_PERMISSIONS, startingPermissions } from './permissions.js';

const valid = {
  sub: '1234567890',
  email: 'jane@immoscoop.be',
  name: 'Jane',
  groups: ['group-1'],
  permissionGroup: { id: 'pg-admin', name: 'Admin' },
  permissions: startingPermissions('admin'),
  iss: 'https://identity.example',
  aud: 'datahub',
  iat: 1_700_000_000,
  exp: 1_700_000_900,
};

describe('accessTokenClaims', () => {
  it('accepts a complete set of claims', () => {
    expect(accessTokenClaims.parse(valid)).toEqual(valid);
  });

  it('rejects claims without groups', () => {
    const { groups: _groups, ...withoutGroups } = valid;
    expect(accessTokenClaims.safeParse(withoutGroups).success).toBe(false);
  });

  it('rejects claims without a Permission group (TR-PL-05)', () => {
    const { permissionGroup: _group, ...withoutGroup } = valid;
    expect(accessTokenClaims.safeParse(withoutGroup).success).toBe(false);
  });

  it('completes the Permissions, so that a key that is missing or wrong is no', () => {
    const { 'admin.open': _admin, ...rest } = startingPermissions('admin');
    const claims = accessTokenClaims.parse({ ...valid, permissions: { ...rest, 'queries.make': { on: 'yes', values: {} } } });
    expect(claims.permissions['admin.open']).toEqual(NO_PERMISSIONS['admin.open']);
    expect(claims.permissions['queries.make'].on).toBe(false);
    expect(claims.permissions['requests.decide'].on).toBe(true);
  });

  it('drops unknown claims, the roles of before included', () => {
    const claims = accessTokenClaims.parse({ ...valid, extra: true, roles: ['datateam'] });
    expect(claims).not.toHaveProperty('extra');
    expect(claims).not.toHaveProperty('roles');
  });
});
