import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CollectionIcon from './CollectionIcon.svelte';

describe('the icon of a Collection', () => {
  it('draws the light icon of Phosphor it is named for, once it is loaded (DEC-CO-19)', async () => {
    const { container } = render(CollectionIcon, { name: 'house-line' });
    await expect.poll(() => container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.collection-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws nothing for an icon Phosphor does not have, or none', async () => {
    const { container } = render(CollectionIcon, { name: 'gone-in-a-later-version' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('svg')).toBeNull();
    expect(render(CollectionIcon, { name: null }).container.querySelector('svg')).toBeNull();
  });
});
