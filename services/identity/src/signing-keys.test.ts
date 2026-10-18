import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createKmsKeyService, type KmsClient } from './signing-keys.js';

const VERSION = 'projects/p/locations/europe-west1/keyRings/datahub/cryptoKeys/access-token/cryptoKeyVersions/1';

function fakeClient(overrides: Partial<KmsClient> = {}): KmsClient & { digests: Uint8Array[] } {
  const digests: Uint8Array[] = [];
  return {
    digests,
    async getPublicKey({ name }) {
      return [{ name, pem: '-----BEGIN PUBLIC KEY-----' }];
    },
    async asymmetricSign({ name, digest }) {
      digests.push(digest.sha256);
      return [{ name, signature: Buffer.from([1, 2, 3]) }];
    },
    ...overrides,
  };
}

describe('createKmsKeyService', () => {
  it('sends Cloud KMS the SHA-256 digest, never the token itself', async () => {
    const client = fakeClient();
    const signature = await createKmsKeyService(client).sign(VERSION, Buffer.from('header.payload'));

    expect(client.digests).toEqual([createHash('sha256').update('header.payload').digest()]);
    expect([...signature]).toEqual([1, 2, 3]);
  });

  it('accepts a signature in base64', async () => {
    const client = fakeClient({ asymmetricSign: async ({ name }) => [{ name, signature: 'AQID' }] });
    expect([...(await createKmsKeyService(client).sign(VERSION, Buffer.from('x')))]).toEqual([1, 2, 3]);
  });

  it('refuses an answer for another key version', async () => {
    const client = fakeClient({
      getPublicKey: async () => [{ name: 'another', pem: 'pem' }],
      asymmetricSign: async () => [{ name: 'another', signature: Buffer.from([1]) }],
    });
    await expect(createKmsKeyService(client).publicKeyPem(VERSION)).rejects.toThrow(/no public key/);
    await expect(createKmsKeyService(client).sign(VERSION, Buffer.from('x'))).rejects.toThrow(/no signature/);
  });
});
