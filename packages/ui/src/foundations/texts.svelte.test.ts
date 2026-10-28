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
