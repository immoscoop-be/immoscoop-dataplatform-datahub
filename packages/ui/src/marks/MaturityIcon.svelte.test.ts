import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MaturityIcon from './MaturityIcon.svelte';

describe('the maturity icon (Maturity)', () => {
  it('fills its six bars up to the Level, and names it on hover', () => {
    const { container } = render(MaturityIcon, { level: 2 });
    const icon = screen.getByRole('img', { name: 'Maturiteit 2 · Described' });
    expect(icon.dataset.name).toBe('2 · Described');
    expect([...container.querySelectorAll('rect')].map((bar) => bar.classList.contains('on'))).toEqual([true, true, true, false, false, false]);
  });

  it('outlines the previous Level after a drop', () => {
    const { container } = render(MaturityIcon, { level: 1, previous: 3 });
    expect(container.querySelectorAll('rect.was')).toHaveLength(1);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Maturiteit 1 · Available (was 3 · Confirmed)');
  });

  it('is small and without its name on hover where the name stands next to it', () => {
    const { container } = render(MaturityIcon, { level: 1, small: true, tooltip: false });
    expect(container.querySelector('.maturity')?.classList.contains('small')).toBe(true);
    expect(screen.getByRole('img').dataset.name).toBeUndefined();
  });
});
