import { describe, expect, it, vi } from 'vitest';
import { Settings } from './settings.svelte.js';

describe('the settings of the User (DEC-UX-96)', () => {
  it('change on screen at once, and are saved in Data Hub', () => {
    const save = vi.fn(async () => {});
    const settings = new Settings({ language: 'nl' }, save);
    settings.set('language', 'en');
    expect(settings.values).toEqual({ language: 'en' });
    expect(save).toHaveBeenCalledWith('language', 'en');
  });

  it('save nothing when the value stays the same', () => {
    const save = vi.fn(async () => {});
    new Settings({ theme: 'dark' }, save).set('theme', 'dark');
    expect(save).not.toHaveBeenCalled();
  });

  it('keep a change that could not be saved for this visit, and tell the console', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const settings = new Settings({}, async () => {
      throw new Error('identity answered 503');
    });
    settings.set('panel.open', false);
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('The setting panel.open could not be saved', expect.any(Error)));
    expect(settings.values['panel.open']).toBe(false);
    error.mockRestore();
  });
});
