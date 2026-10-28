import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Sheet from './Sheet.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Pick Resources</p>' }));
const foot = createRawSnippet(() => ({ render: () => '<p>2 selected</p>' }));

describe('a sheet (Sheet, Lay over)', () => {
  it('is a dialog named for its task, which takes the focus', () => {
    render(Sheet, { title: 'Add Resources to Leads', onclose: () => {}, children, foot });
    const dialog = screen.getByRole('dialog', { name: 'Add Resources to Leads' });
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('closes on Close, on Escape and on a click beside it', async () => {
    const onclose = vi.fn();
    const { container } = render(Sheet, { title: 'Add', onclose, children, foot });
    await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    await fireEvent.keyDown(window, { key: 'Escape' });
    await fireEvent.click(container.querySelector('.backdrop')!);
    expect(onclose).toHaveBeenCalledTimes(3);
  });
});
