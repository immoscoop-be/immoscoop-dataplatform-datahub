import { type AccessTokenSource, googleApiError } from '@datahub/google';

/** The artifact bucket, where the files of every run are kept unchanged (FR-AR-06). */
export interface Bucket {
  /** The file at `path`, or undefined when it is not there. */
  read(path: string): Promise<Uint8Array | undefined>;
  /** Stores a file once: a file already at `path` is never replaced. */
  write(path: string, bytes: Uint8Array): Promise<void>;
}

const SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

/** The artifact bucket through the Cloud Storage JSON API, as the service account of registry. */
export function createBucket(name: string, token: AccessTokenSource, request: typeof fetch = fetch): Bucket {
  const bucket = encodeURIComponent(name);
  const authorization = async () => `Bearer ${await token([SCOPE])}`;

  return {
    async read(path) {
      const response = await request(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`, {
        headers: { authorization: await authorization() },
      });
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw await googleApiError(`The bucket did not give ${path}`, response);
      }
      return new Uint8Array(await response.arrayBuffer());
    },

    async write(path, bytes) {
      const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`);
      url.search = new URLSearchParams({ uploadType: 'media', name: path, ifGenerationMatch: '0' }).toString();
      const response = await request(url, {
        method: 'POST',
        headers: { authorization: await authorization(), 'content-type': 'application/json' },
        body: bytes,
      });
      // 412: the file is already there, and stays as it was.
      if (!response.ok && response.status !== 412) {
        throw await googleApiError(`The bucket did not store ${path}`, response);
      }
    },
  };
}
