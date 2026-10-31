import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BackgroundPicker from './BackgroundPicker.svelte';

const names = () => screen.getAllByRole('radio').map((option) => option.querySelector('.item-title')?.textContent);

describe('the background picker (DEC-UX-108)', () => {
  it('offers Random first, then the set of the theme', () => {
    render(BackgroundPicker, { theme: 'dark', choice: 'random', onchoose: () => {} });
    expect(names()).toEqual(['Willekeurig', 'Verloop', 'Vloeiend verloop', 'Aurora', 'Embers', 'Dusk', 'Horizon', 'Lights on']);
    expect(screen.getByRole('radio', { name: /Willekeurig/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('rings the chosen one, and shows Random when the choice is not of this set', () => {
    const { rerender } = render(BackgroundPicker, { theme: 'light', choice: 'piste', onchoose: () => {} });
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Fresh piste');
    rerender({ theme: 'light', choice: 'aurora', onchoose: () => {} });
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Willekeurig');
  });

  it('chooses with a click or with the arrows', async () => {
    const onchoose = vi.fn();
    render(BackgroundPicker, { theme: 'light', choice: 'random', onchoose });
    await fireEvent.click(screen.getByRole('radio', { name: /Concrete/ }));
    expect(onchoose).toHaveBeenLastCalledWith('concrete');
    const random = screen.getByRole('radio', { name: /Willekeurig/ });
    random.focus();
    await fireEvent.keyDown(random, { key: 'ArrowRight' });
    expect(onchoose).toHaveBeenLastCalledWith('gradient');
    await fireEvent.keyDown(random, { key: 'ArrowLeft' });
    expect(onchoose).toHaveBeenLastCalledWith('peaks');
  });
});
