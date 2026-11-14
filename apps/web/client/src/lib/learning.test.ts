import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { describe, expect, it } from 'vitest';
import { cardIn, continued, createLearning, drawExample, newAndChanged, type Progress, seenOf, suggestedCards, suggestedLevels, TOPICS, topicOf, writtenCards } from './learning.js';

const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', queryUrl: 'https://query.test', semgraphUrl: 'https://semgraph.test' };

const seen = (card: string, lastAt: string, understoodAt: string | null = null): Progress => ({ card, seenAt: lastAt, lastAt, step: 'see', understoodAt });

describe('the Learning Centre in the web app', () => {
  it('shows a draft outside prod only (DEC-LR-25)', () => {
    expect(writtenCards('uat').has('K3.4')).toBe(true);
    expect([...writtenCards('prod').values()].every((card) => card.status === 'reviewed')).toBe(true);
    expect(writtenCards('prod').has('K3.4')).toBe(false);
  });

  it('reads a card in Dutch, and in English what has no translation', async () => {
    const shown = writtenCards('uat');
    const dutch = await cardIn('1.2.2', 'nl', shown);
    expect(dutch?.translatedFrom).toMatch(/^[0-9a-f]{12}$/);
    expect(dutch?.why.quote).not.toBe(shown.get('1.2.2')?.why.quote);
    expect(await cardIn('1.2.2', 'en', shown)).toBe(shown.get('1.2.2'));
    expect(await cardIn('9.9.9', 'nl', shown)).toBeNull();
  });

  it('suggests the Compass and Learning Level 1 to everyone, 4 to an owner, 3 and 4 to a Data Admin (DEC-LR-27)', () => {
    expect(suggestedLevels({ dataAdmin: false, owner: false })).toEqual(['compass', '1']);
    expect(suggestedLevels({ dataAdmin: false, owner: true })).toEqual(['compass', '1', '4']);
    expect(suggestedLevels({ dataAdmin: true, owner: false })).toEqual(['compass', '1', '3', '4']);
  });

  it('suggests the written cards of those Levels that are required, or of the Compass, until the User understands them', () => {
    const shown = writtenCards('uat');
    const levels = suggestedLevels({ dataAdmin: false, owner: false });
    // The written cards grow with every card the Data Team adds: hold the rule to known cards, not the whole list.
    const suggested = suggestedCards(levels, shown, []).map((topic) => topic.number);
    expect(suggested).toEqual(expect.arrayContaining(['K3.4', 'K5.1', 'K5.2', '1.2.1', '1.2.2']));
    expect(suggested.every((number) => shown.has(number))).toBe(true);
    expect(suggested).not.toContain('2.3.5'); // required, but of Learning Level 2
    expect(suggested).not.toContain('4.3.1'); // required, but of Learning Level 4
    expect(suggested.indexOf('K5.2')).toBeLessThan(suggested.indexOf('1.2.1')); // in the order of the plan, the Compass first
    expect(suggestedCards(levels, shown, [seen('K3.4', '2026-10-29T08:00:00Z', '2026-10-29T08:05:00Z')]).map((topic) => topic.number)).toEqual(suggested.filter((number) => number !== 'K3.4'));
  });

  it('counts the cards seen, silently, and continues the one read last and not understood yet (FR-LR-32)', () => {
    const shown = writtenCards('uat');
    const progress = [seen('K3.4', '2026-10-29T08:00:00Z'), seen('1.2.2', '2026-10-29T09:00:00Z', '2026-10-29T09:05:00Z'), seen('K5.1', '2026-10-28T09:00:00Z')];
    expect(seenOf(TOPICS.filter((topic) => topic.level === 'compass'), progress)).toEqual({ seen: 2, of: TOPICS.filter((topic) => topic.level === 'compass').length });
    expect(continued(shown, progress)?.card).toBe('K3.4');
    expect(continued(shown, [])).toBeUndefined();
  });

  it('names the cards new or changed in the last 30 days', () => {
    const shown = writtenCards('uat');
    expect(newAndChanged(shown, new Date('2026-10-30T12:00:00Z')).map((item) => [item.topic.number, item.added])).toContainEqual(['K3.4', true]);
    expect(newAndChanged(shown, new Date('2027-01-30T12:00:00Z'))).toEqual([]);
  });

  it('keeps the progress of the User in catalogue, with their Access Token', async () => {
    const asked: { method: string; url: string; body: unknown; authorization: string | null }[] = [];
    const learning = createLearning(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
      asked.push({ method: init?.method ?? 'GET', url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null, authorization: new Headers(init?.headers).get('authorization') });
      return Response.json(String(input).endsWith('/progress') ? { progress: [] } : { progress: seen('K3.4', '2026-10-29T08:00:00Z') });
    }) as typeof fetch);
    expect(await learning.progress()).toEqual([]);
    expect((await learning.open('K3.4', 'see')).card).toBe('K3.4');
    await learning.understand('K3.4', true);
    await learning.understand('K3.4', false);
    expect(asked).toEqual([
      { method: 'GET', url: 'https://catalogue.test/learning/progress', body: null, authorization: 'Bearer a-1' },
      { method: 'PUT', url: 'https://catalogue.test/learning/progress/K3.4', body: { step: 'see' }, authorization: 'Bearer a-1' },
      { method: 'PUT', url: 'https://catalogue.test/learning/progress/K3.4/understood', body: null, authorization: 'Bearer a-1' },
      { method: 'DELETE', url: 'https://catalogue.test/learning/progress/K3.4/understood', body: null, authorization: 'Bearer a-1' },
    ]);
  });

  it('has the Chart Server draw the example of See it in the theme of the page, as a picture (DEC-LR-26)', async () => {
    const sent: unknown[] = [];
    const drawn = await drawExample(config, { semgraph: 'categoryComparison' }, 'dark', (async (_input: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
    }) as typeof fetch);
    expect(drawn).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E');
    expect(sent).toEqual([{ semgraph: 'categoryComparison', theme: 'dark', size: 'default' }]);
    expect(await drawExample(config, { semgraph: 'x' }, 'light', (async () => new Response('', { status: 422 })) as typeof fetch)).toBeNull();
  });
});

describe('the cards the Message Catalogue points to (FR-LR-38, DEC-LR-29)', () => {
  it('are topics of the plan, under the title the plan gives them, so that a renamed topic is renamed there too', () => {
    for (const type of MESSAGE_CATALOGUE.filter((one) => one.status !== 'Withdrawn')) {
      const fit = type.learningCard;
      const card = fit.fit === 'named' || fit.fit === 'proposed' ? fit.card : fit.fit === 'toWrite' ? fit.nearest : undefined;
      if (!card) continue;
      expect(topicOf(card.number), `${type.id} points to ${card.number}`).toBeDefined();
      expect(card.title, `${type.id}: the title of ${card.number} in the plan`).toBe(topicOf(card.number)?.title.en);
    }
  });
});
