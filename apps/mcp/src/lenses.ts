import { rangesOf } from '@datahub/contracts';
import { DATE_FUNCTIONS, type DateFunction, dayOf } from '@datahub/contracts/dates';
import { z } from 'zod';
import { answer, attempt, levelName, refusal } from './answers.js';
import { APP_ONLY, bytes, type Context, READ, SHOWS, WRITE } from './context.js';
import { pages, Refused } from './datahub.js';
import { collectionIcon } from './icons.js';
import { type Preflight, tooLarge } from './resources.js';
import { CARD_RULE, cardAnswer, notInClaude, runShape, shapeOf, shapeText } from './results.js';

/** A Parameter of a Lens, as query keeps it: its kind and default, and the name Users see (DEC-UX-71). */
interface LensParameter {
  name: string;
  label: string;
  kind: 'date' | 'period' | 'number' | 'decimal' | 'text' | 'choice' | 'several' | 'yesno';
  value: string | string[] | boolean;
  to?: string;
  list?: string[];
}

/** A Lens as its page reads it (GET /lenses/:id). */
interface Lens {
  id: string;
  name: string;
  question: string;
  shows: string;
  steps?: string[];
  collectionId: string;
  state: 'published' | 'waiting' | 'stopped' | 'refused';
  broken: { kind: 'table' | 'column'; name: string; since: string } | null;
  resources: { id: string; displayName: string; level?: number }[];
  parameters: LensParameter[];
  fields: { name: string; type: string; description: string }[];
  [key: string]: unknown;
}

interface Run {
  ref: string;
  processedBytes: number | null;
  [key: string]: unknown;
}

/** A value of one Parameter in a run: a date or function, a period, a value of a choice, several, yes or no (FR-LE-13). */
const value = z.union([z.string(), z.boolean(), z.array(z.string()), z.object({ value: z.string(), to: z.string() })]);
type Values = Record<string, z.infer<typeof value>>;
const values = z
  .record(z.string(), value)
  .optional()
  .describe(
    'The value of each Parameter to change, by its name as get_lens gives it: a date as YYYY-MM-DD or a date function such as DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)); a period as {value, to}; a choice as one of its list; several as a list of its list; yes or no as true or false. A Parameter left out keeps its default.',
  );
const id = z.string().min(1).describe('The ID of the Lens, from suggest_lenses.');

/** The date functions in the words of the MCP App, which speaks English, as the web app names them (DEC-LE-14). */
const FUNCTION_WORDS: Record<DateFunction['key'], string> = {
  today: 'Today',
  minus3: 'Today − 3 days',
  week: 'Start of this week',
  month: 'Start of this month',
  quarter: 'Start of this quarter',
  year: 'Start of this year',
  lastWeek: 'End of the last complete week',
  lastMonth: 'End of the last complete month',
};

/** Why a Lens does not run now, in the words of its page (DEC-LE-05, DEC-LE-11, FR-LE-17); null when it runs. */
function haltedOf(lens: Lens): string | null {
  if (lens.state === 'waiting') return 'It waits for the Data Team: it runs once they accept it.';
  if (lens.state === 'refused') return 'The Data Team refused it: it runs again once its Owner Unit updates it from its query.';
  if (lens.state === 'stopped') return 'One run with its defaults grew past what one run may read: it stopped until the Data Team accepts it again.';
  if (lens.broken) return `It is Broken: it reads the ${lens.broken.kind} ${lens.broken.name}, which no longer exists.`;
  return null;
}

/**
 * Lenses through Claude (see docs/requirements/functional/17-claude.md, Lenses through the MCP): read a Lens and run it,
 * with its result as an MCP App whose Parameters the User can change (FR-CL-36, FR-CL-37, DEC-CL-21). Every User who sees
 * a Lens may run it; the result reaches Claude as their Permission group says (FR-CL-28).
 */
export function lensTools({ server, hub, user, permits }: Context): void {
  const free = bytes(rangesOf(user.permissions).approve);
  const large = bytes(rangesOf(user.permissions).request);
  const enc = encodeURIComponent;
  const card = permits.results === 'card';
  const none = permits.results === 'none';

  const read = async (lensId: string): Promise<Lens> => (await hub.get<{ lens: Lens }>('query', `/lenses/${enc(lensId)}`)).lens;
  const deleted = (error: unknown) => error instanceof Refused && error.status === 410;
  const DELETED = 'This Lens was deleted: it no longer runs. Find another with suggest_lenses.';

  /** The Parameters of a run: each with its default and the value of this run, the given ones over the defaults (FR-LE-13). */
  const parametersOf = (lens: Lens, given: Values | undefined) =>
    lens.parameters.map((parameter) => {
      const chosen = given?.[parameter.name];
      const period = chosen && typeof chosen === 'object' && !Array.isArray(chosen) ? chosen : null;
      const current = chosen === undefined ? { value: parameter.value, to: parameter.to } : period ? { value: period.value, to: period.to } : { value: chosen, to: parameter.to };
      return {
        name: parameter.name,
        label: parameter.label || parameter.name,
        kind: parameter.kind,
        ...current,
        ...(parameter.list ? { list: parameter.list } : {}),
        default: { value: parameter.value, ...(parameter.to !== undefined ? { to: parameter.to } : {}) },
        changed: JSON.stringify(current.value) !== JSON.stringify(parameter.value) || (parameter.kind === 'period' && current.to !== parameter.to),
      };
    });

  /** A Lens as the MCP App shows it, and Claude reads its head: name, question, Collection, Resources with their Level, Parameters, fields (FR-CL-36). */
  async function headOf(lens: Lens, given: Values | undefined) {
    const collection = await hub.get<{ name: string; icon: string | null }>('catalogue', `/collections/${enc(lens.collectionId)}`).catch(() => null);
    const today = new Date();
    return {
      view: 'lens',
      collection: collection ? { name: collection.name, icon: await collectionIcon(collection.icon) } : null,
      lens: { id: lens.id, name: lens.name, question: lens.question, shows: lens.shows, page: hub.page(pages.lens(lens.id)) },
      resources: lens.resources.map((resource) => ({
        id: resource.id,
        displayName: resource.displayName,
        levelName: resource.level === undefined ? null : levelName(resource.level),
        page: hub.page(pages.resource(resource.id)),
      })),
      parameters: parametersOf(lens, given),
      // The date functions the MCP App offers, each with the day it gives today, as the page of a Lens does (DEC-UX-118).
      dateFunctions: DATE_FUNCTIONS.map((fn) => ({ sql: fn.sql, label: FUNCTION_WORDS[fn.key], day: dayOf(fn.sql, today) })),
      fields: lens.fields.map(({ name, description }) => ({ name, description })),
      given: given ?? {},
    };
  }
  type Head = Awaited<ReturnType<typeof headOf>>;

  const levelsOf = (head: Head): string => head.resources.map((resource) => `${resource.displayName}${resource.levelName ? ` (${resource.levelName})` : ''}`).join(', ');

  /** Runs a Lens with the given values, as its page does; Claude never approves, so above the free range it waits for the User (DEC-CL-07). */
  async function run(lensId: string, given: Values | undefined, approve: boolean) {
    const lens = await read(lensId);
    const head = await headOf(lens, given);
    const halted = haltedOf(lens);
    if (halted) return { ...head, outcome: 'halted' as const, reason: halted };
    try {
      const ran = await hub.send<{ run: Run; page: Record<string, unknown> }>('query', 'POST', `/lenses/${enc(lensId)}/runs`, { ...(given ? { values: given } : {}), approve });
      return { ...head, outcome: 'ran' as const, run: ran.run, page: ran.page, reads: bytes(ran.run.processedBytes) };
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      const preflight = (error.body.preflight ?? null) as Preflight | null;
      const reads = bytes(preflight?.bytes);
      if (error.code === 'approval_needed') return { ...head, outcome: 'approve' as const, preflight, reads };
      // Above the second range one run of a Lens does not go to the Data Team: the User chooses values that read less.
      if (error.code === 'request_needed') return { ...head, outcome: 'large' as const, preflight, reads };
      if (['waiting', 'refused', 'stopped', 'broken'].includes(error.code)) return { ...head, outcome: 'halted' as const, reason: error.message };
      if (error.status === 400 || error.status === 409 || error.status === 422) {
        const big = tooLarge(preflight, 'values that read less');
        return { ...head, outcome: 'blocked' as const, preflight, reads, problem: big ? big.forUser : error.message };
      }
      throw error;
    }
  }
  type Shown = Awaited<ReturnType<typeof run>>;

  const runNote = (shown: Shown): string => {
    switch (shown.outcome) {
      case 'ran':
        return `The Lens ran and its result is shown to the User; its first rows are below. It shows: ${shown.lens.shows || shown.lens.question} Answer from them, and name the Levels: ${levelsOf(shown)}. The User can change its values in the card and run it again.`;
      case 'approve':
        return `With these values the Lens reads ${shown.reads}, more than the ${free} Data Hub runs freely. Only the User approves it, in the window; you cannot. Values that read less, such as a shorter period, run at once.`;
      case 'large':
        return `With these values one run of the Lens reads ${shown.reads}, more than ${large}: it does not run, and nothing goes to the Data Team. Offer values that read less, such as a shorter period.`;
      case 'halted':
        return `The Lens does not run now: ${shown.reason} Say so, and offer a query of the User's own if they want one.`;
      case 'blocked':
        return `The Lens could not run with these values: ${shown.problem}. Read its Parameters with get_lens and try again.`;
    }
  };

  /** What Claude reads of a run: in a card only its head and shape, never a value; in Claude all of it (FR-CL-28). */
  const runAnswer = (shown: Shown) => {
    if (!card) return answer(shown, runNote(shown));
    if (shown.outcome !== 'ran') return cardAnswer(shown, runNote(shown));
    const { run: ran, page, reads, outcome: _outcome, ...head } = shown;
    const result = shapeOf(page);
    return cardAnswer(
      { ...head, outcome: 'ran', run: runShape(ran), result, reads },
      `The Lens ran and its result is shown to the User, in the card only: ${shapeText(result, reads)}. The Levels: ${levelsOf(shown)}. ${CARD_RULE}`,
    );
  };

  server.registerTool(
    'get_lens',
    {
      title: 'Read a Lens',
      description:
        'A Lens the User sees, as its tab About shows it: its question, what it shows and its steps; its Parameters, each with the name Users see, its kind, its default (for a date, the day it gives today) and the values a choice offers; its fields with their descriptions; the Resources it reads with their Level; and whether it runs now. Read it before run_lens, to choose the values from the question.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: lensId }) =>
      attempt(async () => {
        let lens: Lens;
        try {
          lens = await read(lensId);
        } catch (error) {
          if (deleted(error)) return refusal(DELETED);
          throw error;
        }
        const today = new Date();
        const halted = haltedOf(lens);
        const gives = (parameter: LensParameter) =>
          parameter.kind === 'period'
            ? { gives: { value: dayOf(String(parameter.value), today), to: dayOf(String(parameter.to ?? ''), today) } }
            : parameter.kind === 'date'
              ? { gives: dayOf(String(parameter.value), today) }
              : {};
        return answer(
          {
            lens: {
              id: lens.id,
              name: lens.name,
              question: lens.question,
              shows: lens.shows,
              steps: lens.steps ?? [],
              runs: halted === null,
              ...(halted ? { why: halted } : {}),
              parameters: lens.parameters.map((parameter) => ({
                name: parameter.name,
                label: parameter.label || parameter.name,
                kind: parameter.kind,
                default: parameter.kind === 'period' ? { value: parameter.value, to: parameter.to } : parameter.value,
                ...gives(parameter),
                ...(parameter.list ? { list: parameter.list } : {}),
              })),
              fields: lens.fields.map(({ name, type, description }) => ({ name, type, description })),
              resources: lens.resources.map((resource) => ({ id: resource.id, displayName: resource.displayName, levelName: resource.level === undefined ? null : levelName(resource.level) })),
              page: hub.page(pages.lens(lens.id)),
            },
            today: today.toISOString().slice(0, 10),
          },
          halted
            ? `It does not run now: ${halted}`
            : 'Choose the values of run_lens from the question, by these Parameter names; a date can also be a function, worked out at every run. Say what the Lens shows when you answer with it.',
        );
      }),
  );

  if (none) {
    // No result in Claude: no MCP App and no run that nobody would see; the User runs it on its page (FR-CL-28).
    server.registerTool(
      'run_lens',
      {
        title: 'Run a Lens',
        description: 'The link to run a Lens in Data Hub, where the User sees its result: their Permission group does not show results in Claude. It does not run the Lens here.',
        inputSchema: { id, values },
        annotations: READ,
      },
      ({ id: lensId }) =>
        attempt(async () => {
          const lens = await read(lensId);
          return notInClaude(`The Lens ${lens.name} did not run here: its result`, { lens: { id: lens.id, name: lens.name }, page: hub.page(pages.lens(lens.id)) });
        }),
    );
    return;
  }

  server.registerTool(
    'run_lens',
    {
      title: 'Run a Lens',
      description: card
        ? `Runs a Lens the User sees with the values of their question and shows its result to them in the conversation, in a card only, where they can change the values and run it again: up to ${free} it runs, and you get its shape (its columns, how many rows, what it read), never its values; above, only the User approves it in the window; above ${large} it does not run with these values. Read its Parameters with get_lens first.`
        : `Runs a Lens the User sees with the values of their question and shows its result in the conversation, where they can change the values and run it again: up to ${free} it runs and you get the first 100 rows; above, only the User approves it in the window; above ${large} it does not run with these values. Read its Parameters with get_lens first.`,
      inputSchema: { id, values },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: SHOWS,
    },
    ({ id: lensId, values: given }) =>
      attempt(async () => {
        try {
          return runAnswer(await run(lensId, given, false));
        } catch (error) {
          if (deleted(error)) return refusal(DELETED);
          throw error;
        }
      }),
  );

  server.registerTool(
    'run_lens_approved',
    {
      title: 'Approve and run a Lens',
      description: `The button of the User: runs a Lens that reads more than ${free} with these values, as they approved it. Only the MCP App calls this.`,
      inputSchema: { id, values },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: APP_ONLY,
    },
    ({ id: lensId, values: given }) => attempt(async () => runAnswer(await run(lensId, given, true))),
  );
}
