import { chooseBackground, RANDOM, type Background, type Theme } from '@datahub/ui/foundations/backgrounds.js';
import type { Settings } from './settings.svelte.js';

/**
 * The background on screen (DEC-UX-108): the one the User chose for the theme, or Random, the
 * default: one picked at random when Data Hub starts, kept while the theme stays, and picked again
 * when the User switches between day and night, or chooses Random (DEC-UX-94).
 */
export class Backgrounds {
  readonly #settings: Settings;
  readonly #random: () => number;
  #picked: { theme: Theme; background: Background } | undefined;

  constructor(settings: Settings, random: () => number = Math.random) {
    this.#settings = settings;
    this.#random = random;
  }

  /** What the User chose for the theme: a background of its set, or Random. */
  choiceOf(theme: Theme): string {
    return this.#settings.values[`background.${theme}`] ?? RANDOM;
  }

  of(theme: Theme): Background {
    const choice = this.choiceOf(theme);
    if (choice !== RANDOM) {
      return chooseBackground(theme, choice, this.#random);
    }
    if (this.#picked?.theme !== theme) {
      this.#picked = { theme, background: chooseBackground(theme, RANDOM, this.#random) };
    }
    return this.#picked.background;
  }

  choose(theme: Theme, choice: string): void {
    if (choice === RANDOM) {
      this.#picked = undefined;
    }
    this.#settings.set(`background.${theme}`, choice);
  }
}
