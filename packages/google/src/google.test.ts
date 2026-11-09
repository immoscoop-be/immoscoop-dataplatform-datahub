import { describe, expect, it } from 'vitest';
import { googleApiError, metadataAccessToken, metadataIdToken, readSecret } from './index.js';

describe('metadataAccessToken', () => {
  it('asks the metadata server once per set of scopes until the token nearly expires', async () => {
    let calls = 0;
    let time = 0;
    const token = metadataAccessToken(async () => {
      calls++;
      return Response.json({ access_token: `t${calls}`, expires_in: 3600 });
    }, () => time);
    expect(await token(['a'])).toBe('t1');
    expect(await token(['a'])).toBe('t1');
    time += 3550 * 1000;
    expect(await token(['a'])).toBe('t2');
    expect(await token(['b'])).toBe('t3');
  });
});

describe('metadataIdToken', () => {
  it('asks the metadata server for an ID token per audience, with the address of the service account in it', async () => {
    const asked: string[] = [];
    let time = 0;
    const token = metadataIdToken(async (url, init) => {
      asked.push(String(url));
      expect(new Headers(init?.headers).get('metadata-flavor')).toBe('Google');
      return new Response(`id-${asked.length}\n`);
    }, () => time);
    expect(await token('https://catalogue.test')).toBe('id-1');
    expect(await token('https://catalogue.test')).toBe('id-1');
    time += 51 * 60 * 1000;
    expect(await token('https://catalogue.test')).toBe('id-2');
    expect(asked[0]).toBe('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=https%3A%2F%2Fcatalogue.test&format=full');
    await expect(metadataIdToken(async () => new Response('', { status: 404 }))('x')).rejects.toThrow('The metadata server gave no ID token: 404');
  });
});

describe('readSecret', () => {
  it('reads the value of a secret version from Secret Manager', async () => {
    let asked = '';
    const value = await readSecret('projects/p/secrets/s/versions/latest', async () => 'token', async (url) => {
      asked = url as string;
      return Response.json({ payload: { data: Buffer.from('the value').toString('base64') } });
    });
    expect(asked).toBe('https://secretmanager.googleapis.com/v1/projects/p/secrets/s/versions/latest:access');
    expect(value).toBe('the value');
  });

  it('fails with the reason Google gives, such as a secret without a version', async () => {
    const reading = readSecret('projects/p/secrets/s/versions/latest', async () => 'token', async () =>
      Response.json({ error: { message: 'Secret version [projects/p/secrets/s/versions/latest] not found.' } }, { status: 404 }),
    );
    await expect(reading).rejects.toThrow(/could not be read: 404 Secret version .* not found/);
  });
});

describe('googleApiError', () => {
  it('names the argument Google refused', async () => {
    const response = Response.json(
      { error: { message: 'Request contains an invalid argument.', details: [{ fieldViolations: [{ field: 'query', description: 'Unsupported filter' }] }] } },
      { status: 400 },
    );
    expect((await googleApiError('Asking', response)).message).toBe('Asking: 400 Request contains an invalid argument. · query: Unsupported filter');
    expect((await googleApiError('Asking', new Response('down', { status: 503 }))).message).toBe('Asking: 503');
  });
});
