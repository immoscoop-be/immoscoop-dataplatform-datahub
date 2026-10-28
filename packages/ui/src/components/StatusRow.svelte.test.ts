import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
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
