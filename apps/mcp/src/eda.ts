import { rangesOf } from '@datahub/contracts';
import { EDA_STEPS, type EdaView, PROBES, type ProbeKey, type ProbeView, rowsOf, type RunAnswer, RUNNABLE_PROBES } from '@datahub/contracts/eda';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { attempt, levelName, refusal } from './answers.js';
import { APP_ONLY, bytes, type Context, READ, SHOWS, WRITE } from './context.js';
import { pages, Refused } from './datahub.js';
import {
  code,
  compactData,
  conclusionOf,
  listed,
  nextWhy,
  number,
  overallReading,
  READINGS,
  type ResultRow,
  resultTable,
  STATUS_NAMES,
  STEP_NAMES,
  stillMissing,
  YOURS,
} from './eda-words.js';
import { collectionIcon } from './icons.js';

const id = z.string().min(1).describe('The ID of the Resource, from list_resources or search.');
const probe = z
  .enum(RUNNABLE_PROBES as unknown as [ProbeKey, ...ProbeKey[]])
  .describe(
    'The key of an EDA-Probe Data Hub runs: grainHolds (The grain holds), dateRange (Date range), volumeOverTime (Volume over time, with empty periods), nullsPerKeyField (Nulls per Key Field), distributionOfNumbers (Distribution of numbers) or distributionOfCategories (Distribution of categories).',
  );
const fields = z
  .array(z.string().min(1))
  .min(1)
  .max(1000)
  .optional()
  .describe('The fields to set it on, by name. Without them, it runs on the fields it is set on, or those it applies to by default. The grain holds is always set on the grain.');
const params = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    'Its parameters, only when the User asks for them. Volume over time: measure, the field that adds up, or null for rows only, and mayBeEmpty: "weekends" for a count per day. Distribution of numbers: width and tailFrom, a number, or one per field such as {"lead_count": 5}. Distribution of categories: weighedBy, the field that adds up to weigh each value by, or null to weigh by rows; never a unique count. The grain holds, Date range and Nulls per Key Field take none.',
  );

/** The reading of each result is the User's, given in the MCP App or in Data Hub, never by Claude (DEC-ED-29). */
const READING_RULE =
  "The reading of each result is the User's: they give it with the buttons in the window, or in Data Hub. Never give one yourself, nor say one is given until they did.";

/** A Resource as catalogue reads it, for one without an EDA. */
interface CatalogueResource {
  id: string;
  displayName: string;
  level: number;
  collectionId: string | null;
}

/** The Collection of a card, with the drawing of its icon (DEC-UX-164). */
type Collection = { name: string; icon: string } | null;

/** An EDA-Probe added to an EDA, as the card lists it in its EDA-Step and Claude reads it. */
interface ProbeShown {
  key: ProbeKey;
  name: string;
  needed: boolean;
  complete: boolean;
  reading: string | null;
  readingName: string | null;
  sentence: string;
  setOn: string[];
  missing: string[];
  ranAt: string | null;
  reads: string | null;
  results: { subject: string; reading: string; yours: ResultRow['yours']; data: Record<string, unknown> }[];
  page: string;
}

/**
 * The EDA of a Resource through Claude (FR-ED-15, FR-ED-16, TR-ED-10), for a User who may explore Resources (`eda.use`,
 * DEC-ED-25): read it in words, show it in the MCP App, and run an EDA-Probe as the User through eda, as the web app
 * does. Claude never approves a run above the free range, and never gives the reading of a result: the User does both
 * with the buttons of the MCP App, through tools only it calls, or in Data Hub (DEC-ED-29). Starting an EDA stays in
 * Data Hub.
 */
export function edaTools({ server, hub, user, permits }: Context): void {
  if (!permits.eda) return;
  const enc = encodeURIComponent;
  const ranges = rangesOf(user.permissions);
  const free = bytes(ranges.approve);
  const large = bytes(ranges.request);
  // The values of the data reach Claude only as the Permission group of the User says (FR-CL-28).
  const values = permits.results === 'claude';

  /** The EDA of a Resource as the User sees it, or null when it has none yet. */
  async function edaOf(resourceId: string): Promise<EdaView | null> {
    try {
      return await hub.get<EdaView>('eda', `/resources/${enc(resourceId)}/eda`);
    } catch (error) {
      if (error instanceof Refused && error.status === 404) return null;
      throw error;
    }
  }

  async function collectionOf(collectionId: string | null | undefined, name?: string): Promise<Collection> {
    if (!collectionId) return null;
    const found = await hub.get<{ name: string; icon: string | null }>('catalogue', `/collections/${enc(collectionId)}`).catch(() => null);
    if (!found) return name ? { name, icon: '' } : null;
    return { name: found.name, icon: await collectionIcon(found.icon) };
  }

  /**
   * The rows of the table, a fact of the EDA (DEC-ED-32): from the last run of The grain holds or Nulls per Key Field,
   * which counted them, in words; null while neither ran.
   */
  function rowsShown(eda: EdaView) {
    const counted = rowsOf(eda);
    if (!counted) return null;
    const name = PROBES[counted.probe].name;
    return { count: counted.rows, probe: counted.probe, probeName: name, at: counted.at, text: `${number(counted.rows)} ${counted.rows === 1 ? 'row' : 'rows'}, counted by ${name}` };
  }

  /** The head of every card of an EDA: the Resource, its Level, its Collection, where its EDA stands, and its rows. */
  function headOf(eda: EdaView, collection: Collection) {
    const resource = eda.resource;
    return {
      view: 'eda' as const,
      resource: { id: resource.id, displayName: resource.displayName, level: resource.level, levelName: levelName(resource.level), collection, page: hub.page(pages.resource(resource.id)) },
      eda: {
        status: eda.status,
        statusName: STATUS_NAMES[eda.status],
        startedBy: eda.startedBy.name,
        startedAt: eda.startedAt,
        exploredAt: eda.exploredAt,
        needed: eda.needed,
        rows: rowsShown(eda),
        page: hub.page(pages.eda(resource.id)),
      },
      // The bar of the EDA-Setup: a part per needed EDA-Probe, in the order of the table, complete, open or Coming.
      bar: eda.probes.filter((one) => one.needed).map((one) => ({ name: PROBES[one.key].name, state: one.complete ? 'done' : one.runs ? 'open' : 'coming' })),
    };
  }

  const grainOf = (eda: EdaView) => eda.resource.fields.filter((field) => field.grain).map((field) => field.name);
  const setOnOf = (one: ProbeView) => (one.lastRun?.fields.length ? one.lastRun.fields : one.fields.length ? one.fields : one.applies.fields);

  function probeShown(eda: EdaView, one: ProbeView): ProbeShown {
    const results = one.lastRun?.results ?? [];
    const reading = overallReading(results);
    const rows = resultTable(one.key, results, grainOf(eda), values).rows;
    return {
      key: one.key,
      name: PROBES[one.key].name,
      needed: one.needed,
      complete: one.complete,
      reading,
      readingName: reading ? READINGS[reading] : null,
      sentence: conclusionOf(one.key, results, grainOf(eda)),
      setOn: setOnOf(one),
      missing: one.needed && one.lastRun ? stillMissing(one) : [],
      ranAt: one.lastRun?.ranAt ?? null,
      reads: bytes(one.lastRun?.bytes),
      results: results.map((result, index) => ({ subject: result.subject, reading: result.reading, yours: rows[index]?.yours ?? null, data: compactData(one.key, result.data, values) })),
      page: hub.page(pages.edaProbe(eda.resource.id, one.key)),
    };
  }

  /** The whole EDA, as the card shows it and Claude reads it: what needs a look first, then per EDA-Step (DEC-UX-329). */
  function wholeOf(eda: EdaView, collection: Collection) {
    const added = eda.probes.filter((one) => one.added || one.lastRun);
    const results = added.flatMap((one) => (one.lastRun?.results ?? []).map((result) => ({ probe: one, result })));
    const asked = results.filter(({ result }) => result.reading !== 'expected');
    const steps = EDA_STEPS.map((step) => {
      const inStep = eda.probes.filter((one) => PROBES[one.key].step === step);
      const needed = inStep.filter((one) => one.needed);
      return {
        step,
        name: STEP_NAMES[step],
        needed: { total: needed.length, complete: needed.filter((one) => one.complete).length },
        probes: inStep.filter((one) => added.includes(one)).map((one) => probeShown(eda, one)),
        // The needed EDA-Probes Data Hub runs that are not added yet.
        toAdd: needed.filter((one) => one.runs && !added.includes(one)).map((one) => PROBES[one.key].name),
      };
    }).filter((step) => step.probes.length > 0 || step.toAdd.length > 0);
    // The needed ones Data Hub does not run yet, named once: they still count (DEC-ED-27).
    const coming = eda.probes.filter((one) => one.needed && !one.runs);
    const comingText = EDA_STEPS.map((step) => {
      const names = coming.filter((one) => PROBES[one.key].step === step).map((one) => PROBES[one.key].name);
      return names.length ? `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`} in ${STEP_NAMES[step]}` : '';
    })
      .filter(Boolean)
      .join(', ');
    const next = eda.next ? eda.probes.find((one) => one.key === eda.next) : undefined;
    return {
      ...headOf(eda, collection),
      mode: 'eda' as const,
      attention: {
        ran: results.length,
        look: asked.filter(({ result }) => result.reading === 'look').length,
        judge: asked.filter(({ result }) => result.reading === 'judge').length,
        read: asked.filter(({ result }) => result.yours !== null).length,
      },
      steps,
      coming: { count: coming.length, text: comingText },
      next: next ? { key: next.key, name: PROBES[next.key].name, why: nextWhy(next.key, next.applies.fields) } : null,
    };
  }

  /** The words of the whole EDA for Claude: where it stands, its rows, what to look at first, then per EDA-Step (FR-ED-15). */
  function wholeText(eda: EdaView, shown: ReturnType<typeof wholeOf>): string {
    const name = `${eda.resource.displayName} (${levelName(eda.resource.level)})`;
    const { total, complete } = eda.needed;
    const counted = shown.eda.rows;
    const lines = [
      `The EDA of ${name} is ${eda.status === 'explored' ? 'Explored' : 'in progress'}: ${complete} of ${total} needed EDA-Probes complete${eda.status === 'explored' ? '.' : ', and it becomes 4 · Explored once all are.'} Started on ${eda.startedAt.slice(0, 10)} by ${eda.startedBy.name}.${counted ? ` The table has ${counted.text} on ${counted.at.slice(0, 10)}.` : ''}`,
    ];
    if (shown.coming.count > 0) {
      lines.push(`${shown.coming.count} needed ${shown.coming.count === 1 ? 'one is' : 'ones are'} Coming: ${shown.coming.text}. Data Hub does not run them yet, and they still count.`);
    }
    const added = eda.probes.filter((one) => one.lastRun);
    const rows = added.flatMap((one) => resultTable(one.key, one.lastRun?.results ?? [], grainOf(eda), values).rows.map((row) => ({ one, row })));
    const line = ({ one, row }: (typeof rows)[number]) =>
      `- ${PROBES[one.key].name}${row.subject ? `, ${code(row.subject)}` : ''}: ${row.detail}${row.why ? ` Data Hub: ${row.why}.` : ''} ${row.yours ? `Read by ${row.yours.by} as ${row.yours.readingName} on ${row.yours.at.slice(0, 10)}.` : 'No reading of the User yet.'}`;
    const look = rows.filter(({ row }) => row.reading === 'look');
    const judge = rows.filter(({ row }) => row.reading === 'judge');
    lines.push('');
    if (rows.length === 0) lines.push('No EDA-Probe has run yet.');
    else if (look.length + judge.length === 0) lines.push('Nothing to look at: every result Data Hub read is as expected.');
    if (look.length > 0) lines.push('Look at this, first:', ...look.map(line));
    if (judge.length > 0) lines.push('For the User to judge:', ...judge.map(line));
    const missing = added.filter((one) => one.needed && stillMissing(one).length > 0);
    for (const one of missing) lines.push(`${PROBES[one.key].name} is not set on ${listed(stillMissing(one))} yet, which it needs.`);
    const toAdd = shown.steps.flatMap((step) => step.toAdd);
    if (toAdd.length > 0) lines.push(`Needed, not added yet: ${toAdd.join(', ')}.`);
    if (shown.next) lines.push(`Best next step: ${shown.next.name}. ${shown.next.why}`);
    lines.push('', 'Per EDA-Step:');
    for (const step of shown.steps) {
      lines.push(`${step.name}: ${step.needed.total ? `${step.needed.complete} of ${step.needed.total} needed complete` : 'none needed'}.`);
      for (const one of step.probes) {
        lines.push(`- ${one.name}: ${one.readingName ?? 'not run yet'}. ${one.sentence} Set on ${one.setOn.length ? listed(one.setOn) : 'the table'}${one.ranAt ? `; ran ${one.ranAt.slice(0, 10)}` : ''}.`);
      }
      if (step.toAdd.length > 0) lines.push(`- Needed, not added yet: ${step.toAdd.join(', ')}.`);
    }
    lines.push('', `${READING_RULE} Starting an EDA, and its charts, stay in Data Hub: ${shown.eda.page}`);
    return lines.join('\n');
  }

  /** The last run of one EDA-Probe, as the card shows it with the buttons of the User's reading (FR-ED-16). */
  function runOf(eda: EdaView, one: ProbeView, collection: Collection) {
    const results = one.lastRun?.results ?? [];
    const reading = overallReading(results);
    const table = resultTable(one.key, results, grainOf(eda), values);
    return {
      ...headOf(eda, collection),
      mode: 'run' as const,
      run: {
        probe: one.key,
        name: PROBES[one.key].name,
        setOn: setOnOf(one),
        reading,
        readingName: reading ? READINGS[reading] : null,
        conclusion: conclusionOf(one.key, results, grainOf(eda)),
        ranAt: one.lastRun?.ranAt ?? null,
        ranBy: one.lastRun?.ranBy.name ?? null,
        reads: bytes(one.lastRun?.bytes),
        columns: table.columns,
        bar: table.bar,
        rows: table.rows,
        results: results.map((result) => ({ subject: result.subject, data: compactData(one.key, result.data, values) })),
        page: hub.page(pages.edaProbe(eda.resource.id, one.key)),
      },
    };
  }

  function runText(eda: EdaView, shown: ReturnType<typeof runOf>, lead: string): string {
    const run = shown.run;
    const subjects = run.rows.length === 1 && run.rows[0]?.subject === '' ? '' : 'Per field:';
    return [
      `${lead} ${run.readingName ?? ''}. ${run.conclusion}${run.reads ? ` It read ${run.reads}.` : ''}`,
      ...(subjects ? [subjects] : []),
      ...run.rows.map(
        (row) =>
          `- ${row.subject ? code(row.subject) : row.label}: ${row.readingName}${row.why ? ` (${row.why})` : ''}. ${row.detail}${row.asks ? (row.yours ? ` Read by ${row.yours.by} as ${row.yours.readingName}.` : ' No reading of the User yet.') : ''}`,
      ),
      `The EDA is ${eda.status === 'explored' ? 'Explored' : 'in progress'}: ${eda.needed.complete} of ${eda.needed.total} needed EDA-Probes complete.`,
      `${READING_RULE} Its chart is in Data Hub: ${run.page}`,
    ].join('\n');
  }

  /** An answer with the words for Claude first, then the data, as text and as structured content. */
  const said = (text: string, data: Record<string, unknown>): CallToolResult => ({ content: [{ type: 'text', text }, { type: 'text', text: JSON.stringify(data) }], structuredContent: data });

  /** A Resource without an EDA: starting one stays in Data Hub, from 3 · Confirmed (FR-ED-02, DEC-ED-29). */
  async function withoutEda(resourceId: string, shows: boolean): Promise<CallToolResult> {
    const { resource } = await hub.get<{ resource: CatalogueResource }>('catalogue', `/resources/${enc(resourceId)}`);
    const maturity = hub.page(pages.resource(resource.id, 'maturity'));
    const level = levelName(resource.level);
    const text = `${resource.displayName} (${level}) has no EDA yet. ${
      resource.level >= 3 ? 'Starting it stays in Data Hub: the User starts it on the Maturity of the Resource' : 'An EDA starts once a Resource is 3 · Confirmed, in Data Hub, on its Maturity'
    }: ${maturity}. Say so; do not run an EDA-Probe on it.`;
    const data = {
      ...(shows ? { view: 'eda' as const } : {}),
      mode: 'none' as const,
      resource: { id: resource.id, displayName: resource.displayName, level: resource.level, levelName: level, collection: await collectionOf(resource.collectionId), page: hub.page(pages.resource(resource.id)) },
      maturity,
    };
    return said(text, data);
  }

  /** The EDA in words and as data: get_eda for Claude, show_eda for the card too. */
  async function whole(resourceId: string, shows: boolean, only?: ProbeKey): Promise<CallToolResult> {
    const eda = await edaOf(resourceId);
    if (!eda) return withoutEda(resourceId, shows);
    const collection = await collectionOf(eda.resource.collection?.id, eda.resource.collection?.name);
    const one = only ? eda.probes.find((candidate) => candidate.key === only) : undefined;
    if (one?.lastRun) {
      const shown = runOf(eda, one, collection);
      return said(runText(eda, shown, `The last result of ${shown.run.name} on ${eda.resource.displayName} (${levelName(eda.resource.level)}) is shown to the User, with the buttons of their reading:`), shown);
    }
    const shown = wholeOf(eda, collection);
    const { view: _view, ...data } = shown;
    const notRun = only ? `${PROBES[only].name} has not run on this Resource yet: run it with run_eda_probe when the User asks.\n` : '';
    return said(`${notRun}${shows ? 'The EDA is shown to the User in the conversation.\n' : ''}${wholeText(eda, shown)}`, shows ? shown : data);
  }

  /** Runs an EDA-Probe as the User, through eda and query (FR-ED-06); Claude never approves, so above the free range it waits for the User. */
  async function run(resourceId: string, key: ProbeKey, given: { fields?: string[] | undefined; params?: Record<string, unknown> | undefined }, approve: boolean): Promise<CallToolResult> {
    const before = await edaOf(resourceId);
    if (!before) return withoutEda(resourceId, true);
    const current = before.probes.find((one) => one.key === key);
    if (!current) return refusal(`${PROBES[key].name} is not offered for ${before.resource.displayName}, by its model type (DEC-ED-12). Say so to the User.`);
    // Run again, it keeps what it is set on, unless other fields are named (FR-ED-16).
    const setOn = given.fields ?? (current.added && current.fields.length > 0 ? current.fields : undefined);
    const setWith = given.params ?? (given.fields === undefined && current.added && Object.keys(current.params).length > 0 ? current.params : undefined);
    const ran = await hub.send<RunAnswer>('eda', 'POST', `/resources/${enc(resourceId)}/eda/probes/${enc(key)}/runs`, {
      ...(setOn ? { fields: setOn } : {}),
      ...(setWith ? { params: setWith } : {}),
      approve,
    });
    const eda = ran.state === 'ran' ? ran.eda : before;
    const collection = await collectionOf(eda.resource.collection?.id, eda.resource.collection?.name);
    const name = `${PROBES[key].name} on ${eda.resource.displayName} (${levelName(eda.resource.level)})`;
    if (ran.state === 'ran') {
      const one = eda.probes.find((candidate) => candidate.key === key);
      if (!one?.lastRun) throw new Error(`eda answered a run of ${key} without its result`);
      const shown = runOf(eda, one, collection);
      return said(runText(eda, shown, `${name} ran${approve ? ', approved by the User,' : ''} and its result is shown to the User:`), shown);
    }
    const head = headOf(eda, collection);
    const probeOf = { probe: key, name: PROBES[key].name, setOn: setOn ?? current.applies.fields, page: hub.page(pages.edaProbe(eda.resource.id, key)) };
    if (ran.state === 'approve') {
      const shown = {
        ...head,
        mode: 'approve' as const,
        // The gauge of the run, between what runs freely and what the User may approve, as for a query.
        approve: {
          ...probeOf,
          ...(setOn ? { fields: setOn } : {}),
          ...(setWith ? { params: setWith } : {}),
          bytes: ran.bytes,
          reads: bytes(ran.bytes),
          thresholds: { approve: ranges.approve, request: ranges.request },
          free,
          large,
        },
      };
      return said(
        `${name} reads ${bytes(ran.bytes)}, more than the ${free} Data Hub runs freely; up to ${large} the User may approve it. Only the User approves it, in the window; you cannot. Set on fewer fields it reads less.`,
        shown,
      );
    }
    const shown = { ...head, mode: 'refused' as const, refused: { ...probeOf, reason: ran.reason, reads: bytes(ran.bytes) } };
    return said(`${name} did not run: ${ran.reason} Say so to the User, and do not try another way around it.`, shown);
  }

  server.registerTool(
    'get_eda',
    {
      title: 'Read the EDA of a Resource',
      description:
        "The EDA of a Resource, in words first: where it stands (In progress or Explored), its Level, how many needed EDA-Probes are complete, what Data Hub reads as look at this and for the User to judge, with the User's own reading, the best next step, and per EDA-Step each EDA-Probe added with its result in a sentence and what it is set on; the needed ones Data Hub does not run yet are Coming, and still count. Then the same as data. Starting an EDA stays in Data Hub.",
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) => attempt(() => whole(resourceId, false)),
  );

  server.registerTool(
    'show_eda',
    {
      title: 'Show the EDA of a Resource',
      description:
        "Shows the EDA of a Resource to the User in the conversation, when they ask to see it: its status, Level and the bar of its EDA-Setup, what to look at first, and per EDA-Step the EDA-Probes added with their reading and result in a sentence; the charts stay in Data Hub. With probe, it shows the last result of that EDA-Probe per field instead, with the buttons of the User's reading, without running it again. You get the same as from get_eda.",
      inputSchema: { id, probe: probe.optional() },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: resourceId, probe: only }) => attempt(() => whole(resourceId, true, only)),
  );

  server.registerTool(
    'run_eda_probe',
    {
      title: 'Run an EDA-Probe',
      description: `Runs an EDA-Probe Data Hub runs on a Resource that has an EDA, as the User, and shows its conclusion and its result per field in the conversation, with the buttons of the User's reading; it is added to the EDA when it was not. Up to ${free} it runs; above, up to ${large}, only the User approves it, in the window; above that it does not run. Run it when the User asks, such as after a fix; the reading of a result is always theirs, never yours.`,
      inputSchema: { id, probe, fields, params },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: SHOWS,
    },
    ({ id: resourceId, probe: key, fields: given, params: setWith }) => attempt(() => run(resourceId, key, { fields: given, params: setWith }, false)),
  );

  server.registerTool(
    'run_eda_probe_approved',
    {
      title: 'Approve and run an EDA-Probe',
      description: `The button of the User: runs an EDA-Probe that reads more than ${free}, as they approved it. Only the MCP App calls this.`,
      inputSchema: { id, probe, fields, params },
      annotations: { ...WRITE, idempotentHint: false },
      _meta: APP_ONLY,
    },
    ({ id: resourceId, probe: key, fields: given, params: setWith }) => attempt(() => run(resourceId, key, { fields: given, params: setWith }, true)),
  );

  server.registerTool(
    'give_eda_reading',
    {
      title: 'Give the reading of a result',
      description: "The buttons of the User: their reading of a result of the last run of an EDA-Probe, Expected, Known or A problem, in place of an earlier one. Only the MCP App calls this.",
      inputSchema: {
        id,
        probe,
        subject: z.string().max(300).describe("'' for the table as a whole, else the name of the field."),
        reading: z.enum(['expected', 'known', 'problem']),
      },
      annotations: WRITE,
      _meta: APP_ONLY,
    },
    ({ id: resourceId, probe: key, subject, reading }) =>
      attempt(async () => {
        let eda: EdaView;
        try {
          eda = await hub.send<EdaView>('eda', 'PUT', `/resources/${enc(resourceId)}/eda/probes/${enc(key)}/readings`, { subject, reading });
        } catch (error) {
          // No such result to read, or no EDA: eda says which, in words for the User.
          if (error instanceof Refused && error.status === 404) return refusal(error.message);
          throw error;
        }
        const one = eda.probes.find((candidate) => candidate.key === key);
        if (!one?.lastRun) return refusal(`${PROBES[key].name} has no result to read.`);
        const shown = runOf(eda, one, await collectionOf(eda.resource.collection?.id, eda.resource.collection?.name));
        const of = subject === '' ? 'the table as a whole' : code(subject);
        return said(`The User's reading of ${of} in ${PROBES[key].name} is kept in Data Hub: ${YOURS[reading]}. It is theirs; never change it for them.`, shown);
      }),
  );
}
