/**
 * The plan of the Learning Cards, from the master learning plan (DEC-LR-02, DEC-LR-25): the Compass, the four
 * Learning Levels from easy to advanced, each in sections, and the Reading Cards. Every topic is a Learning Card,
 * written or still to be written; the written ones are folders in `cards/` (DEC-LR-24). The titles are in English, as
 * the cards are written, with the Dutch of the master learning plan. Taken from Confluence on 2026-10-29.
 *
 * The plan is data, `cards/plan.json`, next to the cards it indexes, with its shape in `cards/plan.schema.json`
 * (TR-LR-01); this module gives it its types. A topic in the file names its section, not its Learning Level: the
 * Learning Level is the one of its section. Whether a topic is written follows from its folder, not from the file.
 */

import plan from '../cards/plan.json' with { type: 'json' };

/** The languages of a card: English, as it is written, and Dutch (DEC-LR-24). */
export type Language = 'en' | 'nl';

/** A text in both languages: English, as written, and Dutch (DEC-LR-24). */
export type Text = Readonly<Record<Language, string>>;

/** Where a card stands: the Compass, a Learning Level, or the Reading Cards. */
export type LevelId = 'compass' | '1' | '2' | '3' | '4' | 'reading';

/** How much a card matters, shown only as "Suggested" (DEC-LR-18). */
export type Priority = 'required' | 'recommended' | 'inDepth';

/** What the reader can do afterwards: recognise, apply or judge. */
export type Thinking = 'recognise' | 'apply' | 'judge';

export interface Level {
  readonly id: LevelId;
  /** Its name, a name in the sense of the language principle: the same in both languages (NFR-LOC-01). */
  readonly name: string;
  /** How far along the way it is, from easy to advanced. */
  readonly step: Text;
  /** For whom it is. */
  readonly about: Text;
  /** The icon of its audience, from Phosphor (DEC-UX-62). */
  readonly icon: string;
}

export interface Section {
  readonly level: LevelId;
  readonly number: string;
  readonly title: Text;
}

export interface Topic {
  readonly number: string;
  readonly level: LevelId;
  readonly section: string;
  readonly title: Text;
  readonly priority: Priority | null;
  readonly thinking: Thinking | null;
  /** The cards it builds on, from the prior knowledge of the master learning plan. */
  readonly buildsOn: readonly string[];
}

/** A topic as `cards/plan.json` holds it: what it lacks is null, or none. */
interface PlannedTopic {
  readonly number: string;
  readonly section: string;
  readonly title: Text;
  readonly priority?: Priority;
  readonly thinking?: Thinking;
  readonly buildsOn?: readonly string[];
  readonly note?: string;
}

/** The shape of `cards/plan.json`, as `cards/plan.schema.json` describes it. */
interface PlanFile {
  readonly levels: readonly Level[];
  readonly sections: readonly Section[];
  readonly topics: readonly PlannedTopic[];
}

const FILE = plan as PlanFile;

export const LEVELS: readonly Level[] = FILE.levels;

export const SECTIONS: readonly Section[] = FILE.sections;

const LEVEL_OF = new Map(SECTIONS.map((section) => [section.number, section.level]));

export const TOPICS: readonly Topic[] = FILE.topics.map((topic) => {
  const level = LEVEL_OF.get(topic.section);
  if (!level) throw new Error(`The topic ${topic.number} of cards/plan.json names a section the plan does not have: ${topic.section}`);
  return {
    number: topic.number,
    level,
    section: topic.section,
    title: topic.title,
    priority: topic.priority ?? null,
    thinking: topic.thinking ?? null,
    buildsOn: topic.buildsOn ?? [],
  };
});

const BY_NUMBER = new Map(TOPICS.map((topic) => [topic.number, topic]));

/** A topic by its number, or undefined for a number the plan does not have. */
export function topicOf(number: string): Topic | undefined {
  return BY_NUMBER.get(number);
}
