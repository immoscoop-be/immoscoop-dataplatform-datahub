import { z } from 'zod';
import { answer, attempt, levelName, refusal } from './answers.js';
import { APP_ONLY, type Context, SHOWS, WRITE } from './context.js';
import { pages } from './datahub.js';
import { collectionIcon } from './icons.js';

/** A field as catalogue gives it with its Resource. */
interface Field {
  name: string;
  dataType: string | null;
  description: string;
  businessDescription: string;
}

interface Resource {
  id: string;
  displayName: string;
  level: number;
  collectionId: string | null;
  fields: Field[];
  card: { keyFields?: string[] };
  details?: { partition?: { field: string } | null; clusterBy?: string[] } | null;
}

interface LogEntry {
  logId: string;
  params: Record<string, string>;
  at: string;
}

/** A row of the card: what the field is, the text in its box and how it is marked, and whether it is a Key Field (DEC-UX-281). */
interface Row {
  name: string;
  type: string | null;
  dbt: string;
  pills: string[];
  text: string;
  mark: 'suggested' | 'card' | 'unsaved' | 'empty';
  key: boolean;
  wasKey: boolean;
}

/** A field a colleague described after the card opened: its text stays until the User chooses (FR-CL-38). */
interface Conflict {
  name: string;
  theirs: string;
  mine: string;
  by: string | null;
  at: string | null;
}

const id = z.string().min(1).describe('The ID of the Resource, from list_resources or search.');
const text = z.string().max(2000);
const shownField = z.object({ name: z.string(), businessDescription: z.string() });

/**
 * The fields of a Resource suggested by Claude, decided by the User in one card (FR-CL-38, DEC-CL-22, DEC-UX-281):
 * suggest_fields shows Claude's suggestions and writes nothing; save_fields, which only the MCP App calls, writes what
 * the User ticked and edited, as theirs, never over a text a colleague wrote after the card opened.
 */
export function fieldTools({ server, hub, permits }: Context): void {
  const mayKey = permits.card.includes('keyFields');
  const mayText = permits.fields;
  if (!mayKey && !mayText) return;
  const enc = encodeURIComponent;

  const resourceOf = async (resourceId: string) => (await hub.get<{ resource: Resource }>('catalogue', `/resources/${enc(resourceId)}`)).resource;

  /** The head of the card: the Resource, its Level, its Collection with its icon and Owner Unit, and its pages. */
  async function headOf(resource: Resource) {
    const collection = resource.collectionId
      ? await hub.get<{ name: string; icon: string | null; ownerUnit: { name: string } }>('catalogue', `/collections/${enc(resource.collectionId)}`).catch(() => null)
      : null;
    return {
      resource: {
        id: resource.id,
        displayName: resource.displayName,
        levelName: levelName(resource.level),
        page: hub.page(pages.resource(resource.id)),
        columns: hub.page(pages.resource(resource.id, 'columns')),
      },
      collection: collection ? { name: collection.name, icon: await collectionIcon(collection.icon), owner: collection.ownerUnit.name } : null,
      mayKey,
      mayText,
    };
  }

  /** Partition and cluster columns, as the Columns of the Resource mark them. */
  const pillsOf = (resource: Resource, name: string): string[] => {
    const pills: string[] = [];
    if (resource.details?.partition?.field === name) pills.push('Partition');
    const at = resource.details?.clusterBy?.indexOf(name) ?? -1;
    if (at >= 0) pills.push(`Cluster ${at + 1}`);
    return pills;
  };

  /** The Key Fields and texts as the card showed them when it opened: what a save is held against. */
  const beforeOf = (resource: Resource) => ({
    keyFields: [...(resource.card.keyFields ?? [])],
    fields: resource.fields.map((field) => ({ name: field.name, businessDescription: field.businessDescription ?? '' })),
  });

  server.registerTool(
    'suggest_fields',
    {
      title: 'Suggest the Key Fields and the descriptions of the fields',
      description: [
        'Shows your suggestions for the fields of a Resource the User may describe in one card, where the User ticks the Key Fields, edits the descriptions and saves: it writes nothing itself, and only the button of the User saves (DEC-CL-22). Use it whenever the User describes the fields of a Resource, and at the steps Key Fields and Fields of the Owner Journey, rather than proposing them in text.',
        'Read the Resource first with get_resource: its fields, their types, their descriptions from dbt, its Business Description and grain. Where the Permission group lets you read rows and a Preview runs without an approval, read a small Preview too (preview_resource, the newest 1 or 4 partitions), to see what each field holds; otherwise suggest from the names and descriptions alone.',
        'Suggest a Business Description only for a field that has none: a text on the card is kept. Write each as the business would read it: what the field holds, in plain words, and what to watch for, never how it is computed. Suggest as Key Fields the few fields most questions go through, besides those that are already.',
      ].join(' '),
      inputSchema: {
        id,
        keyFields: z.array(z.string()).max(50).default([]).describe('The fields you suggest as Key Fields, besides those that are already.'),
        descriptions: z.array(z.object({ name: z.string(), text: text.min(1) })).max(1000).default([]).describe('A Business Description for each field that has none, by its name.'),
        basedOn: z.string().min(1).max(300).describe('What you based the suggestions on, as words that follow "Suggested by Claude from", such as "the names, the descriptions from dbt and 20 rows of a Preview of the last 4 weeks".'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: SHOWS,
    },
    ({ id: resourceId, keyFields, descriptions, basedOn }) =>
      attempt(async () => {
        const resource = await resourceOf(resourceId);
        const names = new Set(resource.fields.map((field) => field.name));
        const unknown = [...keyFields, ...descriptions.map((one) => one.name)].filter((name) => !names.has(name));
        const suggested = new Map(descriptions.map((one) => [one.name, one.text.trim()]));
        const current = new Set(resource.card.keyFields ?? []);
        const keys = new Set(mayKey ? [...current, ...keyFields.filter((name) => names.has(name))] : current);
        const kept: string[] = [];
        const rows: Row[] = resource.fields.map((field) => {
          const own = field.businessDescription ?? '';
          const proposal = suggested.get(field.name);
          if (own.trim() !== '' && proposal) kept.push(field.name);
          // A text on the card is kept; a suggestion fills only a field that has none (DEC-CL-22).
          const [shown, mark] = own.trim() !== '' ? [own, 'card' as const] : proposal && mayText ? [proposal, 'suggested' as const] : ['', 'empty' as const];
          return { name: field.name, type: field.dataType, dbt: field.description ?? '', pills: pillsOf(resource, field.name), text: shown, mark, key: keys.has(field.name), wasKey: current.has(field.name) };
        });
        const texts = rows.filter((row) => row.mark === 'suggested').length;
        const newKeys = rows.filter((row) => row.key && !row.wasKey).length;
        const notes = [
          `The card shows your suggestions: ${newKeys} more Key Field${newKeys === 1 ? '' : 's'} and ${texts} description${texts === 1 ? '' : 's'}, for ${resource.displayName} (${levelName(resource.level)}). Nothing is written: the User ticks, edits and saves in the card, and you are told what was saved.`,
          ...(kept.length > 0 ? [`Kept the text already on the card for ${kept.join(', ')}.`] : []),
          ...(unknown.length > 0 ? [`Not fields of this Resource, left out: ${unknown.join(', ')}.`] : []),
          ...(!mayText && descriptions.length > 0 ? ['The Permission group of the User does not let them write the descriptions of fields: the card shows the Key Fields only.'] : []),
          ...(!mayKey && keyFields.length > 0 ? ['The Permission group of the User does not let them change the Key Fields: the card shows the descriptions only.'] : []),
        ];
        return answer({ view: 'fields', ...(await headOf(resource)), basedOn, rows, before: beforeOf(resource) }, notes.join(' '));
      }),
  );

  server.registerTool(
    'save_fields',
    {
      title: 'Save the fields',
      description: 'The button of the User: saves the Key Fields and the descriptions of fields as they ticked and edited them in the card, as theirs. Only the MCP App calls this.',
      inputSchema: {
        id,
        keyFields: z.array(z.string()).max(50).optional().describe('The Key Fields as ticked in the card.'),
        fields: z.array(z.object({ name: z.string(), businessDescription: text })).max(1000).default([]).describe('The descriptions to write.'),
        before: z.object({ keyFields: z.array(z.string()), fields: z.array(shownField) }).describe('The Key Fields and texts as the card showed them when it opened.'),
      },
      annotations: WRITE,
      _meta: APP_ONLY,
    },
    ({ id: resourceId, keyFields, fields, before }) =>
      attempt(async () => {
        if (keyFields && !mayKey) return refusal('Your Permission group does not let you change the Key Fields.');
        if (fields.length > 0 && !mayText) return refusal('Your Permission group does not let you write the descriptions of fields.');
        const resource = await resourceOf(resourceId);
        const now = new Map(resource.fields.map((field) => [field.name, field.businessDescription ?? '']));
        const shown = new Map(before.fields.map((field) => [field.name, field.businessDescription]));
        // A text a colleague wrote after the card opened is never overwritten: it waits for the choice of the User.
        const moved = fields.filter((field) => now.has(field.name) && (now.get(field.name) ?? '') !== (shown.get(field.name) ?? '') && (now.get(field.name) ?? '') !== field.businessDescription);
        const write = fields.filter((field) => now.has(field.name) && !moved.includes(field) && (now.get(field.name) ?? '') !== field.businessDescription);
        let conflicts: Conflict[] = [];
        if (moved.length > 0) {
          const log = await hub.get<{ entries: LogEntry[] }>('catalogue', `/resources/${enc(resourceId)}/log`).then((body) => body.entries).catch(() => [] as LogEntry[]);
          const last = (name: string) => log.filter((entry) => entry.logId === 'RES-010' && entry.params.field === name).sort((a, b) => b.at.localeCompare(a.at))[0];
          conflicts = moved.map((field) => ({ name: field.name, theirs: now.get(field.name) ?? '', mine: field.businessDescription, by: last(field.name)?.params.actor ?? null, at: last(field.name)?.at ?? null }));
        }
        // The Key Fields the User added and took away, on the Key Fields as they are now: a change of a colleague stays.
        let keys = resource.card.keyFields ?? [];
        if (keyFields) {
          const added = keyFields.filter((name) => !before.keyFields.includes(name));
          const removed = before.keyFields.filter((name) => !keyFields.includes(name));
          const next = [...keys.filter((name) => !removed.includes(name)), ...added.filter((name) => !keys.includes(name) && now.has(name))];
          if (JSON.stringify(next) !== JSON.stringify(keys)) {
            await hub.send('catalogue', 'PATCH', `/resources/${enc(resourceId)}`, { keyFields: next });
            keys = next;
          }
        }
        if (write.length > 0) await hub.send('catalogue', 'PUT', `/resources/${enc(resourceId)}/fields`, { fields: write });
        const saved = { keyFields: keys, descriptions: write.map((field) => field.name), at: new Date().toISOString() };
        const after = await resourceOf(resourceId);
        const rows: Row[] = after.fields.map((field) => {
          const conflict = conflicts.find((one) => one.name === field.name);
          const own = conflict ? conflict.mine : (field.businessDescription ?? '');
          return { name: field.name, type: field.dataType, dbt: field.description ?? '', pills: pillsOf(after, field.name), text: own, mark: conflict ? 'unsaved' : own.trim() === '' ? 'empty' : 'card', key: keys.includes(field.name), wasKey: keys.includes(field.name) };
        });
        const said = [
          `The User saved in the card: Key Fields ${keys.length > 0 ? keys.join(', ') : 'none'}; ${write.length} description${write.length === 1 ? '' : 's'}${write.length > 0 ? ` (${write.map((field) => field.name).join(', ')})` : ''}.`,
          ...(conflicts.length > 0 ? [`Not saved, as a colleague described it after the card opened: ${conflicts.map((one) => `${one.name}${one.by ? `, by ${one.by}` : ''}`).join('; ')}. The User chooses in the card which text it keeps.`] : []),
        ];
        return answer({ view: 'fields', ...(await headOf(after)), rows, before: beforeOf(after), saved, conflicts }, said.join(' '));
      }),
  );
}
