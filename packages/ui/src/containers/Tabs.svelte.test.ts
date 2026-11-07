import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs.svelte';

const pane = createRawSnippet(() => ({ render: () => '<p>Pane</p>' }));

describe('tabs', () => {
  it('marks the tab that is on, and names the pane after it', () => {
    render(Tabs, {
      label: 'Mijn pagina',
      current: 'background',
      tabs: [
        { id: 'profile', label: 'Profiel', href: '/me' },
        { id: 'background', label: 'Achtergrond', href: '/me/background' },
      ],
      children: pane,
    });
    expect(screen.getByRole('tab', { name: 'Achtergrond' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Profiel' }).getAttribute('href')).toBe('/me');
    expect(screen.getByRole('tabpanel', { name: 'Achtergrond' }).textContent).toBe('Pane');
  });

  it('moves between the tabs with the arrows, and opens one with a click', async () => {
    const onselect = vi.fn();
    render(Tabs, {
      label: 'Resource',
      current: 'overview',
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'fields', label: 'Fields' },
        { id: 'lineage', label: 'Lineage' },
      ],
      onselect,
      children: pane,
    });
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await fireEvent.keyDown(overview, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Lineage' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(overview);
    expect(onselect).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('tab', { name: 'Fields' }));
    expect(onselect).toHaveBeenCalledWith('fields');
  });
});
