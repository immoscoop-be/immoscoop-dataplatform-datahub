import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import InPlaceHead from './InPlaceHead.svelte';

const base = { name: 'Leads in', nameLabel: 'Naam', descriptionLabel: 'Beschrijving' };

describe('a name and description edited in place (DEC-UX-162)', () => {
  it('turns both into fields with a click, and saves only what changed', async () => {
    const onsave = vi.fn(async () => undefined);
    render(InPlaceHead, { ...base, description: 'Every lead.', canEdit: true, onsave });
    await fireEvent.click(screen.getByRole('button', { name: 'Every lead.' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Beschrijving' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Beschrijving' }), { target: { value: ' Every lead, as it comes in. ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    expect(onsave).toHaveBeenCalledWith({ description: 'Every lead, as it comes in.' });
  });

  it('cancels with Escape, saves nothing when nothing changed, and keeps a name required', async () => {
    const onsave = vi.fn(async () => undefined);
    render(InPlaceHead, { ...base, description: '', canEdit: true, onsave });
    await fireEvent.click(screen.getByRole('button', { name: 'Een beschrijving toevoegen' }));
    await fireEvent.keyDown(screen.getByRole('textbox', { name: 'Beschrijving' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Leads in' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    expect(onsave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Leads in' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Naam' }), { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: 'Bewaren' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows what was refused, and stays open', async () => {
    render(InPlaceHead, { ...base, canEdit: true, onsave: async () => 'Er bestaat al een Collection met die naam.' });
    await fireEvent.click(screen.getByRole('button', { name: 'Leads in' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Listings' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Er bestaat al een Collection met die naam.');
    expect(screen.getByRole('textbox', { name: 'Naam' })).toBeTruthy();
  });

  it('is plain text for whoever may not change it', () => {
    render(InPlaceHead, { ...base, description: 'Every lead.', canEdit: false, onsave: async () => undefined });
    expect(screen.getByRole('heading', { level: 1, name: 'Leads in' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
