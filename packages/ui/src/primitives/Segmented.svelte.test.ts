import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Segmented from './Segmented.svelte';

const OPTIONS = [
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'English' },
] as const;

describe('a segmented control', () => {
  it('has one choice on, and is one stop for Tab', () => {
    render(Segmented<'nl' | 'en'>, { options: OPTIONS, value: 'nl', label: 'Taal' });
    const [nl, en] = screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: 'Taal' })).toBeTruthy();
    expect(nl?.getAttribute('aria-checked')).toBe('true');
    expect(en?.getAttribute('aria-checked')).toBe('false');
    expect([nl?.tabIndex, en?.tabIndex]).toEqual([0, -1]);
  });

  it('switches with a click, and says so only when the choice changes', async () => {
    const onchange = vi.fn();
    render(Segmented<'nl' | 'en'>, { options: OPTIONS, value: 'nl', label: 'Taal', onchange });
    await fireEvent.click(screen.getByRole('radio', { name: 'Nederlands' }));
    expect(onchange).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(onchange).toHaveBeenCalledWith('en');
    expect(screen.getByRole('radio', { name: 'English' }).getAttribute('aria-checked')).toBe('true');
  });

  it('switches with the arrows, moving the focus along', async () => {
    const onchange = vi.fn();
    render(Segmented<'nl' | 'en'>, { options: OPTIONS, value: 'nl', label: 'Taal', onchange });
    const nl = screen.getByRole('radio', { name: 'Nederlands' });
    nl.focus();
    await fireEvent.keyDown(nl, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith('en');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'English' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenLastCalledWith('nl');
  });
});
