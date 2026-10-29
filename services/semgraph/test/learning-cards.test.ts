import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll as after, beforeAll as before, describe, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { parseCard } from '../../../packages/learning/src/card.ts';
import { buildApp } from '../src/app.ts';
import { testRegistry } from './helpers.ts';

// The example of See it of every Learning Card is drawn by this Chart Server, from the figures in the card
// (DEC-LR-21, DEC-LR-26): each must be a request it draws without refusing or deviating.
const CARDS = join(import.meta.dirname, '..', '..', '..', 'packages', 'learning', 'cards');
const files = readdirSync(CARDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => ['en', 'nl'].map((language) => join(entry.name, `${language}.md`)))
  .filter((file) => {
    try {
      readFileSync(join(CARDS, file));
      return true;
    } catch {
      return false;
    }
  });

let app: FastifyInstance;

before(async () => {
  app = await buildApp({ registry: await testRegistry(), now: () => new Date('2026-10-29T10:00:00Z'), logger: false, mcp: { mode: 'off' } });
});
after(() => app.close());

describe('the examples of the Learning Cards', () => {
  it.each(files)('draws See it of %s', async (file) => {
    const card = parseCard(readFileSync(join(CARDS, file), 'utf8'));
    if (!card.see) return;
    const checked = await app.inject({ method: 'POST', url: '/validate', payload: card.see.chart });
    assert.equal(checked.json().outcome, 'ok', JSON.stringify(checked.json().issues));
    const drawn = await app.inject({ method: 'POST', url: '/render', payload: card.see.chart });
    assert.equal(drawn.statusCode, 200);
    assert.match(drawn.body, /^<svg/);
  });
});
