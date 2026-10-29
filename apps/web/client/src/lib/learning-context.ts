import { getContext, setContext } from 'svelte';
import type { Card, MarkerPlace, Progress } from './learning.js';

/** Where a card in the floating window was opened from: the pop-out of a marker, or a Message. */
export type OpenedFrom = MarkerPlace | 'message';

/**
 * What the Learning Centre lends to every page that explains its system text (FR-LR-35 to FR-LR-38): the written
 * cards, also in the language of the User; what the User did with them, read once something asks for it; and the
 * floating window a card opens in over the page, so that the User stays where they are (FR-LR-12).
 */
export interface LearningContext {
  /** The written cards this page shows, in English (DEC-LR-25). */
  readonly shown: ReadonlyMap<string, Card>;
  /** The same cards in the language of the User. */
  readonly cards: ReadonlyMap<string, Card>;
  /** What the User did with the cards: undefined until it is read, null when it could not be. */
  readonly progress: readonly Progress[] | null | undefined;
  /** The card open in the floating window, and where it was opened from. */
  readonly window: { card: string; from: OpenedFrom } | undefined;
  /** Something shows a card: read the progress and the translations, once. */
  want(): void;
  open(card: string, from: OpenedFrom): void;
  /** The User read a card where it stands, as inline in a Message: it is seen, if it was not yet (FR-LR-32). */
  seen(card: string): void;
  understand(card: string, understood: boolean): void;
}

const KEY = Symbol('learning');

export const provideLearning = (context: LearningContext): LearningContext => setContext(KEY, context);
/** The Learning Centre, where the app lends it; a part shown on its own, as in a test, explains nothing. */
export const useLearning = (): LearningContext | undefined => getContext<LearningContext | undefined>(KEY);
