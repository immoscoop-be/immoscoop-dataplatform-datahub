import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import FlowBox, { type FlowStep } from './FlowBox.svelte';

const step = (id: string, number: number | undefined, done: boolean, extra: Partial<FlowStep> = {}): FlowStep => ({
  id,
  name: `Step ${id}`,
  said: done ? `${id} is done` : `${id} is missing`,
  done,
  ...(number === undefined ? { icon: 'globe-simple-fill' as const } : { number }),
  warn: !done,
  what: `What of ${id}`,
  why: `Why of ${id}`,
  how: `How of ${id}`,
  go: `Go to ${id}`,
  ...extra,
});
const STEPS = [step('a', 1, true), step('b', 2, false, { card: { number: 'K5.16', title: 'Pitfalls' }, here: true }), step('c', 3, false), step('end', undefined, false)];

function box(props: Partial<Parameters<typeof render<typeof FlowBox>>[1] & object> = {}) {
  const handlers = { onstep: vi.fn(), oncard: vi.fn(), onobject: vi.fn(), onminimize: vi.fn(), onclose: vi.fn() };
  render(FlowBox, { title: 'Describe and publish', object: { label: 'Weekly lead volume' }, steps: STEPS, now: 'b', progress: '1 of 3 done', foot: 'Two to go.', ...handlers, ...props });
  return handlers;
}

describe('a Flow Box (DEC-UX-299)', () => {
  it('names its flow and its object, with its progress, and opens on the step to do now with Why, What and How, in that order (DEC-UX-321)', () => {
    box();
    const aside = within(screen.getByRole('complementary', { name: 'Describe and publish · Weekly lead volume' }));
    expect(aside.getByText('1 of 3 done')).toBeTruthy();
    expect(aside.getByRole('button', { name: /^Step b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(aside.getByRole('button', { name: /^Step a/ }).getAttribute('aria-expanded')).toBe('false');
    expect(aside.getByText('Why of b')).toBeTruthy();
    const terms = [...(aside.getByText('Why of b').closest('dl')?.querySelectorAll('dt') ?? [])].map((term) => term.textContent);
    expect(terms).toHaveLength(3);
    expect(aside.getByText('Why of b').previousElementSibling?.textContent).toBe(terms[0]);
    expect(aside.getByText('Open op de pagina')).toBeTruthy();
    expect(aside.getByText('Two to go.')).toBeTruthy();
  });

  it('is a guide: a step leads to its place, its card opens, and the object is a way back (DEC-UX-303)', async () => {
    const handlers = box();
    await fireEvent.click(screen.getByRole('button', { name: /Go to b/ }));
    expect(handlers.onstep).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    await fireEvent.click(screen.getByRole('button', { name: /K5\.16/ }));
    expect(handlers.oncard).toHaveBeenCalledWith('K5.16');
    await fireEvent.click(screen.getByRole('button', { name: 'Weekly lead volume' }));
    expect(handlers.onobject).toHaveBeenCalled();
  });

  it('opens another step by a click, and folds it again', async () => {
    box();
    const row = screen.getByRole('button', { name: /^Step c/ });
    await fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /^Step b/ }).getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  it('minimizes to a strip with its progress, which maximizes it again; and closes (DEC-UX-301, DEC-UX-302)', async () => {
    const handlers = box();
    await fireEvent.click(screen.getByRole('button', { name: 'Minimaliseren' }));
    expect(handlers.onminimize).toHaveBeenCalledWith(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    expect(handlers.onclose).toHaveBeenCalled();
  });

  it('as a strip, counts the steps done and opens again', async () => {
    const handlers = box({ minimized: true });
    const strip = within(screen.getByRole('complementary', { name: 'Describe and publish · Weekly lead volume · 1 of 3 done' }));
    expect(strip.getByText('1')).toBeTruthy();
    await fireEvent.click(strip.getByRole('button', { name: 'Maximaliseren' }));
    expect(handlers.onminimize).toHaveBeenCalledWith(false);
  });

  it('says once that the flow is through, in place of its steps', () => {
    box({ ended: createRawSnippet(() => ({ render: () => '<p>Published and confirmed</p>' })) });
    expect(screen.getByText('Published and confirmed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Step a/ })).toBeNull();
  });
});
