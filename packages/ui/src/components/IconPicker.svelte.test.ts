import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import IconPicker from './IconPicker.svelte';

describe('the choice of an icon (Icon picker, DEC-CO-19)', () => {
  it('suggests icons for the domains of Immoscoop, and finds others by their words', async () => {
    render(IconPicker, { value: null });
    expect(await screen.findByRole('radio', { name: 'coins' })).toBeTruthy();
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'money' } });
    expect(await screen.findByRole('radio', { name: 'money wavy' })).toBeTruthy();
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'qqqq' } });
    expect(screen.getByText('Geen icoon gevonden voor “qqqq”.')).toBeTruthy();
  });

  it('chooses one, and keeps the chosen one in view', async () => {
    render(IconPicker, { value: 'rocket' });
    const rocket = await screen.findByRole('radio', { name: 'rocket' });
    expect(rocket.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(await screen.findByRole('radio', { name: 'bank' }));
    expect(screen.getByRole('radio', { name: 'bank' }).getAttribute('aria-checked')).toBe('true');
  });
});
