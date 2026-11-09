import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Panel from './Panel.svelte';

const index = createRawSnippet(() => ({ render: () => '<a href="/collections/sales">Sales</a>' }));

describe('the panel', () => {
  it('shows the index of its section under its title, and slides in with its own button', async () => {
    const oncollapse = vi.fn();
    render(Panel, { open: true, title: 'Collections', oncollapse, children: index });
    expect(screen.getByRole('heading', { name: 'Collections' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sales' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Paneel sluiten' }));
    expect(oncollapse).toHaveBeenCalledOnce();
  });

  it('is out of reach while it is shut: no focus, and hidden from screen readers', () => {
    render(Panel, { open: false, title: 'Collections', oncollapse: () => {}, children: index });
    const panel = screen.getByRole('complementary', { hidden: true });
    expect(panel.inert).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('link', { name: 'Sales' })).toBeNull();
  });
});
