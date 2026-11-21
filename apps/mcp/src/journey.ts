import type { GapScope } from '@datahub/contracts/gaps';
import { type Journey, type JourneyMissing, type JourneyStepId, type JourneyStepState, JOURNEY_STEPS, journeyStep, REQUIRED_TO_PUBLISH } from '@datahub/contracts/journey';
import type { ModelType, TypeField } from '@datahub/contracts/model-types';
import { dateFieldOf, dateFieldsOf, type ReliableSince } from '@datahub/contracts/reliable';
import { shownIn, TERMS, type TermKey, TOPICS } from '@datahub/learning';
import { z } from 'zod';
import { answer, attempt, refusal } from './answers.js';
import { type Context, READ, SHOWS, WRITE } from './context.js';
import { pages } from './datahub.js';
import { cards } from './learning.js';

/** A Resource as the journey reads it: its detail, with the journey the catalogue gives (OP-CL-12). */
export interface JourneyResource {
  id: string;
  displayName: string;
  level: number;
  levelName: string;
  published: boolean;
  journey: Journey;
  collection: { id: string; name: string; owner: string; icon?: string } | null;
  mayPublish: boolean;
  page: string;
  /** What the window of a step shows of it: its description from dbt, its card, its fields and what a Data Admin recorded. */
  description?: string;
  card?: Record<string, unknown>;
  fields?: readonly { name: string; businessDescription: string; dataType?: string | null }[];
  details?: { grain?: string[]; grainSentence?: string; modelType?: ModelType | null; typeFields?: TypeField[]; mappings?: unknown[] } | null;
}

/** One thing the window of a step shows of the Resource now (DEC-UX-261): a text, chips or lines, or what is not there. */
export interface Held {
  label: string;
  /** Who it comes from, as the publication shows it: from the Owner, or from dbt. */
  origin?: string;
  text?: string;
  items?: string[];
  chips?: string[];
  /** The Known Gaps, each with its scope, which the window shows next to its text, as the Summary does (FR-CL-34). */
  gaps?: { text: string; scope: GapScope | null }[];
  /** Shown when there is nothing: what is missing, or who said there is nothing to add. */
  none?: string;
}

const dayOf = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The steps of the journey after the start, as the window counts them: 13. */
export const STEPS_AFTER_START = JOURNEY_STEPS.length - 1;
/** The number of a step, as the texts of the window name it. */
const numberOf = (id: JourneyStepId) => journeyStep(id).number;

/** Reliable Since as the card gives it, also a bare day of an older catalogue (FR-RC-31). */
export function reliableOf(value: unknown): ReliableSince | null {
  if (typeof value === 'string' && value) return { from: 'day', day: value, why: '' };
  if (value === null || typeof value !== 'object') return null;
  const given = value as { from?: unknown; day?: unknown; why?: unknown };
  if (given.from === 'firstRow') return { from: 'firstRow', day: null, why: '' };
  return given.from === 'day' && typeof given.day === 'string' ? { from: 'day', day: given.day, why: typeof given.why === 'string' ? given.why : '' } : null;
}

/** The held facts of the step Reliable since (DEC-RC-29, FR-RC-31, FR-RC-32): its value, its Date Field and the date fields. */
function sinceHeld(resource: JourneyResource): Held[] {
  const card = resource.card ?? {};
  const reliable = reliableOf(card.reliableSince);
  const fields = (resource.fields ?? []).map((field) => ({ name: field.name, dataType: field.dataType ?? null }));
  const chosen = typeof card.dateField === 'string' ? card.dateField : null;
  const date = dateFieldOf(chosen, resource.details?.modelType ?? null, resource.details?.typeFields ?? [], fields);
  const type = resource.details?.modelType;
  const on = date.field
    ? date.source === 'type'
      ? `${date.field}, from its table type: ${date.typeField?.role} of ${/^[aeiou]/.test(type ?? '') ? 'an' : 'a'} ${type}.`
      : date.unusual && date.typeField
        ? `${date.field}, chosen. Unusual: its table type gives ${date.typeField.field} (${date.typeField.role} of ${/^[aeiou]/.test(type ?? '') ? 'an' : 'a'} ${type}); on ${date.field}, Reliable since says when a row was made, not the time it counts.`
        : `${date.field}, chosen${date.gone ? ': it left the Resource, choose another' : ''}.`
    : undefined;
  return [
    {
      label: 'Reliable since',
      text: reliable ? (reliable.from === 'firstRow' ? 'From its first row: the whole table can be relied on, as far back as it goes.' : `${dayOf(reliable.day ?? '')}. Why not earlier: ${reliable.why || 'not written yet.'}`) : undefined,
      none: 'Not set: neither from its first row nor from a later day. Ask the Owner for one of the two.',
    },
    { label: 'Read on', text: on, none: type ? `Its table type, ${type}, gives no Date Field: choose one of its date fields.` : 'No table type recorded yet: choose one of its date fields.' },
    { label: 'Its date fields', chips: dateFieldsOf(fields), none: 'It has no date field: Reliable since can only be from its first row.' },
  ];
}

/** What a step holds now, as its window shows it before Claude proposes: the texts on the card, or what is missing. */
export function heldOf(step: JourneyStepState, resource: JourneyResource, journey: Journey, mayDescribe = false): Held[] {
  const card = resource.card ?? {};
  const text = (key: string) => (typeof card[key] === 'string' ? (card[key] as string).trim() : '');
  const list = (key: string) => (Array.isArray(card[key]) ? (card[key] as unknown[]) : []);
  const nothing = step.records.find((record) => record.answer === 'nothing');
  const saidNone = nothing ? `None, according to ${nothing.by}, on ${dayOf(nothing.at)}.` : undefined;
  const fields = resource.fields ?? [];
  const keyFields = list('keyFields').filter((name): name is string => typeof name === 'string');
  const described = (name: string) => (fields.find((field) => field.name === name)?.businessDescription ?? '').trim() !== '';
  const details = resource.details ?? null;
  const grain = details?.grainSentence?.trim() || (details?.grain?.length ? details.grain.join(' × ') : '');
  const dbt: Held = { label: 'Next to it', origin: 'From dbt', text: resource.description?.trim() || undefined, none: 'No description from dbt.' };
  switch (step.id) {
    case 'start': {
      // Who the User is, and what publishing means (DEC-CL-18).
      const owner = resource.collection?.owner ?? 'its Owner Unit';
      const where = resource.collection?.name ?? 'its Collection';
      return [
        {
          label: 'You',
          text: resource.mayPublish
            ? `You are in ${owner}, the Owner Unit of ${where}: you may describe this Resource and publish it.`
            : mayDescribe
              ? `You may describe this Resource, step by step. Publishing it is for an Owner of ${owner}; you hand it over at step ${numberOf('publish')}.`
              : `Only ${owner} describes and publishes it.`,
        },
        {
          label: 'Publishing it',
          items: [
            `**Everyone who sees ${where} sees it.** Now only ${owner} and the Data Team do.`,
            `**It is the first Confirmation:** for ${owner}, you vouch for what it is and what it stands for, and every text on its card is yours. The Level rises to 3 · Confirmed.`,
            '**It cannot be undone.**',
          ],
        },
      ];
    }
    case 'data':
      return [
        { ...dbt, label: 'One row, says dbt' },
        { label: 'Grain', text: grain || undefined, none: `Not recorded by a Data Admin yet: step ${numberOf('admin')}.` },
      ];
    case 'businessDescription':
      return [{ label: 'On the card now', origin: 'From the Owner', text: text('businessDescription') || undefined, none: 'Nothing yet.' }, dbt];
    case 'keyFields':
      return [{ label: 'Key Fields now', chips: keyFields, none: 'None chosen yet.' }, { label: 'Its fields', text: `${fields.length}` }];
    case 'fields': {
      const others = fields.filter((field) => !keyFields.includes(field.name));
      return [
        { label: 'Key Fields described', text: keyFields.length > 0 ? `${keyFields.filter(described).length} of ${keyFields.length}` : undefined, none: 'The Key Fields come first: step 3.' },
        { label: 'Other fields described', text: `${others.filter((field) => described(field.name)).length} of ${others.length}` },
      ];
    }
    case 'intendedUse':
      return [{ label: 'On the card now', text: text('intendedUse') || undefined, none: 'Nothing yet.' }];
    case 'pitfalls':
      return [{ label: 'On the card now', text: text('pitfalls') || undefined, none: saidNone ?? 'Nothing yet, and nobody said there are none.' }];
    case 'since':
      return sinceHeld(resource);
    case 'gaps': {
      const gaps = list('knownGaps')
        .map((gap) => gap as { text?: string; scope?: GapScope | null })
        .filter((gap) => gap.text)
        .map((gap) => ({ text: gap.text as string, scope: gap.scope ?? null }));
      return [{ label: 'Known Gaps', gaps, none: saidNone ?? 'None known: none written.' }];
    }
    case 'admin':
      return [
        { label: 'Table type', text: details?.modelType ?? undefined, none: 'Not recorded yet.' },
        { label: 'Grain', text: grain || undefined, none: 'Not recorded yet.' },
        { label: 'Fields mapped', text: `${details?.mappings?.length ?? 0}` },
      ];
    case 'messages':
      return [{ label: 'Open Questions and Signals', text: step.missing.includes('openMessages') ? 'Some are open: Claude shows them.' : undefined, none: 'None open.' }];
    case 'publish':
      return [{ label: 'Required to publish', text: journey.ready ? 'Every step is done.' : undefined, none: `Still open: ${journey.steps.filter((one) => journey.open.includes(one.id)).map((one) => one.name).join(', ')}.` }];
    case 'after':
      return [{ label: 'Level', text: resource.levelName }];
  }
}

/**
 * What Claude does in each step, in the order the journey asks: say what the step is and why, present what is there,
 * ask what only the Owner knows. Proposing with its source, showing the final text and writing only after a yes holds
 * for every step (rule 7, DEC-MR-17); the server instructions say so once.
 */
export const GUIDE: Readonly<Record<JourneyStepId, { say: string; present: string; ask: string }>> = {
  start: {
    say: 'What the User is about to do and why: write the card of this Resource step by step, so that a colleague outside their team can find it, understand it and trust it; today only its Owner Unit and the Data Team see it, with a description from dbt that says how it is made, not what it means. Who the User is, and whether they may publish it. What publishing means: everyone who sees its Collection sees it, it is the first Confirmation, and it cannot be undone. That everything they write can be changed later, here or in Data Hub: only publishing is for good.',
    present: 'The steps ahead, which the window shows unfolded: which are required to publish, which are optional, and what the EDA needs later; and what they get on the way: the Learning Cards under "How can we help with this step?", and a link to the same spot in Data Hub.',
    ask: 'Whether to start.',
  },
  data: {
    say: 'Before anything is written, look at what one row is, so that every text is about this table.',
    present: 'Its Summary (show_resource) and a Preview (preview_resource); where it comes from (get_resource_lineage), who queries it (get_resource_queries) and its open Messages (get_messages).',
    ask: 'Whether one row is what the card says it is. Once the User has looked, record the step gone through with record_journey_step.',
  },
  businessDescription: {
    say: 'What the table is, in the words of the business, next to the description from dbt: dbt says how the data is made, the Business Description what it represents and what it is used for. Colleagues read it first.',
    present: 'The Business Description on the card, if any, and the description from dbt.',
    ask: 'What it is for in their work. Propose a text, and say where each part comes from.',
  },
  keyFields: {
    say: 'The few fields a colleague should look at first. Its Preview offers those that are text or yes/no to filter on, and the EDA, which takes a Resource to 4 · Explored, explores at least its Key Fields.',
    present: 'Your suggestion of its Key Fields, in the card of suggest_fields, together with a description for every field that has none: the User ticks, edits and saves there (DEC-CL-22). Base it on its fields, how often the queries on it use each (get_resource_queries) and, where you may, a small Preview.',
    ask: 'Whether the suggestion is right; the User saves it in the card.',
  },
  fields: {
    say: 'A Business Description for each field: the Key Fields first, which are required, then the others, which are advised. dbt says how a field is made; its Business Description says what it means and how it is used.',
    present: 'The card of suggest_fields, with a suggested description for every field that has none, the Key Fields first (DEC-CL-22). When the User saved them in the card at the step Key Fields already, the fields left without one.',
    ask: 'What is off; the User edits and saves in the card. When the User leaves the other fields for later, record the step gone through with record_journey_step.',
  },
  intendedUse: {
    say: 'What it is meant for, and what it is not meant for.',
    present: 'The intended use on the card. A text written before the journey is the Owner\'s only once they read it as theirs.',
    ask: 'Whether it still holds, and what to add.',
  },
  pitfalls: {
    say: 'Where it trips people up when they read it without knowing. A pitfall is in how the data is read: it stays true even when every row is right.',
    present: 'The pitfalls on the card, and any you see in the data.',
    ask: 'What else goes wrong with it. When a text the User proposes would go away if the data were repaired, it is a Known Gap: say so, and offer to keep it for the next step. "None" is an answer: once the User says so, record "nothing" with record_journey_step.',
  },
  since: {
    say: 'Reliable since: the day from which the whole table can be relied on. Rows before it stay, but nobody should read them as reliable: a trend or a comparison starts there. It may simply be its first row. It is read on one date field, its Date Field, which its table type gives. A hole after that day, or in part of the rows, is a Known Gap: that is the next step.',
    present: 'What the data says: its first row on the Date Field, and how full its first weeks are against later ones, from a Preview or a small query of your own. The Date Field its table type gives, which the window shows: happened at of an event, occurred at of a fact, the period of an aggregate, created at or updated at of a state. Where none is given, propose one of its date fields and say why; where another one was chosen, say that it is unusual and what it changes.',
    ask: 'Explicitly for one of the two answers: from its first row, or from a later day, with why not earlier in a sentence a colleague understands. Never choose one for the Owner, and never set it by default. Then write it with update_resource_card: reliableSince {"from":"firstRow"} or {"from":"day","day","why"}, and dateField only when the Owner chose another than the one its table type gives, or none is given.',
  },
  gaps: {
    say: 'Where data is missing after the day it is reliable since, or only for part of the rows. A Known Gap is in the data itself: it would go away if the data were repaired; how the data is misread is a pitfall.',
    present: 'Its Known Gaps, and holes you find in the data, such as empty periods or fields empty for part of the rows. Propose each gap with the scope where it holds: a period, one day or from until, read on the Date Field unless it names another; fields; rows.',
    ask: 'Which gaps to write down, each on its own with add_known_gap and its scope. When a proposed gap is a misreading, say so with the test and offer to write it under the pitfalls instead; the User decides. The Known Gaps are optional: a Resource without one has none known, and needs nothing to be published. Once the User went through them, with or without a gap, record "goneThrough" with record_journey_step.',
  },
  admin: {
    say: 'The table type, the grain and the mappings, which a Data Admin records in Data Hub. They hold up no publication, but the EDA starts from the table type and the grain.',
    present: 'What the Data Admin recorded, and what the data suggests.',
    ask: 'Whether to ask the Data Team with a Question (write_message) for what is missing. Then record the step gone through with record_journey_step.',
  },
  messages: {
    say: 'What colleagues asked or signalled, before the Owner puts their name under the Resource.',
    present: 'Each open Question and Signal (get_messages).',
    ask: 'Whether to reply (reply_to_message), or leave them knowingly; then record the step gone through with record_journey_step.',
  },
  publish: {
    say: 'The whole card, read back as a colleague will see it: ticking the declaration accepts every text on it, also what was written before.',
    present: 'The publication, with publish_resource.',
    ask: 'Nothing: only the User ticks the declaration and publishes, in the window.',
  },
  after: {
    say: 'The new Level, and what staying Owner asks: changes to mark seen, Messages to answer, and that it drops to 1 · Available when its descriptions in dbt go.',
    present: 'What 4 · Explored, through the EDA, still needs: the Key Fields, the table type and the grain.',
    ask: 'Whether to do the advised steps left.',
  },
};

const MARKS = { required: 'required to publish', eda: 'needed for the EDA, not to publish', advised: 'advised', none: '' } as const;
/** How the overview of the window names the mark of a step: an advised step is optional (DEC-UX-272). */
const MARK_WORDS = { required: 'Required', eda: 'For the EDA', advised: 'Optional', none: '' } as const;

/**
 * The terms of the dictionary a step writes, whose definitions the window unfolds under its title with a tap on the ⓘ
 * after it (DEC-UX-279, FR-LR-44): at the Business Description and the fields, what the Business Description is beside
 * the description from dbt; at the pitfalls and the Known Gaps, each, which holds the test that tells them apart.
 */
export const TERMS_OF: Partial<Record<JourneyStepId, readonly TermKey[]>> = {
  businessDescription: ['businessDescription'],
  keyFields: ['keyField'],
  fields: ['businessDescription'],
  pitfalls: ['pitfall', 'knownGap'],
  since: ['reliableSince', 'dateField', 'knownGap'],
  gaps: ['knownGap', 'pitfall'],
};
/** The terms of a step with their definitions, in English as the conversation is (TR-LR-10). */
const termsOf = (step: JourneyStepId) => (TERMS_OF[step] ?? []).map((key) => ({ name: TERMS[key].text.en.name, definition: TERMS[key].text.en.definition }));

/** What the link of a step opens in Data Hub, in words: the part of the Overview or the tab it writes (DEC-CL-19). */
const SPOT_NAMES: Record<string, string> = {
  summary: 'its Summary',
  description: 'the Description',
  behaviour: 'Known behaviour',
  gaps: 'the Known Gaps',
  querying: 'Querying',
  entities: 'Entities',
  maturity: 'Maturity',
  columns: 'Columns',
  messages: 'the Messages',
};

/** The spot a step writes, as an address after the Resource, and its link in words; the start opens the Resource. */
export function spotOf(step: JourneyStepState): { at?: string; label: string } {
  // Reliable since is the tile on top of the Known Gaps (DEC-UX-296).
  if (step.id === 'since') return { at: 'gaps', label: 'Open Reliable since in Data Hub' };
  const at = step.id === 'start' ? undefined : step.parts[0];
  return at && SPOT_NAMES[at] ? { at, label: `Open ${SPOT_NAMES[at]} in Data Hub` } : { label: 'Open the Resource in Data Hub' };
}

/**
 * The overview of the journey, which every window keeps at hand (DEC-UX-272): each step after the start with its
 * mark, and where it stands: done, now, still missing for a required one, or optional.
 */
export function overviewOf(journey: Journey, at: JourneyStepId) {
  const steps = journey.steps
    .filter((step) => step.number > 0)
    .map((step) => {
      const what = step.missing.map((missing) => missingText(step, missing)).join('; ');
      const said = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
      const state = step.id === at ? 'now' : step.status === 'done' ? 'done' : step.mark === 'required' ? 'missing' : 'optional';
      const says =
        state === 'now'
          ? 'Now'
          : state === 'done'
            ? 'Done'
            : step.id === 'publish'
              ? journey.ready
                ? 'Ready to publish'
                : 'After the required steps'
              : step.id === 'after'
                ? 'After publishing'
                : step.passed
                  ? 'Gone through'
                  : what
                    ? said(what)
                    : 'To do';
      return { number: step.number, name: step.name, mark: MARK_WORDS[step.mark], state, says };
    });
  return { steps, done: steps.filter((step) => step.state === 'done').length, open: journey.open.length };
}

/** What the start of the journey says the User is about to do and why, and what they get on the way (DEC-UX-271). */
function startOf(resource: JourneyResource) {
  const owner = resource.collection?.owner ?? 'its Owner Unit';
  const where = resource.collection?.name ?? 'its Collection';
  return {
    what: `Together we write the card of this Resource, step by step, so that a colleague outside ${owner} can find it, understand it and trust it. At the end ${resource.mayPublish ? 'you publish it' : `an Owner of ${owner} publishes it`}, and everyone who sees ${where} can use it.`,
    why: `Why: today only ${owner} and the Data Team see it, with a description from dbt that says how it is made, not what it means.`,
    gets: [
      { kind: 'cards', title: 'Learning Cards.', text: 'Under each step, "How can we help with this step?" lists the cards that explain it: a click opens one.' },
      { kind: 'hub', title: 'Data Hub, one click away.', text: '"Open … in Data Hub" opens the same spot in Data Hub, where you can read and write too.' },
      { kind: 'final', title: 'Nothing is final.', text: 'Everything you write you can change later, here or in Data Hub. Only publishing is for good.' },
    ],
  };
}

/** What is missing, in words, for Claude and the publication window. */
function missingText(step: JourneyStepState, missing: JourneyMissing): string {
  switch (missing) {
    case 'collection':
      return 'it is in no Collection yet';
    case 'described':
      return 'it is not Described in dbt yet';
    case 'businessDescription':
      return 'no Business Description yet';
    case 'keyFields':
      return 'no Key Fields chosen';
    case 'keyFieldDescriptions':
      return step.fieldsMissing.length > 0 ? `Key Fields without a Business Description: ${step.fieldsMissing.join(', ')}` : 'the Key Fields come first';
    case 'otherFieldDescriptions':
      return `${step.othersMissing} other ${step.othersMissing === 1 ? 'field' : 'fields'} without a Business Description`;
    case 'intendedUse':
      return 'no intended use written';
    case 'pitfalls':
      return 'no pitfalls written, and nobody said there are none';
    case 'knownGaps':
      return 'no Known Gap written: optional';
    case 'reliableSince':
      return 'not set: neither from its first row nor from a later day';
    case 'modelType':
      return 'no table type recorded';
    case 'grain':
      return 'no grain recorded';
    case 'mappings':
      return 'no field mapped';
    case 'openMessages':
      return 'open Questions or Signals';
    case 'published':
      return 'not published';
  }
}

/** The one list of what makes a Resource ready to publish, in words (DEC-MR-15, DEC-MR-16). */
export function checklist(journey: Journey) {
  const of = (step: JourneyStepState) => ({ step: step.id, name: step.name, what: step.missing.map((missing) => missingText(step, missing)).join('; ') });
  const required = journey.steps.filter((step) => REQUIRED_TO_PUBLISH.includes(step.id));
  return {
    ready: journey.ready,
    done: required.filter((step) => step.status === 'done').map((step) => step.name),
    open: required.filter((step) => step.status !== 'done').map(of),
    // An advised part of a required step, such as the other fields, shows with the advised steps.
    advised: [
      ...required.filter((step) => step.status === 'done' && step.missing.length > 0).map(of),
      ...journey.steps.filter((step) => step.mark === 'advised' && step.status !== 'done').map(of),
      ...journey.steps.filter((step) => step.id === 'admin' && step.status === 'done' && step.missing.length > 0).map(of),
    ],
    eda: journey.steps.filter((step) => step.mark === 'eda' && step.status !== 'done').map((step) => ({ ...of(step), what: step.missing.filter((missing) => missing !== 'mappings').map((missing) => missingText(step, missing)).join('; ') })),
  };
}

/** The Learning Cards of a step, as explain gives them; one not written yet only by its number and the step it explains. */
async function cardsOf(numbers: readonly string[], hub: Context['hub'], environment?: string) {
  const written = (await cards()).filter((source) => shownIn(environment, source.card));
  return numbers.map((number) => {
    const source = written.find((one) => one.card.number === number);
    const title = TOPICS.find((topic) => topic.number === number)?.title.en;
    return source
      ? { number, title: source.title, coreIdea: source.card.core.rule, gain: source.card.gain, page: hub.page(pages.learningCard(number)) }
      : { number, ...(title ? { title } : {}), written: false };
  });
}

/**
 * The Owner Journey through Claude (OP-CL-12, DEC-CL-17): the tool that holds the order of the steps, the one that
 * keeps what the Owner Unit said where the card cannot tell it, and the prompt that starts it.
 */
export function journeyTools({ server, hub, permits }: Context, read: (id: string) => Promise<JourneyResource>, environment?: string): void {
  const enc = encodeURIComponent;
  const id = z.string().min(1).describe('The ID of the Resource, from list_resources or search.');
  const mayDescribe = permits.card.length > 0 || permits.fields || permits.gaps;

  server.registerTool(
    'guide_owner_journey',
    {
      title: 'Guide the Owner Journey of a Resource',
      description:
        'The Owner Journey of a Resource: every step from 2 · Described to its Publication in one order, each with its status, what is missing and its Learning Cards; the one step that is next, with what to say, present and ask, and the tool that writes the answer; and whether it is ready to publish, by the same rule as Data Hub. Call it first whenever the User wants to publish, describe or take on a Resource, and again after every write.',
      inputSchema: { id },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await read(resourceId);
        const { journey } = resource;
        const owner = resource.collection?.owner ?? 'its Owner Unit';
        const next = journey.steps.find((step) => step.id === journey.next) as JourneyStepState;
        const steps = await Promise.all(
          journey.steps.map(async (step) => ({
            number: step.number,
            step: step.id,
            name: step.name,
            mark: MARKS[step.mark] || undefined,
            status: step.status,
            ...(step.passed && step.status !== 'done' ? { passed: true } : {}),
            ...(step.missing.length > 0 ? { missing: step.missing.map((missing) => missingText(step, missing)) } : {}),
            ...(step.records.length > 0 ? { said: step.records.map((record) => ({ answer: record.answer, by: record.by, at: record.at })) } : {}),
            cards: step.cards,
          })),
        );
        const spot = spotOf(next);
        const guided = {
          // The window of the step in the conversation (DEC-CL-18, FR-CL-33): the start says what and why; every step
          // keeps the overview at hand, what it holds now, the definitions of its terms behind the ⓘ after its title, its
          // Learning Cards folded, and the link to the spot in Data Hub that it writes.
          view: 'journey',
          window: {
            collection: resource.collection,
            held: heldOf(next, resource, journey, mayDescribe),
            total: STEPS_AFTER_START,
            overview: overviewOf(journey, next.id),
            ...(next.id === 'start' ? { start: startOf(resource) } : {}),
            ...(TERMS_OF[next.id] ? { terms: termsOf(next.id) } : {}),
            link: { url: hub.page(pages.resource(resource.id, spot.at)), label: spot.label },
          },
          resource: { id: resource.id, displayName: resource.displayName, level: resource.levelName, collection: resource.collection?.name ?? null, owner, page: resource.page },
          you: { mayPublish: resource.mayPublish, mayDescribe },
          ready: journey.ready,
          open: journey.open,
          next: {
            number: next.number,
            step: next.id,
            name: next.name,
            mark: MARKS[next.mark] || undefined,
            ...GUIDE[next.id],
            writes: next.writes,
            cards: await cardsOf(next.cards, hub, environment),
          },
          steps,
          checklist: checklist(journey),
        };
        // Who is outside the Owner Unit and may not describe it, gets no further (FR-CL-03).
        const note = !resource.mayPublish && !mayDescribe
          ? `Only ${owner}, the Owner Unit of ${resource.collection?.name ?? 'its Collection'}, describes and publishes ${resource.displayName}. Say so, offer to ask them with a Message on the Resource, and take the User no further.`
          : resource.published
            ? `${resource.displayName} is published, at ${resource.levelName}. Tell the User what staying Owner asks, and what the EDA needs for 4 · Explored.`
            : [
                `Step ${next.number} of ${STEPS_AFTER_START} is next: ${next.name}${next.mark !== 'none' ? `, ${MARKS[next.mark]}` : ''}.`,
                journey.open.length > 0 ? `Still open before it can be published: ${checklist(journey).open.map((step) => step.name).join(', ')}.` : 'Every step required to publish is done.',
                resource.mayPublish ? '' : `The User may go through the steps; publishing is for an Owner of ${owner}, who sees what was done.`,
                'Say what the step is and why, with the link to its Learning Card; present what is there; propose with the source of each part; ask what only the User knows; show the final text; write only once they agree, passing before; then call guide_owner_journey again.',
              ]
                .filter(Boolean)
                .join(' ');
        return answer(guided, note);
      }),
  );

  if (mayDescribe) {
    const recordable = JOURNEY_STEPS.filter((step) => step.answers.length > 0).map((step) => step.id) as [JourneyStepId, ...JourneyStepId[]];
    server.registerTool(
      'record_journey_step',
      {
        title: 'Record a step of the Owner Journey',
        description:
          'Keeps what the User said in a step of the Owner Journey where the card cannot tell it, with who and when, in the Log of the Resource: "nothing" for the pitfalls when there are none; "goneThrough" for a step gone through without writing, such as looking at the data, leaving the other fields for later, going through the Known Gaps, asking the Data Team about the table type and grain, or leaving open Messages knowingly. Only once the User said so.',
        inputSchema: {
          id,
          step: z.enum(recordable).describe('The step: data, fields, pitfalls, gaps, admin or messages.'),
          answer: z.enum(['goneThrough', 'nothing']).describe('goneThrough, or nothing for the pitfalls.'),
        },
        annotations: WRITE,
      },
      ({ id: resourceId, step, answer: said }) =>
        attempt(async () => {
          if (!journeyStep(step).answers.includes(said)) {
            return refusal(`The step ${step} takes ${journeyStep(step).answers.join(' or ')}, not ${said}.`);
          }
          const { journey } = await hub.send<{ journey: Journey }>('catalogue', 'POST', `/resources/${enc(resourceId)}/journey/${enc(step)}`, { answer: said });
          return answer({ recorded: { step, answer: said }, next: journey.next, ready: journey.ready, open: journey.open }, 'Kept, with your name, in the Log of the Resource. Call guide_owner_journey for the next step.');
        }),
    );
  }

  // The way in for an Owner (DEC-CL-17): the journey, from its first step.
  server.registerPrompt(
    'publish_a_resource',
    {
      title: 'Publish a Resource',
      description: 'Describe a Resource of yours and publish it, step by step, with the Owner Journey.',
      argsSchema: { resource: z.string().describe('The name of the Resource.') },
    },
    ({ resource }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `Help me publish ${resource}. Find it, then take me through the Owner Journey with guide_owner_journey, one step at a time, in my language.` } }],
    }),
  );
}
