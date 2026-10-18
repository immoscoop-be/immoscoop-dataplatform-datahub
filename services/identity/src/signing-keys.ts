import { createHash } from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

/**
 * The two things identity needs from the key that signs Access Tokens (TR-PF-24). In Cloud KMS
 * the private key never leaves Google; tests use a local key instead (see testing.ts).
 */
export interface KeyService {
  /** The public key of a key version, as PEM. */
  publicKeyPem(version: string): Promise<string>;
  /** Signs the SHA-256 digest of `data` with a key version; returns a DER-encoded ECDSA signature. */
  sign(version: string, data: Uint8Array): Promise<Uint8Array>;
}

/** The calls of the Cloud KMS client that identity makes. */
export interface KmsClient {
  getPublicKey(request: { name: string }): Promise<[{ name?: string | null; pem?: string | null }, ...unknown[]]>;
  asymmetricSign(request: {
    name: string;
    digest: { sha256: Uint8Array };
  }): Promise<[{ name?: string | null; signature?: Uint8Array | string | null }, ...unknown[]]>;
}

/** The key service of a deployed identity: Cloud KMS, as the service account of identity. */
export function createKmsKeyService(client: KmsClient = new KeyManagementServiceClient()): KeyService {
  return {
    async publicKeyPem(version) {
      const [key] = await client.getPublicKey({ name: version });
      if (key.name !== version || !key.pem) {
        throw new Error(`Cloud KMS returned no public key for ${version}`);
      }
      return key.pem;
    },

    async sign(version, data) {
      const digest = createHash('sha256').update(data).digest();
      const [response] = await client.asymmetricSign({ name: version, digest: { sha256: digest } });
      if (response.name !== version || !response.signature) {
        throw new Error(`Cloud KMS returned no signature for ${version}`);
      }
      return typeof response.signature === 'string'
        ? Buffer.from(response.signature, 'base64')
        : Uint8Array.from(response.signature);
    },
  };
}
