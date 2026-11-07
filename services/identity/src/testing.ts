import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import type { KeyService } from './signing-keys.js';

/**
 * A stand-in for Cloud KMS in tests: one local key pair per key version, signing the way Cloud KMS
 * does (SHA-256, DER-encoded ECDSA).
 */
export function createLocalKeyService(
  versions: string[],
  namedCurve = 'prime256v1',
): KeyService & { privateKey(version: string): KeyObject } {
  const pairs = new Map(versions.map((version) => [version, generateKeyPairSync('ec', { namedCurve })]));
  const pair = (version: string) => {
    const found = pairs.get(version);
    if (!found) {
      throw new Error(`Unknown key version ${version}`);
    }
    return found;
  };

  return {
    async publicKeyPem(version) {
      return pair(version).publicKey.export({ type: 'spki', format: 'pem' }).toString();
    },
    async sign(version, data) {
      return sign('sha256', data, { key: pair(version).privateKey, dsaEncoding: 'der' });
    },
    privateKey(version) {
      return pair(version).privateKey;
    },
  };
}
