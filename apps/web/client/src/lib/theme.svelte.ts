import type { Theme } from '@datahub/ui/foundations/backgrounds.js';
import type { Settings } from './settings.svelte.js';

/** The theme of the system, which the sign-in follows, and Data Hub until the User switches (Themes). */
export class SystemTheme {
  current = $state<Theme>('light');

  constructor() {
    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-color-scheme: dark)');
      this.current = query.matches ? 'dark' : 'light';
      query.addEventListener('change', (event) => {
        this.current = event.matches ? 'dark' : 'light';
      });
    }
  }
}

/** The theme on screen: the one the User switched to, remembered, or else the theme of the system. */
export function themeOf(settings: Settings, system: SystemTheme): Theme {
  return settings.values.theme ?? system.current;
}
