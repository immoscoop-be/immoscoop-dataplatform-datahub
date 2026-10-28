import { fireEvent, render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Rail, { type RailItem } from './Rail.svelte';

const ITEMS: readonly RailItem[] = [
  { id: 'collections', label: 'Collections', icon: 'stack-fill', href: '/collections' },
  { id: 'messages', label: 'Berichten', icon: 'chat-circle-text-fill', href: '/messages', unread: 3 },
];

function rail(props: Partial<ComponentProps<typeof Rail>> = {}) {
  const onselect = vi.fn();
  const ontheme = vi.fn();
  render(Rail, { items: ITEMS, active: 'collections', panelOpen: true, initials: 'MV', myPageHref: '/me', onselect, ontheme, ...props });
  return { onselect, ontheme };
}

describe('the rail', () => {
  it('links every section to its address, and marks the one the page is in', () => {
    rail();
    const collections = screen.getByRole('link', { name: 'Collections' });
    expect(collections.getAttribute('href')).toBe('/collections');
    expect(collections.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Berichten, 3 ongelezen' }).getAttribute('aria-current')).toBeNull();
  });

  it('leaves a plain click to the app, which applies the navigation rules', () => {
    const { onselect } = rail();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    screen.getByRole('link', { name: 'Collections' }).dispatchEvent(click);
    expect(onselect).toHaveBeenCalledWith('collections');
    expect(click.defaultPrevented).toBe(true);
  });

  it('opens a link as the browser does when a modifier is held', () => {
    const { onselect } = rail();
    let followed = false;
    // The test document cannot open another one: note that the browser would, and stop it.
    document.addEventListener('click', (event) => {
      followed = !event.defaultPrevented;
      event.preventDefault();
    }, { once: true });
    screen.getByRole('link', { name: 'Collections' }).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }));
    expect(onselect).not.toHaveBeenCalled();
    expect(followed).toBe(true);
  });

  it('switches the theme, and opens My page behind the initials with a ring while it is open (DEC-UX-84)', async () => {
    const { ontheme } = rail({ active: undefined, myPageActive: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Wissel tussen licht en donker' }));
    expect(ontheme).toHaveBeenCalledOnce();
    const me = screen.getByRole('link', { name: 'Mijn pagina' });
    expect(me.getAttribute('href')).toBe('/me');
    expect(me.getAttribute('aria-current')).toBe('page');
  });
});
