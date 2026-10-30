import type { Kysely } from 'kysely';
import type { CatalogueDatabase, LearningStep } from './database.js';

/** What a User did with a Learning Card: seen first, last open at a step, understood or not (FR-LR-32). */
export interface Progress {
  card: string;
  seenAt: Date;
  lastAt: Date;
  step: LearningStep;
  understoodAt: Date | null;
}

export interface Learning {
  /** Everything the User did with the cards, last opened first. */
  progress(userId: string): Promise<Progress[]>;
  /** The User has the card open at a step: seen from the first time, and where they are now. */
  open(userId: string, card: string, step: LearningStep): Promise<Progress>;
  /** "I understand it", or undone (FR-LR-05, FR-LR-28): understanding a card also sees it. */
  understand(userId: string, card: string, understood: boolean): Promise<Progress>;
}

const COLUMNS = ['card', 'seenAt', 'lastAt', 'step', 'understoodAt'] as const;

/** The progress of every User in the Learning Centre, which only they and the Data Team see (DEC-LR-13). */
export function createLearning(db: Kysely<CatalogueDatabase>, now: () => Date = () => new Date()): Learning {
  return {
    async progress(userId) {
      return db.selectFrom('learningProgress').select(COLUMNS).where('userId', '=', userId).orderBy('lastAt', 'desc').orderBy('card').execute();
    },

    async open(userId, card, step) {
      return db
        .insertInto('learningProgress')
        .values({ userId, card, step, seenAt: now(), lastAt: now() })
        .onConflict((conflict) => conflict.columns(['userId', 'card']).doUpdateSet({ step, lastAt: now() }))
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
    },

    async understand(userId, card, understood) {
      const understoodAt = understood ? now() : null;
      return db
        .insertInto('learningProgress')
        .values({ userId, card, step: 'can', seenAt: now(), lastAt: now(), understoodAt })
        .onConflict((conflict) => conflict.columns(['userId', 'card']).doUpdateSet({ understoodAt, lastAt: now() }))
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
    },
  };
}
