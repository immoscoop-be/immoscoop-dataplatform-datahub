import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SqlEditor from './SqlEditor.svelte';

const content = () => screen.getByRole('textbox', { name: 'SQL' });

describe('the SQL editor', () => {
  it('runs the query with Cmd+Enter, or Ctrl+Enter, as its button does (DEC-UX-142)', async () => {
    const onrun = vi.fn();
    render(SqlEditor, { value: 'select 1', suggestions: [], label: 'SQL', onrun });
    await fireEvent.keyDown(content(), { key: 'Enter', ctrlKey: true });
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it('offers its templates among the suggestions, marked as such (DEC-UX-141)', async () => {
    render(SqlEditor, { value: '', suggestions: [], label: 'SQL' });
    const editor = content();
    editor.focus();
    // Ctrl+Space asks for the suggestions, as typing does.
    await fireEvent.keyDown(editor, { key: ' ', code: 'Space', ctrlKey: true });
    const listed = await vi.waitFor(() => {
      const options = [...document.querySelectorAll('.cm-tooltip-autocomplete li')].map((option) => option.textContent ?? '');
      expect(options.some((option) => option.startsWith('where true and'))).toBe(true);
      return options;
    });
    expect(listed.filter((option) => option.endsWith('Sjabloon')).map((option) => option.replace('Sjabloon', ''))).toEqual(['select … from', 'where false or', 'where true and']);
  });
});
