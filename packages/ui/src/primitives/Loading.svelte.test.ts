import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Loading from './Loading.svelte';

describe('three dots while something is read (DEC-UX-165)', () => {
  it('says what it is to screen readers, as an indeterminate progress bar', () => {
    render(Loading);
    const dots = screen.getByRole('progressbar', { name: 'Laden…' });
    expect(dots.querySelectorAll('.dot')).toHaveLength(3);
    expect(dots.getAttribute('aria-valuenow')).toBeNull();
  });

  it('takes a name of its own, and sits in a line when it is small', () => {
    render(Loading, { label: 'De lineage wordt gelezen', inline: true });
    expect(screen.getByRole('progressbar', { name: 'De lineage wordt gelezen' }).classList.contains('inline')).toBe(true);
  });
});
