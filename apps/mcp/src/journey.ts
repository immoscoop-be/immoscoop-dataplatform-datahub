import { type Journey, type JourneyMissing, type JourneyStepId, type JourneyStepState, JOURNEY_STEPS, journeyStep } from '@datahub/contracts/journey';
import type { ModelType } from '@datahub/contracts/model-types';
import { shownIn, TOPICS } from '@datahub/learning';
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
  fields?: readonly { name: string; businessDescription: string }[];
  details?: { grain?: string[]; grainSentence?: string; modelType?: ModelType | null; mappings?: unknown[] } | null;
}

/** One thing the window of a step shows of the Resource now (DEC-UX-261): a text, chips or lines, or what is not there. */
export interface Held {
  label: string;
  /** Who it comes from, as the publication shows it: from the Owner, or from dbt. */
  origin?: string;
  text?: string;
  items?: string[];
  chips?: string[];
  /** Shown when there is nothing: what is missing, or who said there is nothing to add. */
  none?: string;
}

const dayOf = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** What a step holds now, as its window shows it before Claude proposes: the texts on the card, or what is missing. */
export function heldOf(step: JourneyStepState, resource: JourneyResource, journey: Journey): Held[] {
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
    case 'start':
      return [
        { label: 'Now', text: `${resource.levelName}, ${resource.published ? 'published' : 'not published yet'}.` },
        { label: 'Its Collection', text: resource.collection ? `${resource.collection.name}, owned by ${resource.collection.owner}.` : undefined, none: 'In no Collection yet.' },
      ];
    case 'data':
      return [
        { ...dbt, label: 'One row, says dbt' },
        { label: 'Grain', text: grain || undefined, none: 'Not recorded by a Data Admin yet: step 9.' },
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
    case 'gaps': {
      const gaps = list('knownGaps').map((gap) => (gap as { text?: string }).text ?? '').filter(Boolean);
      const since = text('reliableSince');
      return [
        { label: 'Known Gaps', items: gaps, none: saidNone ?? 'None written, and nobody said there are none.' },
        { label: 'Reliable since', text: since ? dayOf(since) : undefined, none: 'No day yet.' },
      ];
    }
    case 'parameters':
      return [{ label: 'Parameters now', chips: list('parameters').filter((name): name is string => typeof name === 'string'), none: saidNone ?? 'None.' }];
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
    say: 'Who the User is, and whether they may publish it. What publishing means: everyone who sees its Collection sees it, it is the first Confirmation, and it cannot be undone.',
    present: 'The steps ahead: which are required to publish, which are advised, and what the EDA needs later.',
    ask: 'Whether to start.',
  },
  data: {
    say: 'Before anything is written, look at what one row is, so that every text is about this table.',
    present: 'Its Summary (show_resource) and a Preview (preview_resource); where it comes from (get_resource_lineage), who queries it (get_resource_queries) and its open Messages (get_messages).',
    ask: 'Whether one row is what the card says it is. Once the User has looked, record the step gone through with record_journey_step.',
  },
  businessDescription: {
    say: 'What the table is, in the words of the business, next to the description from dbt: colleagues read it first.',
    present: 'The Business Description on the card, if any, and the description from dbt.',
    ask: 'What it is for in their work. Propose a text, and say where each part comes from.',
  },
  keyFields: {
    say: 'The few fields a colleague should look at first. The EDA, which takes a Resource to 4 · Explored, explores at least its Key Fields.',
    present: 'Its fields, with how often the queries on it use each (get_resource_queries).',
    ask: 'Which fields matter most. Propose some, with where the proposal comes from.',
  },
  fields: {
    say: 'A Business Description for each field: the Key Fields first, which are required, then the others, which are advised.',
    present: 'Five fields at a time, each with what dbt says and your proposal.',
    ask: 'What is off. When the User leaves the other fields for later, record the step gone through with record_journey_step.',
  },
  intendedUse: {
    say: 'What it is meant for, and what it is not meant for.',
    present: 'The intended use on the card. A text written before the journey is the Owner\'s only once they read it as theirs.',
    ask: 'Whether it still holds, and what to add.',
  },
  pitfalls: {
    say: 'Where it trips people up when they use it without knowing.',
    present: 'The pitfalls on the card, and any you see in the data.',
    ask: 'What else goes wrong with it. "None" is an answer: once the User says so, record "nothing" with record_journey_step.',
  },
  gaps: {
    say: 'Where data is missing, and the day from which it can be relied on.',
    present: 'Its Known Gaps, the day it is reliable since, and holes you find in the data, such as empty periods or fields empty for part of the rows.',
    ask: 'Which gaps to write down, and from which day it is reliable. "No gaps" is an answer: record "nothing" with record_journey_step; the day is still needed.',
  },
  parameters: {
    say: 'The fields a Preview offers to filter on.',
    present: 'The Parameters on the card, and the fields colleagues filter on in their queries.',
    ask: 'Which ones. "None" is an answer: record "nothing" with record_journey_step.',
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
      return 'no Known Gap written, and nobody said there are none';
    case 'reliableSince':
      return 'no day it is reliable since';
    case 'parameters':
      return 'no Parameters';
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
  const required = journey.steps.filter((step) => ['businessDescription', 'keyFields', 'fields', 'intendedUse', 'pitfalls', 'gaps'].includes(step.id));
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
  const mayDescribe = permits.card.length > 0 || permits.fields;

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
        const guided = {
          // The window of the step in the conversation (DEC-UX-261): what the step holds now, with its Learning Card.
          view: 'journey',
          window: { collection: resource.collection, held: heldOf(next, resource, journey), total: 12 },
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
                `Step ${next.number} of 12 is next: ${next.name}${next.mark !== 'none' ? `, ${MARKS[next.mark]}` : ''}.`,
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
          'Keeps what the User said in a step of the Owner Journey where the card cannot tell it, with who and when, in the Log of the Resource: "nothing" for the pitfalls, the Known Gaps or the Parameters when there are none; "goneThrough" for a step gone through without writing, such as looking at the data, leaving the other fields for later, asking the Data Team about the table type and grain, or leaving open Messages knowingly. Only once the User said so.',
        inputSchema: {
          id,
          step: z.enum(recordable).describe('The step: data, fields, pitfalls, gaps, parameters, admin or messages.'),
          answer: z.enum(['goneThrough', 'nothing']).describe('goneThrough, or nothing for the pitfalls, the Known Gaps or the Parameters.'),
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
