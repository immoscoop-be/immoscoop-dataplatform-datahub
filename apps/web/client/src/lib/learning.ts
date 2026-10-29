import { type Card, type ChartRequest, LEVELS, type LevelId, parseCard, SECTIONS, type Thinking, type Topic, TOPICS, topicOf } from '@datahub/learning';
import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/**
 * The Learning Centre in the web app (DEC-LR-04): the cards as the repository holds them (DEC-LR-12, DEC-LR-24),
 * the progress of the User in catalogue (FR-LR-32), and what Data Hub suggests to them (DEC-LR-27).
 */

export type Language = 'en' | 'nl';
export type Step = 'why' | 'core' | 'see' | 'check' | 'can';
export const STEPS: readonly Step[] = ['why', 'core', 'see', 'check', 'can'];
/** The quick path: Why now, Core idea and You can now (DEC-LR-10). */
export const QUICK: readonly Step[] = ['why', 'core', 'can'];

/** The names of the steps and the thinking levels, as texts of the interface. */
export const STEP_TEXTS: Readonly<Record<Step, string>> = {
  why: 'learning.step.why',
  core: 'learning.step.core',
  see: 'learning.step.see',
  check: 'learning.step.check',
  can: 'learning.step.can',
};
export const THINKING_TEXTS: Readonly<Record<Thinking, string>> = { recognise: 'learning.thinking.recognise', apply: 'learning.thinking.apply', judge: 'learning.thinking.judge' };

// The English of every written card comes with the page, to list and suggest them; a translation when it is read.
const ENGLISH = import.meta.glob('../../../../../packages/learning/cards/*/en.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const DUTCH = import.meta.glob('../../../../../packages/learning/cards/*/nl.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const numberOf = (path: string) => path.split('/').at(-2) ?? '';

const written = new Map<string, Card>();
for (const [path, source] of Object.entries(ENGLISH)) {
  try {
    written.set(numberOf(path), parseCard(source));
  } catch (error) {
    // The tests of the cards keep this from happening; a card that does not read stays to be written.
    console.error(`The Learning Card ${numberOf(path)} could not be read`, error);
  }
}

/**
 * The written cards this page shows: a draft only outside prod, until the Data Team reviewed it (DEC-LR-25).
 * Every other topic of the plan is a card to be written.
 */
export function writtenCards(environment: string | undefined): ReadonlyMap<string, Card> {
  return environment === 'prod' ? new Map([...written].filter(([, card]) => card.status === 'reviewed')) : written;
}

const translated = new Map<string, Promise<Card | null>>();

/** A written card in a language: the Dutch when it is there, else the English it was written in. */
export async function cardIn(number: string, language: Language, shown: ReadonlyMap<string, Card>): Promise<Card | null> {
  const english = shown.get(number);
  if (!english) return null;
  if (language === 'en') return english;
  const load = Object.entries(DUTCH).find(([path]) => numberOf(path) === number)?.[1];
  if (!load) return english;
  if (!translated.has(number)) {
    translated.set(
      number,
      load().then(
        (source) => parseCard(source),
        (error: unknown) => {
          console.error(`The Dutch of Learning Card ${number} could not be read`, error);
          return null;
        },
      ),
    );
  }
  return (await translated.get(number)) ?? english;
}

/** Every written card in a language, to show them as tiles in that language. */
export async function cardsIn(language: Language, shown: ReadonlyMap<string, Card>): Promise<ReadonlyMap<string, Card>> {
  if (language === 'en') return shown;
  const cards = await Promise.all([...shown.keys()].map(async (number) => [number, (await cardIn(number, language, shown)) ?? shown.get(number)!] as const));
  return new Map(cards);
}

/** A sentence that follows a label, such as "You can now", as a sentence of its own: with a capital. */
export const asSentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export { LEVELS, SECTIONS, TOPICS, topicOf, type Card, type ChartRequest, type LevelId, type Topic };

/** What the User did with a card, as catalogue keeps it (FR-LR-32). */
export interface Progress {
  card: string;
  seenAt: string;
  lastAt: string;
  step: Step;
  understoodAt: string | null;
}

/** The progress of the User, in catalogue, asked with their Access Token. */
export function createLearning(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('catalogue', config.catalogueUrl, session, request);
  const at = (card: string) => `/learning/progress/${encodeURIComponent(card)}`;
  const one = async (response: Response) => ((await response.json()) as { progress: Progress }).progress;
  return {
    async progress(): Promise<Progress[]> {
      return ((await (await call('/learning/progress')).json()) as { progress: Progress[] }).progress;
    },
    /** The User has a card open at a step: seen from the first time. */
    async open(card: string, step: Step): Promise<Progress> {
      return one(await call(at(card), { method: 'PUT', body: { step } }));
    },
    /** "I understand it", or undone (FR-LR-28). */
    async understand(card: string, understood: boolean): Promise<Progress> {
      return one(await call(`${at(card)}/understood`, { method: understood ? 'PUT' : 'DELETE' }));
    },
  };
}

export type LearningClient = ReturnType<typeof createLearning>;

/**
 * The Learning Levels Data Hub suggests (DEC-LR-27): to everyone the Compass and Learning Level 1; to a member of
 * an Owner Unit that owns a Collection also Learning Level 4; to the Data Team also 3 and 4. A suggestion closes
 * nothing: every card stays open to everyone (DEC-LR-03).
 */
export function suggestedLevels(who: { dataTeam: boolean; owner: boolean }): LevelId[] {
  const levels: LevelId[] = ['compass', '1'];
  if (who.dataTeam) levels.push('3');
  if (who.dataTeam || who.owner) levels.push('4');
  return levels;
}

/** A card suggested to the User: written, of a suggested Learning Level, a priority of "required", not understood yet (DEC-LR-18). */
export function suggestedCards(levels: readonly LevelId[], shown: ReadonlyMap<string, Card>, progress: readonly Progress[]): Topic[] {
  const understood = new Set(progress.filter((entry) => entry.understoodAt).map((entry) => entry.card));
  return TOPICS.filter((topic) => levels.includes(topic.level) && shown.has(topic.number) && !understood.has(topic.number) && (topic.priority === 'required' || topic.level === 'compass'));
}

/** The card the User read last and has not said they understand, to continue it where they stopped. */
export function continued(shown: ReadonlyMap<string, Card>, progress: readonly Progress[]): Progress | undefined {
  return progress.filter((entry) => !entry.understoodAt && shown.has(entry.card)).toSorted((a, b) => b.lastAt.localeCompare(a.lastAt))[0];
}

/** How many cards of a Learning Level, or of a section, the User has seen: the one silent count (FR-LR-32). */
export function seenOf(topics: readonly Topic[], progress: readonly Progress[]): { seen: number; of: number } {
  const seen = new Set(progress.map((entry) => entry.card));
  return { seen: topics.filter((topic) => seen.has(topic.number)).length, of: topics.length };
}

/** The cards that came or changed in the last 30 days, newest first. */
export function newAndChanged(shown: ReadonlyMap<string, Card>, today: Date = new Date()): { topic: Topic; card: Card; added: boolean }[] {
  const since = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [...shown.values()]
    .filter((card) => card.changed >= since)
    .sort((a, b) => b.changed.localeCompare(a.changed) || a.number.localeCompare(b.number))
    .flatMap((card) => {
      const topic = topicOf(card.number);
      return topic ? [{ topic, card, added: card.added === card.changed }] : [];
    });
}

/**
 * The example of See it, drawn by the Chart Server from the figures of the card (DEC-LR-21, DEC-LR-26), in the
 * theme of the page, as a picture: it cannot run anything in the page. Null when it was not drawn.
 */
export async function drawExample(config: Pick<Config, 'semgraphUrl'>, chart: ChartRequest, theme: 'light' | 'dark', request: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await request(new URL('/render', config.semgraphUrl).href, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...chart, theme, size: 'default' }),
    });
    if (!response.ok) {
      console.error(`The Chart Server did not draw the example: ${response.status}`);
      return null;
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
  } catch (error) {
    console.error('The Chart Server did not answer', error);
    return null;
  }
}
