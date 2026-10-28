import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import TreeGroup from './TreeGroup.svelte';

const meta = createRawSnippet(() => ({ render: () => '<span>3 waiting</span>' }));
const children = createRawSnippet(() => ({ render: () => '<a href="/resources/r1">Saved searches</a>' }));

describe('a group of a Tree (Tree, Fold box)', () => {
  it('unfolds what it holds, and folds it away with its arrow', async () => {
    render(TreeGroup, { icon: 'tray', name: 'Zonder Collection', urgent: true, meta, children });
    const toggle = screen.getByRole('button', { name: 'Toon wat Zonder Collection bevat' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Saved searches' })).toBeTruthy();
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'Saved searches' })).toBeNull();
  });

  it('links its head to its own page, when it has one', () => {
    render(TreeGroup, { href: '/collections/c1', icon: 'tray', name: 'Leads', meta, children });
    expect(screen.getByRole('link', { name: /Leads/ }).getAttribute('href')).toBe('/collections/c1');
  });
});
