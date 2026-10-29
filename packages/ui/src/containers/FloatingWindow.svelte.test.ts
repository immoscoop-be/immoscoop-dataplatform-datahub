import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import FloatingWindow from './FloatingWindow.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Its value</p>' }));
const foot = createRawSnippet(() => ({ render: () => '<p>Save</p>' }));

describe('a floating window (Floating window, Lay over)', () => {
  it('is a dialog over a page that stays usable, named for what it holds', () => {
    render(FloatingWindow, { title: '@dateFrom', meta: 'Parameter of Leads', onclose: () => {}, children, foot });
    const window = screen.getByRole('dialog', { name: '@dateFrom' });
    expect(window.getAttribute('aria-modal')).toBe('false');
    expect(screen.getByText('Parameter of Leads')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('folds to its head, and unfolds again', async () => {
    render(FloatingWindow, { title: '@dateFrom', onclose: () => {}, children, foot });
    await fireEvent.click(screen.getByRole('button', { name: 'Dichtvouwen' }));
    expect(screen.queryByText('Its value')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Openvouwen' }));
    expect(screen.getByText('Its value')).toBeTruthy();
  });

  it('closes on Close, and on Escape within it', async () => {
    const onclose = vi.fn();
    render(FloatingWindow, { title: '@dateFrom', onclose, children });
    await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onclose).toHaveBeenCalledTimes(2);
  });
});
