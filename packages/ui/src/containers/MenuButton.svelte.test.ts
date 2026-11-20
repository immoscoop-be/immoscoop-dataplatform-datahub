import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import MenuButton from './MenuButton.svelte';

function setup() {
  const json = vi.fn();
  const csv = vi.fn();
  render(MenuButton, {
    icon: 'copy',
    label: 'Copy the result',
    caption: 'The first 100 of 210 rows',
    choices: [
      { key: 'json', icon: 'brackets-curly', label: 'Copy as JSON', hint: 'an object a row', run: json },
      { key: 'csv', icon: 'file-csv', label: 'Copy as CSV', run: csv },
    ],
  });
  return { json, csv, button: screen.getByRole('button', { name: 'Copy the result' }) };
}

describe('the menu button (DEC-UX-294)', () => {
  it('opens its menu on a click, with its caption, on its first choice, and looks pressed while open', async () => {
    const { json, button } = setup();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByRole('menu')).toBeNull();
    await fireEvent.click(button);
    await tick();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Copy the result' }).textContent).toContain('The first 100 of 210 rows');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy as JSON/ }));
    await fireEvent.click(screen.getByRole('menuitem', { name: /Copy as JSON/ }));
    expect(json).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('moves with the arrows, does a choice with Enter, and opens on the last with the up arrow', async () => {
    const { csv, button } = setup();
    await fireEvent.keyDown(button, { key: 'ArrowUp' });
    await tick();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy as CSV/ }));
    const menu = screen.getByRole('menu');
    await fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy as JSON/ }));
    await fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy as CSV/ }));
    await fireEvent.click(document.activeElement as HTMLElement);
    expect(csv).toHaveBeenCalledOnce();
  });

  it('closes on Escape with the focus back on the button, and on a click beside it', async () => {
    const { json, csv, button } = setup();
    await fireEvent.keyDown(button, { key: 'ArrowDown' });
    await tick();
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
    await fireEvent.click(button);
    await tick();
    await fireEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(json).not.toHaveBeenCalled();
    expect(csv).not.toHaveBeenCalled();
  });
});
