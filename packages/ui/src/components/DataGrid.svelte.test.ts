import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DataGrid from './DataGrid.svelte';

const columns = [
  { name: 'lead_source', type: 'STRING' },
  { name: 'leads', type: 'INT64' },
];
const rows = [
  ['website', '413'],
  ['partner', null],
  ['app', '84'],
];

const cellsOf = (column: number) => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('gridcell')[column]?.textContent);

describe('the data grid of a result (DEC-UX-72)', () => {
  it('numbers its rows, types its columns, puts numbers to the right and shows null as such', () => {
    render(DataGrid, { columns, rows, first: 101, label: 'Result' });
    expect(screen.getByRole('grid', { name: 'Result' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /leads\s*INT64/ })).toBeTruthy();
    expect(screen.getAllByRole('row').slice(1).map((row) => row.firstElementChild?.textContent)).toEqual(['101', '102', '103']);
    expect(screen.getAllByRole('gridcell').find((cell) => cell.textContent === '413')?.classList.contains('num')).toBe(true);
    expect(screen.getByText('null').classList.contains('null')).toBe(true);
  });

  it('sorts this page only from the menu of a column, numbers as numbers and null last', async () => {
    render(DataGrid, { columns, rows, label: 'Result' });
    await fireEvent.click(screen.getByRole('button', { name: 'Kolom leads' }));
    expect(screen.getByText(/Sorteert enkel deze pagina/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Deze pagina oplopend sorteren' }));
    expect(cellsOf(1)).toEqual(['84', '413', 'null']);
    expect(screen.getByRole('columnheader', { name: /leads/ }).getAttribute('aria-sort')).toBe('ascending');
  });

  it('selects a cell with a click and copies it with Ctrl+C', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(DataGrid, { columns, rows, label: 'Result' });
    await fireEvent.click(screen.getByText('partner'));
    await fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' });
    expect(screen.getByText('app').getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(screen.getByRole('grid'), { key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('app');
  });
});
