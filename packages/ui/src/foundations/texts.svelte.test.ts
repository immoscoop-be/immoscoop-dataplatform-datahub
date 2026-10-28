import { afterEach, describe, expect, it } from 'vitest';
import { addTexts, currentLanguage, hasText, setLanguage, t } from './texts.svelte.js';

describe('the sentences of the interface (NFR-LOC-06)', () => {
  afterEach(() => setLanguage('nl'));

  it('are Dutch by default, and follow a change of language', () => {
    expect(currentLanguage()).toBe('nl');
    expect(t('rail.myPage')).toBe('Mijn pagina');
    setLanguage('en');
    expect(t('rail.myPage')).toBe('My page');
    expect(document.documentElement.lang).toBe('en');
  });

  it('take a name as a value, never translated (NFR-LOC-01)', () => {
    expect(t('rail.unread', { label: 'Messages', count: 2 })).toBe('Messages, 2 ongelezen');
  });

  it('take the sentences of an application besides their own', () => {
    addTexts({ nl: { 'test.hello': 'Dag {name}' }, en: { 'test.hello': 'Hello {name}' } });
    expect(hasText('test.hello')).toBe(true);
    expect(t('test.hello', { name: 'Max' })).toBe('Dag Max');
  });

  it('refuse a key that is not in the translation files', () => {
    expect(hasText('rail.nothing')).toBe(false);
    expect(() => t('rail.nothing')).toThrow('No sentence "rail.nothing"');
  });
});

describe('a sentence in pieces (NFR-LOC-03)', () => {
  it('gives each name back as a piece of its own, wherever the language puts it', async () => {
    const { addTexts, setLanguage, tParts } = await import('./texts.svelte.js');
    addTexts({ nl: { 'test.came': 'Kwam binnen via {exposure} in {project}.' }, en: { 'test.came': 'Came in through {exposure} in {project}.' } });
    expect(tParts('test.came', {}, { exposure: 'datahub_x', project: 'immoscoop_dbt' })).toEqual([
      { text: 'Kwam binnen via ' },
      { name: 'datahub_x' },
      { text: ' in ' },
      { name: 'immoscoop_dbt' },
      { text: '.' },
    ]);
    setLanguage('en');
    expect(tParts('test.came', {}, { exposure: 'datahub_x', project: 'p' })[0]).toEqual({ text: 'Came in through ' });
    setLanguage('nl');
  });
});
