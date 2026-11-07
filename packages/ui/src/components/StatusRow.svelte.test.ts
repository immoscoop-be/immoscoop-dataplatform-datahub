import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatusRow from './StatusRow.svelte';

describe('the status row (DEC-UX-07)', () => {
  it('shows the Level, that it is not published, and that it has no Owner yet', () => {
    const { container } = render(StatusRow, { level: 1, published: false, owner: null });
    expect(container.textContent).toContain('1 · Available');
    expect(screen.getByText('Niet gepubliceerd')).toBeTruthy();
    expect(screen.getByText('Nog geen Owner')).toBeTruthy();
  });

  it('names its Owner as it is', () => {
    render(StatusRow, { level: 3, published: true, owner: 'Credit team' });
    expect(screen.getByText('Credit team')).toBeTruthy();
    expect(screen.queryByText('Niet gepubliceerd')).toBeNull();
  });
});

describe('the Level explained by the Learning Centre (Explain on rest, DEC-UX-57)', () => {
  const pop = createRawSnippet(() => ({ render: () => '<div><a href="/learning/K5.2">K5.2 The Level of a Resource</a></div>' }));
  const explainLevel = { label: 'Uitgelegd in 1 Learning Card', active: false, pop };
  const level = () => screen.getByRole('button', { name: /4 · Explored/ });

  afterEach(() => vi.useRealTimers());

  it('carries the marker, and opens its pop-out only when the pointer rests on it for a second', async () => {
    vi.useFakeTimers();
    render(StatusRow, { level: 4, published: true, owner: 'Credit team', explainLevel });
    expect(level().textContent).toContain('ⓘ');
    expect(level().getAttribute('aria-haspopup')).toBe('dialog');
    await fireEvent.pointerEnter(level(), { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(600);
    await fireEvent.pointerLeave(level(), { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.pointerEnter(level(), { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByRole('dialog', { name: 'Uitgelegd in 1 Learning Card' }).textContent).toContain('K5.2');
    expect(level().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens from the keyboard at once, and closes on Escape', async () => {
    render(StatusRow, { level: 4, published: true, owner: 'Credit team', explainLevel });
    await fireEvent.keyDown(level(), { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    await fireEvent.keyDown(level(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on a tap on its marker', async () => {
    const { container } = render(StatusRow, { level: 4, published: true, owner: 'Credit team', explainLevel });
    const mark = [...container.querySelectorAll('span')].find((span) => span.textContent === 'ⓘ')!;
    await fireEvent.pointerDown(mark, { pointerType: 'touch' });
    await fireEvent.click(mark);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('carries no marker when nothing explains it', () => {
    const { container } = render(StatusRow, { level: 4, published: true, owner: 'Credit team' });
    expect(container.textContent).not.toContain('ⓘ');
  });
});
