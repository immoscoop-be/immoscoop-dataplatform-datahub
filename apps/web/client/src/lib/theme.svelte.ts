import type { Theme } from '@datahub/ui/foundations/backgrounds.js';

/**
 * The theme on screen (DEC-UX-172): always that of the system, also while Data Hub is open, and the
 * same for the sign-in. The switch in the rail turns it for this session only: nothing is remembered,
 * and the next change of the system follows the system again.
 */
export class ThemeOnScreen {
  #system = $state<Theme>('light');
  #switched = $state<Theme | undefined>();

  constructor() {
    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-color-scheme: dark)');
      this.#system = query.matches ? 'dark' : 'light';
      query.addEventListener('change', (event) => {
        this.#system = event.matches ? 'dark' : 'light';
        this.#switched = undefined;
      });
    }
  }

  get current(): Theme {
    return this.#switched ?? this.#system;
  }

  /** Turns to the other theme, for this session. */
  switch(): void {
    this.#switched = this.current === 'dark' ? 'light' : 'dark';
  }
}
