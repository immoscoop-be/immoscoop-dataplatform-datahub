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
    expect(listed.filter((option) => option.endsWith('Sjabloon')).map((option) => option.replace('Sjabloon', ''))).toEqual(['final as … order by', 'select … from', 'where false or', 'where true and', 'with … as']);
  });

  it('suggests the Resources of the query after from, and a new Resource that starts a new query (DEC-UX-148)', async () => {
    const onnewtable = vi.fn();
    render(SqlEditor, { value: 'select *\nfrom ', suggestions: [], label: 'SQL', tables: [{ id: 'r2', name: 'Weekly lead volume', fullName: 'p.dbt.weekly_lead_Volume' }], onnewtable });
    const editor = content();
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await fireEvent.keyDown(editor, { key: ' ', code: 'Space', ctrlKey: true });
    const options = await vi.waitFor(() => {
      const listed = [...document.querySelectorAll('.cm-tooltip-autocomplete li')];
      expect(listed.length).toBe(2);
      return listed;
    });
    expect(options.map((option) => option.textContent)).toEqual(['Weekly lead volumeResource', 'Nieuwe Resource…begint een nieuwe query']);
    await fireEvent.mouseDown(options[1] as Element);
    expect(onnewtable).toHaveBeenCalledTimes(1);
  });

  it('suggests every other Resource the User may use after those of the query, and starts a new query with the one picked (DEC-UX-155)', async () => {
    const onothertable = vi.fn();
    const own = { id: 'r2', name: 'Weekly lead volume', fullName: 'p.dbt.weekly_lead_Volume' };
    const other = { id: 'r5', name: 'Lead sources', fullName: 'p.dbt.lead_sources', other: true };
    render(SqlEditor, { value: 'select *\nfrom ', suggestions: [], label: 'SQL', tables: [own, other], onothertable });
    const editor = content();
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await fireEvent.keyDown(editor, { key: ' ', code: 'Space', ctrlKey: true });
    const options = await vi.waitFor(() => {
      const listed = [...document.querySelectorAll('.cm-tooltip-autocomplete li')];
      expect(listed.length).toBe(2);
      return listed;
    });
    expect(options.map((option) => option.textContent)).toEqual(['Weekly lead volumeResource', 'Lead sourcesResource · nieuwe query']);
    await fireEvent.mouseDown(options[1] as Element);
    expect(onothertable).toHaveBeenCalledWith(other);
    expect(editor.textContent).toContain('`p.dbt.lead_sources`');
  });
});
