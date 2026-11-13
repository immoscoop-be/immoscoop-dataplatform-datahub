import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SqlEditor, { writtenAs } from './SqlEditor.svelte';

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
    expect(listed.filter((option) => option.endsWith('Sjabloon')).map((option) => option.replace('Sjabloon', ''))).toEqual(['count(*) as …Count', 'final as … order by', 'select … from', 'where false or', 'where true and', 'with … as']);
  });

  it('proposes count(*) as …Count on count(*, with the name before Count to type (DEC-UX-235)', async () => {
    render(SqlEditor, { value: 'select\n    count(*', suggestions: [], label: 'SQL' });
    const editor = content();
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await fireEvent.keyDown(editor, { key: ' ', code: 'Space', ctrlKey: true });
    const options = await vi.waitFor(() => {
      const listed = [...document.querySelectorAll('.cm-tooltip-autocomplete li')];
      expect(listed.length).toBe(1);
      return listed;
    });
    expect(options[0]?.textContent).toBe('count(*) as …CountSjabloon');
    await fireEvent.mouseDown(options[0] as Element);
    expect(editor.textContent).toContain('count(*) as rowCount');
    // `row` is selected: what the User types takes its place
    expect(document.getSelection()?.toString()).toBe('row');
  });

  it('tells which word the cursor is on that a double-click explains, and opens it as a double-click does (DEC-UX-238)', async () => {
    const oncursor = vi.fn();
    const onexplain = vi.fn();
    const { component } = render(SqlEditor, {
      value: 'select\n    lead_source',
      suggestions: [{ name: 'lead_source', type: 'STRING', resource: 'Weekly', role: null, description: '', businessDescription: '' }],
      label: 'SQL',
      oncursor,
      onexplain,
    });
    const editor = content();
    editor.focus();
    expect(component.explainAtCursor()).toBe(false);
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await vi.waitFor(() => expect(oncursor).toHaveBeenLastCalledWith({ kind: 'field', name: 'lead_source' }));
    expect(component.explainAtCursor()).toBe(true);
    expect(onexplain).toHaveBeenCalledWith(expect.objectContaining({ kind: 'field', name: 'lead_source' }));
    // Off the word, it says so once.
    await fireEvent.keyDown(editor, { key: 'Home', code: 'Home', ctrlKey: true });
    await vi.waitFor(() => expect(oncursor).toHaveBeenLastCalledWith(null));
  });

  it('starts a new line at the indent of the line above on Enter, never more or less (DEC-UX-234)', async () => {
    render(SqlEditor, { value: 'with leads as (\n    select\n        week_start,', suggestions: [], label: 'SQL' });
    const editor = content();
    editor.focus();
    await fireEvent.keyDown(editor, { key: 'End', code: 'End', ctrlKey: true });
    await fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter' });
    const lines = [...editor.querySelectorAll('.cm-line')].map((line) => line.textContent);
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('        ');
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

  it('colours the SQL by kind of word, and puts a dotted line under what a double-click explains (DEC-UX-222, DEC-UX-223)', async () => {
    render(SqlEditor, {
      value: "select week_start, count(*) as n\nfrom `p.dbt.weekly`\nwhere week_start >= @dateFrom and lead_source = 'web' and n > 1 and channel = @leadChannel",
      suggestions: [{ name: 'week_start', type: 'DATE', resource: 'Weekly', role: { kind: 'partition' }, description: '', businessDescription: '' }],
      parameters: [{ name: 'dateFrom', type: 'DATE', value: '2026-01-01' }],
      tables: [{ id: 'r2', name: 'Weekly', fullName: 'p.dbt.weekly' }],
      marks: [{ from: 131, to: 143, message: '@leadChannel is no Parameter', kind: 'undefined' }],
      label: 'SQL',
    });
    const explained = await vi.waitFor(() => {
      const found = [...document.querySelectorAll('.cm-explain')].map((element) => [element.textContent, element.getAttribute('title')]);
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    // A Parameter, the Resource by its table and each use of its field; not a word it does not know, nor an error.
    expect(explained).toEqual([
      ['week_start', 'Dubbelklik voor de beschrijvingen'],
      ['`p.dbt.weekly`', 'Dubbelklik voor de samenvatting'],
      ['week_start', 'Dubbelklik voor de beschrijvingen'],
      ['@dateFrom', 'Dubbelklik om deze Parameter te openen'],
    ]);
    const words = (kind: string) => [...document.querySelectorAll(`.${kind}`)].map((element) => element.textContent);
    expect(words('cm-kw')).toEqual(expect.arrayContaining(['select', 'count', 'as', 'from', 'where', 'and']));
    expect(words('cm-num')).toEqual(['1']);
    expect(words('cm-string')).toEqual(["'web'"]);
  });

  it('knows a table as written in the SQL, in full or by its dataset, in any case', () => {
    const table = { fullName: 'Immoscoop-Dataplatform.dbt_prod.Weekly' };
    expect(writtenAs('`immoscoop-dataplatform.dbt_prod.weekly`', table)).toBe(true);
    expect(writtenAs('dbt_prod.WEEKLY', table)).toBe(true);
    expect(writtenAs('weekly', table)).toBe(false);
    expect(writtenAs('v.weekly', table)).toBe(false);
  });
});
