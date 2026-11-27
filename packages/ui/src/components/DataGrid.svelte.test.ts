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

  it('drags a column narrower or wider by the edge of its head, and fits it again with a double click or its menu (DEC-UX-72)', async () => {
    render(DataGrid, { columns, rows, label: 'Result' });
    const width = () => (screen.getByRole('grid').querySelectorAll('col')[1] as HTMLElement).style.width;
    const fitted = width();
    const edge = screen.getByRole('separator', { name: 'Breedte van lead_source' });
    edge.setPointerCapture = () => {};
    await fireEvent.pointerDown(edge, { clientX: 300, pointerId: 1 });
    await fireEvent.pointerMove(edge, { clientX: 450, pointerId: 1 });
    await fireEvent.pointerUp(edge, { clientX: 450, pointerId: 1 });
    // Its width was a computed value, which changing in place did not move: the drag did nothing in the app.
    expect(width()).toBe(`${Number.parseInt(fitted, 10) + 150}px`);
    await fireEvent.dblClick(edge);
    expect(width()).toBe(fitted);

    await fireEvent.pointerDown(edge, { clientX: 300, pointerId: 1 });
    await fireEvent.pointerMove(edge, { clientX: 250, pointerId: 1 });
    await fireEvent.pointerUp(edge, { clientX: 250, pointerId: 1 });
    expect(width()).toBe(`${Number.parseInt(fitted, 10) - 50}px`);
    await fireEvent.click(screen.getByRole('button', { name: 'Kolom lead_source' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Kolom passend maken' }));
    expect(width()).toBe(fitted);
  });

  it('drags a row taller, so that its values wrap, and puts it back on one line with a double click (DEC-UX-352)', async () => {
    const long = '{"floorNumber":"0","propertyTypes":"appartement","offerType":"te-koop","priceMax":350000}';
    render(DataGrid, { columns, rows: [[long, '1'], ['app', '84']], label: 'Result' });
    const edge = screen.getByRole('separator', { name: /Rij 1 hoger of lager maken/ });
    const row = edge.closest('tr') as HTMLTableRowElement;
    expect(row.classList.contains('tall')).toBe(false);
    edge.setPointerCapture = () => {};
    await fireEvent.pointerDown(edge, { clientY: 100, pointerId: 1 });
    await fireEvent.pointerMove(edge, { clientY: 220, pointerId: 1 });
    await fireEvent.pointerUp(edge, { clientY: 220, pointerId: 1 });
    expect(row.classList.contains('tall')).toBe(true);
    expect(row.style.height).toMatch(/px$/);
    // Its long value is whole, in a block that wraps; the other row stays on one line.
    expect(within(row).getByText(long).classList.contains('value')).toBe(true);
    expect((screen.getByRole('separator', { name: /Rij 2/ }).closest('tr') as HTMLElement).classList.contains('tall')).toBe(false);

    await fireEvent.dblClick(edge);
    expect(row.classList.contains('tall')).toBe(false);
    expect(row.style.height).toBe('');
  });
});
