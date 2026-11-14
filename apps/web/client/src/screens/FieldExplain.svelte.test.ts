import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TEXTS } from '../texts/index.js';
import FieldExplain from './FieldExplain.svelte';

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('nl');
});

describe('a field explained from the SQL (DEC-UX-221)', () => {
  it('shows its type, role and both descriptions once for each Resource that holds it, and goes with Escape', async () => {
    const onclose = vi.fn();
    render(FieldExplain, {
      fields: [
        { name: 'lead_source', type: 'STRING', resource: 'Weekly lead volume', role: { kind: 'cluster', place: 1 }, description: 'Source system code of the lead.', businessDescription: 'Where the lead came in.' },
        { name: 'lead_source', type: 'STRING', resource: 'Lead sources', role: null, description: 'Source system code.', businessDescription: '' },
      ],
      at: { left: 100, right: 180, top: 100, bottom: 118 },
      onclose,
    });
    const pop = screen.getByRole('dialog', { name: 'lead_source' });
    expect(pop.textContent).toContain('STRING · Weekly lead volume');
    expect(pop.textContent).toContain('Where the lead came in.');
    expect(pop.textContent).toContain('Source system code of the lead.');
    expect(pop.textContent).toContain('STRING · Lead sources');
    // The Owner wrote none for Lead sources: it says so, next to the description from dbt.
    expect(pop.textContent).toContain('Nog geen Business Description.');
    await new Promise((done) => setTimeout(done));
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(onclose).toHaveBeenCalled();
  });

  it('shows a field of a table outside Data Hub with its type and its description from dbt, without missing an Owner (FR-SR-62)', () => {
    render(FieldExplain, {
      fields: [{ name: 'lead_id', type: 'STRING', resource: 'stg_oltp__leads', role: null, description: 'Id of the lead.', businessDescription: '', outside: true }],
      at: { left: 100, right: 160, top: 100, bottom: 118 },
      onclose: () => {},
    });
    const pop = screen.getByRole('dialog', { name: 'lead_id' });
    expect(pop.textContent).toContain('STRING · stg_oltp__leads');
    expect(pop.textContent).toContain('Id of the lead.');
    expect(pop.textContent).not.toContain('Nog geen Business Description.');
  });
});
