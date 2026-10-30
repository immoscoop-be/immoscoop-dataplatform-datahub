import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import PanelFilter from './PanelFilter.svelte';

const KINDS = [
  { value: 'previews', name: 'Voorbeelden', detail: 'van Resources', count: 6 },
  { value: 'hidden', name: 'Verborgen', detail: 'die je verborg', count: 3 },
];
const children = createRawSnippet(() => ({ render: () => '<input type="search" aria-label="Zoek">' }));

describe('the filter of a panel (DEC-UX-150)', () => {
  it('folds open a form with a checkbox per kind, says what it adds when folded, and resets', async () => {
    render(PanelFilter, { id: 'f', label: 'Filter', legend: 'Toon ook', kinds: KINDS, chosen: [], defaults: [], children });
    const toggle = screen.getByRole('button', { name: 'Filter' });
    expect(screen.getByRole('group', { hidden: true, name: 'Toon ook' }).closest('form')?.hidden).toBe(true);
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect((screen.getByRole('button', { name: 'Herstel' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('checkbox', { name: /Verborgen.*3$/ }));
    expect(toggle.textContent).toContain('1');
    await fireEvent.click(toggle);
    expect(screen.getByText('Ook getoond:')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Verborgen niet meer tonen' }));
    expect(screen.queryByText('Ook getoond:')).toBeNull();
    await fireEvent.click(toggle);
    await fireEvent.click(screen.getByRole('checkbox', { name: /Voorbeelden/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Herstel' }));
    expect((screen.getByRole('checkbox', { name: /Voorbeelden/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('keeps one kind ticked when every kind shows by itself', async () => {
    render(PanelFilter, { id: 'f', label: 'Filter', legend: 'Toon', kinds: KINDS, chosen: ['previews', 'hidden'], defaults: ['previews', 'hidden'], atLeastOne: true, children });
    await fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: /Voorbeelden/ }));
    expect((screen.getByRole('checkbox', { name: /Verborgen/ }) as HTMLInputElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByText('Niet getoond:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voorbeelden weer tonen' })).toBeTruthy();
  });
});
