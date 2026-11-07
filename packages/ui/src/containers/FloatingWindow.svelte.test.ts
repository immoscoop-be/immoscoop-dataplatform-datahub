import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import FloatingWindow from './FloatingWindow.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Its value</p>' }));
const foot = createRawSnippet(() => ({ render: () => '<p>Save</p>' }));

describe('a floating window (Floating window, Lay over)', () => {
  it('is a dialog over a page that stays usable, named for what it holds', () => {
    render(FloatingWindow, { title: '@dateFrom', meta: 'Parameter of Leads', onclose: () => {}, children, foot });
    const window = screen.getByRole('dialog', { name: '@dateFrom' });
    expect(window.getAttribute('aria-modal')).toBe('false');
    expect(screen.getByText('Parameter of Leads')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('hangs on the page itself, so that a frame with a backdrop filter does not move it while it is dragged', () => {
    const frame = document.createElement('main');
    document.body.appendChild(frame);
    render(FloatingWindow, { target: frame, props: { title: '@dateFrom', onclose: () => {}, children } });
    expect(screen.getByRole('dialog', { name: '@dateFrom' }).parentElement).toBe(document.body);
    frame.remove();
  });

  it('follows the pointer from where it was grabbed', async () => {
    render(FloatingWindow, { title: '@dateFrom', onclose: () => {}, children });
    const window = screen.getByRole('dialog', { name: '@dateFrom' });
    window.getBoundingClientRect = () => ({ left: 600, top: 400, width: 400, height: 300, right: 1000, bottom: 700, x: 600, y: 400, toJSON: () => ({}) });
    const head = window.querySelector('.head') as HTMLElement;
    await fireEvent.pointerDown(head, { clientX: 650, clientY: 410, pointerId: 1 });
    await fireEvent.pointerMove(head, { clientX: 550, clientY: 310, pointerId: 1 });
    expect([window.style.left, window.style.top]).toEqual(['500px', '300px']);
  });

  it('folds to its head, and unfolds again', async () => {
    render(FloatingWindow, { title: '@dateFrom', onclose: () => {}, children, foot });
    await fireEvent.click(screen.getByRole('button', { name: 'Dichtvouwen' }));
    expect(screen.queryByText('Its value')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Openvouwen' }));
    expect(screen.getByText('Its value')).toBeTruthy();
  });

  it('closes on Close, and on Escape within it', async () => {
    const onclose = vi.fn();
    render(FloatingWindow, { title: '@dateFrom', onclose, children });
    await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onclose).toHaveBeenCalledTimes(2);
  });
});
