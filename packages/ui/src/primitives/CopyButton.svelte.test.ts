import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CopyButton from './CopyButton.svelte';

describe('the copy button (Copy)', () => {
  it('copies what it stands next to', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(CopyButton, { text: 'p.dbt_prod_stacks.saved_searches', label: 'Key kopiëren' });
    await fireEvent.click(screen.getByRole('button', { name: 'Key kopiëren' }));
    expect(writeText).toHaveBeenCalledWith('p.dbt_prod_stacks.saved_searches');
  });
});
