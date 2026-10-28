import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../foundations/texts.svelte.js';
import LogList from './LogList.svelte';

const entries: { logId: string; params: Record<string, string>; at: string }[] = [
  { logId: 'RES-002', params: { level: '1', reason: 'fields-undescribed' }, at: '2026-10-21T08:00:00Z' },
  { logId: 'RES-001', params: { exposure: 'datahub_savedSearches', key: 'p.d.saved_searches', run: '7' }, at: '2026-10-21T08:00:00Z' },
];

describe('a Log list (FR-SR-11, NFR-LOC-10)', () => {
  afterEach(() => setLanguage('nl'));

  it('shows each entry with its Log ID, its text in the language of the reader, and its day', () => {
    render(LogList, { entries });
    expect(screen.getByText('Maturiteit beoordeeld op Level 1')).toBeTruthy();
    expect(screen.getByText('Geregistreerd via de exposure datahub_savedSearches')).toBeTruthy();
    expect(screen.getAllByText('RES-001')).toHaveLength(1);
    expect(screen.getAllByText('21 okt')).toHaveLength(2);
  });

  it('follows a change of language', async () => {
    render(LogList, { entries });
    setLanguage('en');
    await Promise.resolve();
    expect(await screen.findByText('Registered through exposure datahub_savedSearches')).toBeTruthy();
    expect(screen.getAllByText('21 Oct')).toHaveLength(2);
  });
});
