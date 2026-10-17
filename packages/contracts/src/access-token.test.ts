import { describe, expect, it } from 'vitest';
import { accessTokenClaims } from './access-token.js';

const valid = {
  sub: '1234567890',
  email: 'jane@immoscoop.be',
  name: 'Jane',
  groups: ['group-1'],
  roles: ['datateam'],
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

  it('drops unknown claims', () => {
    expect(accessTokenClaims.parse({ ...valid, extra: true })).not.toHaveProperty('extra');
  });
});
