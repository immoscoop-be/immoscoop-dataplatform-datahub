import { z } from 'zod';
import { answer, attempt, firstSentence, levelName, plain, refusal } from './answers.js';
import { APP_ONLY, bytes, type Context, READ, SHARE, SHOWS, WRITE } from './context.js';
import { pages, Refused } from './datahub.js';

/** A Resource as a Collection lists it. */
interface Item {
  id: string;
  key: string;
  displayName: string;
  level: number;
  published: boolean;
  deprecated: boolean;
  withdrawn: boolean;
  description?: string;
}

interface Collection {
  id: string;
  name: string;
  visibility: 'private' | 'public';
  canManage: boolean;
  ownerUnit: { id: string; name: string };
  resources: Item[];
}

interface Field {
  name: string;
  dataType: string | null;
  description: string;
  businessDescription: string;
}

interface Detail extends Item {
  description: string;
  collectionId: string | null;
  fields: Field[];
  card: Record<string, unknown>;
  deprecation: { at: string; by: string; reason: string; insteadOf: { id: string; displayName: string } | null } | null;
  [key: string]: unknown;
}

const id = z.string().min(1).describe('The ID of the Resource, from list_resources or search.');
const WINDOWS = [1, 4, 12] as const;
const window = z
  .union([z.literal(1), z.literal(4), z.literal(12)])
  .optional()
  .describe('How many of its newest partitions a Preview reads: 1, 4 or 12 (DEC-SR-39). 4 when not given.');
const values = z
  .record(z.string(), z.string())
  .optional()
  .describe('The value of each Parameter of the Preview to filter on, by field, from the choices it offers.');

/** The tools around Resources (see docs/requirements/functional/17-claude.md, Resources through the MCP). */
export function resourceTools({ server, hub, user }: Context): void {
  const enc = encodeURIComponent;

  /** The state of a Resource in one line, for a list (FR-CL-05). */
  const stateOf = (item: Item) => ({
    id: item.id,
    displayName: item.displayName,
    level: levelName(item.level),
    ...(item.published ? {} : { published: false }),
    ...(item.deprecated ? { deprecated: true } : {}),
    ...(item.withdrawn ? { withdrawn: true } : {}),
    ...(item.description ? { description: firstSentence(item.description) } : {}),
    page: hub.page(pages.resource(item.id)),
  });

  server.registerTool(
    'list_resources',
    {
      title: 'List the Resources you see',
      description:
        'Every Resource the User sees, by Collection, with its Level and whether it is deprecated; for its Owner Unit and the Data Team also those not published or withdrawn. Needs no words, unlike search. Narrow it to one Collection to get the first sentence of each description too.',
      inputSchema: { collection: z.string().optional().describe('The ID of one Collection, to list only its Resources.') },
      annotations: READ,
    },
    ({ collection }) =>
      attempt(async () => {
        if (collection) {
          const [found, { resources }] = await Promise.all([
            hub.get<Collection>('catalogue', `/collections/${enc(collection)}`),
            hub.get<{ resources: Item[] }>('catalogue', `/collections/${enc(collection)}/resources`),
          ]);
          return answer({
            collections: [{ id: found.id, name: found.name, owner: found.ownerUnit.name, page: hub.page(pages.collection(found.id)), resources: resources.map(stateOf) }],
          });
        }
        const { collections } = await hub.get<{ collections: Collection[] }>('catalogue', '/collections');
        return answer(
          {
            collections: collections.map((found) => ({
              id: found.id,
              name: found.name,
              owner: found.ownerUnit.name,
              visibility: found.visibility,
              page: hub.page(pages.collection(found.id)),
              resources: found.resources.map(stateOf),
            })),
          },
          'Every Resource you may see, by Collection. Name the Level of a Resource when you use it.',
        );
      }),
  );

  server.registerTool(
    'search',
    {
      title: 'Search Data Hub',
      description:
        'The Collections, Resources and Lenses the User sees that share words with a question, those that share most first, at most 20 of each. For everything the User sees, use list_resources.',
      inputSchema: { question: z.string().min(1).max(500).describe('The question or the words to search for.') },
      annotations: READ,
    },
    ({ question }) =>
      attempt(async () => {
        const asked = enc(question);
        const [found, lenses] = await Promise.all([
          hub.get<{ collections: { id: string; name: unknown; description: unknown; resources: number }[]; resources: { id: string; displayName: unknown; description: unknown; collectionName: string; level: number }[] }>(
            'catalogue',
            `/search?question=${asked}`,
          ),
          hub.get<{ lenses: { id: string; name: string; question: string; shows: string; level: number | null; state: string }[] }>('query', `/lenses/search?question=${asked}`).catch(() => ({ lenses: [] })),
        ]);
        return answer({
          resources: found.resources.map((item) => ({
            id: item.id,
            displayName: plain(item.displayName),
            description: plain(item.description),
            collection: item.collectionName,
            level: levelName(item.level),
            page: hub.page(pages.resource(item.id)),
          })),
          collections: found.collections.map((item) => ({ id: item.id, name: plain(item.name), description: plain(item.description), resources: item.resources, page: hub.page(pages.collection(item.id)) })),
          lenses: lenses.lenses.map((item) => ({ id: item.id, name: item.name, question: item.question, shows: item.shows, state: item.state, page: hub.page(pages.lens(item.id)) })),
        });
      }),
  );

  /** A Resource as Claude and the MCP App read it: its card, its size, its Collection and what the User may do with it. */
  async function readResource(resourceId: string) {
    const { resource } = await hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`);
    const [storage, collection] = await Promise.all([
      hub
        .get<{ storage: Record<string, unknown> | null }>('query', `/resources/${enc(resourceId)}/storage`)
        .then((body) => (body.storage ? { ...body.storage, size: bytes(body.storage.bytes as number) } : null))
        .catch(() => null),
      resource.collectionId ? hub.get<Collection>('catalogue', `/collections/${enc(resource.collectionId)}`).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      ...resource,
      levelName: levelName(resource.level),
      storage,
      collection: collection ? { id: collection.id, name: collection.name, owner: collection.ownerUnit.name, visibility: collection.visibility } : null,
      // Who may change it, and who may publish it: its Owner Unit, not the Data Team as such (FR-SR-16).
      mayChange: collection?.canManage ?? false,
      mayPublish: collection !== null && user.groups.includes(collection.ownerUnit.id),
      page: hub.page(pages.resource(resource.id)),
    };
  }

  /** What Claude says first about a Resource: its Level, and a deprecation with what to use instead (FR-CL-05). */
  function stateNote(resource: Awaited<ReturnType<typeof readResource>>): string {
    const parts = [`${resource.displayName} is at ${resource.levelName}.`];
    if (resource.deprecated && resource.deprecation) {
      parts.push(
        `It is deprecated: ${resource.deprecation.reason}${resource.deprecation.insteadOf ? ` Use ${resource.deprecation.insteadOf.displayName} instead (${hub.page(pages.resource(resource.deprecation.insteadOf.id))}).` : ''}`,
      );
    }
    if (!resource.published) parts.push('It is not published: only its Owner Unit and the Data Team see it.');
    if (resource.withdrawn) parts.push('It is withdrawn: dbt no longer exposes it.');
    return parts.join(' ');
  }

  server.registerTool(
    'get_resource',
    {
      title: 'Read a Resource',
      description:
        'The Resource Card: its Display Name and Key, Collection and Owner, Level and Publication, the description of the table and of every field (the Business Description and the one from dbt, each marked), its grain, partition and cluster columns, size, intended use, pitfalls, Known Gaps, key fields and Parameters, and the changes since its last Confirmation. Read it before you query the Resource.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await readResource(resourceId);
        return answer(resource, stateNote(resource));
      }),
  );

  server.registerTool(
    'show_resource',
    {
      title: 'Show a Resource',
      description:
        'Shows the Resource Card to the User in the conversation, with its Overview and Columns, when they ask to see it. You get the same data as get_resource.',
      inputSchema: { id },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await readResource(resourceId);
        return answer({ view: 'resource', resource }, `${stateNote(resource)} The Resource Card is shown to the User in the conversation.`);
      }),
  );

  server.registerTool(
    'get_resource_lineage',
    {
      title: 'Where a Resource comes from',
      description: 'The models up- and downstream of a Resource, with their layers and projects, and which of them are Resources the User sees.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) => attempt(async () => answer({ ...(await hub.get<Record<string, unknown>>('catalogue', `/resources/${enc(resourceId)}/lineage`)), page: hub.page(pages.resource(resourceId)) })),
  );

  server.registerTool(
    'get_related_resources',
    {
      title: 'What a Resource joins with',
      description: 'For each mapped field of a Resource, the other Resources the User sees that carry the same identity, with the field that carries it: what to join on.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const { related } = await hub.get<{ related: { resources: { level: number }[] }[] }>('catalogue', `/resources/${enc(resourceId)}/related`);
        return answer({ related: related.map((mapping) => ({ ...mapping, resources: mapping.resources.map((other) => ({ ...other, level: levelName(other.level) })) })) });
      }),
  );

  server.registerTool(
    'get_resource_log',
    {
      title: 'What happened to a Resource',
      description: 'The Log of a Resource, newest first: its changes, Level, Publication, deprecation and Messages.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) => attempt(async () => answer(await hub.get<Record<string, unknown>>('catalogue', `/resources/${enc(resourceId)}/log`))),
  );

  server.registerTool(
    'get_resource_queries',
    {
      title: 'The queries on a Resource',
      description: 'The queries and Lenses that read a Resource in the last month, with who ran them: for its Owner Unit and the Data Team only.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) => attempt(async () => answer(await hub.get<Record<string, unknown>>('query', `/resources/${enc(resourceId)}/queries`))),
  );

  // What changes about a Resource is shown to the User first and written once they agree; `before` is what
  // Claude showed, so a change by a colleague meanwhile is not overwritten unseen (FR-CL-10, EC-CL-03).
  const card = {
    businessDescription: z.string().max(4000).optional().describe('The Business Description of the table, next to the one from dbt.'),
    intendedUse: z.string().max(2000).optional(),
    pitfalls: z.string().max(2000).optional(),
    knownGaps: z.array(z.string().max(1000)).max(20).optional(),
    reliableSince: z.string().nullable().optional().describe('Since when its data is reliable: YYYY-MM-DD, or null.'),
    keyFields: z.array(z.string()).max(50).optional(),
    parameters: z.array(z.string()).max(50).optional().describe('The fields a Preview offers to choose by.'),
  };

  server.registerTool(
    'update_resource_card',
    {
      title: 'Describe a Resource',
      description:
        'Writes what Data Hub keeps about a Resource, for its Owner Unit and the Data Team: the Business Description, intended use, pitfalls, Known Gaps, since when it is reliable, key fields and Parameters. Show the User what you will write first, and call this only once they agree. Pass in before the values you showed as they were.',
      inputSchema: {
        id,
        ...card,
        before: z.record(z.string(), z.unknown()).optional().describe('The values as you showed them to the User, by the same names, before the change.'),
      },
      annotations: WRITE,
    },
    ({ id: resourceId, before, ...changes }) =>
      attempt(async () => {
        const given = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
        if (Object.keys(given).length === 0) return refusal('Name at least one thing to change.');
        if (before) {
          const { resource } = await hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`);
          const moved = Object.entries(before).filter(([key, value]) => JSON.stringify(resource.card[key] ?? null) !== JSON.stringify(value ?? null));
          if (moved.length > 0) {
            return refusal(
              `Changed since you showed it, by someone else: ${moved.map(([key]) => `${key} is now ${JSON.stringify(resource.card[key] ?? null)}`).join('; ')}. Show the User the new text, and ask again before you write.`,
            );
          }
        }
        const { resource } = await hub.send<{ resource: Detail }>('catalogue', 'PATCH', `/resources/${enc(resourceId)}`, given);
        return answer({ changed: Object.keys(given), card: resource.card, page: hub.page(pages.resource(resourceId)) }, 'Written.');
      }),
  );

  server.registerTool(
    'describe_fields',
    {
      title: 'Describe the fields of a Resource',
      description:
        'Writes the Business Description of fields of a Resource, next to their description from dbt, for its Owner Unit and the Data Team; an empty text removes one. Show the User what you will write first, and call this only once they agree. Pass in before the texts you showed as they were.',
      inputSchema: {
        id,
        fields: z.array(z.object({ name: z.string(), businessDescription: z.string().max(2000) })).min(1).max(1000),
        before: z.array(z.object({ name: z.string(), businessDescription: z.string() })).optional().describe('The Business Descriptions as you showed them, before the change.'),
      },
      annotations: WRITE,
    },
    ({ id: resourceId, fields, before }) =>
      attempt(async () => {
        if (before) {
          const { resource } = await hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`);
          const now = new Map(resource.fields.map((field) => [field.name, field.businessDescription]));
          const moved = before.filter((field) => (now.get(field.name) ?? '') !== field.businessDescription);
          if (moved.length > 0) {
            return refusal(`Changed since you showed it, by someone else: ${moved.map((field) => `${field.name} is now ${JSON.stringify(now.get(field.name) ?? '')}`).join('; ')}. Show the User the new text, and ask again before you write.`);
          }
        }
        await hub.send('catalogue', 'PUT', `/resources/${enc(resourceId)}/fields`, { fields });
        return answer({ described: fields.map((field) => field.name), page: hub.page(pages.resource(resourceId)) }, 'Written.');
      }),
  );

  server.registerTool(
    'mark_changes_seen',
    {
      title: 'Mark the changes of a Resource seen',
      description: 'Marks the changes since the last Confirmation of a Resource seen, for its Owner Unit and the Data Team. Ask the User first.',
      inputSchema: { id },
      annotations: WRITE,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        await hub.send('catalogue', 'POST', `/resources/${enc(resourceId)}/changes/seen`);
        return answer({ seen: true, page: hub.page(pages.resource(resourceId)) }, 'The changes are marked seen.');
      }),
  );

  server.registerTool(
    'deprecate_resource',
    {
      title: 'Deprecate a Resource',
      description:
        'Marks a published Resource deprecated, for its Owner Unit and the Data Team: everyone who sees it is told why, and what to use instead. It still works. Show the User the reason first, and call this only once they agree.',
      inputSchema: {
        id,
        reason: z.string().min(1).max(500).describe('Why its use is discouraged, in the words of the User.'),
        insteadOf: z.string().optional().describe('The ID of the Resource to use instead, if any.'),
      },
      annotations: SHARE,
    },
    ({ id: resourceId, reason, insteadOf }) =>
      attempt(async () => {
        await hub.send('catalogue', 'PUT', `/resources/${enc(resourceId)}/deprecation`, { reason, insteadOf: insteadOf ?? null });
        return answer({ deprecated: true, page: hub.page(pages.resource(resourceId)) }, 'It is deprecated now; everyone who sees it is told.');
      }),
  );

  server.registerTool(
    'undeprecate_resource',
    {
      title: 'Take a deprecation away',
      description: 'Takes the deprecation of a Resource away, for its Owner Unit and the Data Team. Ask the User first.',
      inputSchema: { id },
      annotations: SHARE,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        await hub.send('catalogue', 'DELETE', `/resources/${enc(resourceId)}/deprecation`);
        return answer({ deprecated: false, page: hub.page(pages.resource(resourceId)) }, 'The deprecation is taken away.');
      }),
  );

  // Publishing cannot be undone, so only the User publishes, in the MCP App (FR-CL-12, DEC-CL-07).
  server.registerTool(
    'publish_resource',
    {
      title: 'Open the publication of a Resource',
      description:
        'Opens the publication of a Resource for the User, in the conversation: who will see it, what Data Hub checked, and the declaration. Only the User publishes, by ticking the declaration there: you cannot. Use it only for a member of its Owner Unit (mayPublish in get_resource); for anyone else, say who publishes it.',
      inputSchema: { id },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await readResource(resourceId);
        const ready = resource.level >= 2;
        const note = resource.published
          ? `${resource.displayName} is published already; a Publication cannot be undone.`
          : !resource.mayPublish
            ? `Only a member of the Owner Unit of ${resource.collection?.name ?? 'its Collection'}${resource.collection ? `, ${resource.collection.owner},` : ''} publishes it. Say so to the User, and offer a Message on the Resource.`
            : !ready
              ? `It cannot be published yet: it is at ${resource.levelName}, and is published from 2 · Described, once dbt describes the table and at least one field.`
              : `The publication is shown to the User. Only they can publish it, by ticking the declaration in the window; you cannot. If they see no window, they publish it on its page: ${resource.page}`;
        return answer({ view: 'publish', resource, ready }, note);
      }),
  );

  server.registerTool(
    'confirm_publication',
    {
      title: 'Publish and confirm',
      description: 'The button of the User in the publication: publishes the Resource and confirms it. Only the MCP App calls this.',
      inputSchema: { id },
      annotations: SHARE,
      _meta: APP_ONLY,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        await hub.send('catalogue', 'POST', `/resources/${enc(resourceId)}/publication`);
        const resource = await readResource(resourceId);
        return answer({ view: 'publish', resource, ready: true }, `Published by the User: ${resource.displayName} is now at ${resource.levelName}.`);
      }),
  );

  // A Preview in the conversation: up to 100 MB it runs, above only the User approves or sends a Request (FR-CL-09).
  interface PreviewArgs {
    id: string;
    window?: (typeof WINDOWS)[number] | undefined;
    values?: Record<string, string> | undefined;
  }

  async function preview({ id: resourceId, window: size = 4, values: chosen = {} }: PreviewArgs, approve: boolean) {
    const path = `/resources/${enc(resourceId)}/preview`;
    const body = { window: size, values: chosen };
    const [{ resource }, choices, checked] = await Promise.all([
      hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`),
      hub.send<Record<string, unknown>>('query', 'POST', `${path}/choices`, { window: size }),
      hub.send<{ preflight: Preflight; request: { state: string } | null }>('query', 'POST', `${path}/preflight`, body),
    ]);
    const head = {
      view: 'preview',
      resource: { id: resource.id, displayName: resource.displayName, level: resource.level, levelName: levelName(resource.level), page: hub.page(pages.resource(resource.id)) },
      window: size,
      values: chosen,
      choices,
      preflight: checked.preflight,
      reads: bytes(checked.preflight.bytes),
      request: checked.request,
    };
    const range = checked.preflight.range;
    if (!checked.preflight.runnable) return { ...head, outcome: 'blocked' as const };
    if (range !== 'free' && !approve) {
      return { ...head, outcome: range === 'request' && checked.request?.state !== 'accepted' ? ('request' as const) : ('approve' as const) };
    }
    try {
      const ran = await hub.send<{ run: Record<string, unknown>; page: Record<string, unknown> }>('query', 'POST', `${path}/runs`, { ...body, approve });
      return { ...head, outcome: 'ran' as const, run: ran.run, page: ran.page };
    } catch (error) {
      if (error instanceof Refused && (error.status === 409 || error.status === 422)) return { ...head, outcome: 'blocked' as const, problem: error.message };
      throw error;
    }
  }

  const previewNote = (shown: Awaited<ReturnType<typeof preview>>): string => {
    const name = `${shown.resource.displayName} (${shown.resource.levelName})`;
    switch (shown.outcome) {
      case 'ran':
        return `The Preview of ${name} ran and is shown to the User; its first rows are below. Answer from them, and name the Level.`;
      case 'approve':
        return `The Preview of ${name} reads ${shown.reads}, more than the 100 MB Data Hub runs freely. Only the User approves it, in the window; you cannot. A narrower window or a Parameter reads less.`;
      case 'request':
        return `The Preview of ${name} reads ${shown.reads}, more than 1 GB: the Data Team accepts it first. Only the User sends that Request, in the window; you cannot.${shown.request?.state === 'waiting' ? ' A Request of theirs is waiting already.' : ''}`;
      case 'blocked':
        return `The Preview of ${name} cannot run as it is: ${'problem' in shown && shown.problem ? shown.problem : JSON.stringify(shown.preflight.problems)}`;
    }
  };

  server.registerTool(
    'preview_resource',
    {
      title: 'Preview a Resource',
      description:
        'Shows the first rows of a Resource to the User in the conversation, filtered by its Parameters, through the Pre-flight: up to 100 MB it runs and you get the rows too; above, only the User approves it, or sends a Request to the Data Team above 1 GB, in the window.',
      inputSchema: { id, window, values },
      annotations: READ,
      _meta: SHOWS,
    },
    (args) =>
      attempt(async () => {
        const shown = await preview(args, false);
        return answer(shown, previewNote(shown));
      }),
  );

  server.registerTool(
    'run_preview_approved',
    {
      title: 'Approve and run a Preview',
      description: 'The button of the User: runs a Preview that reads more than 100 MB, as they approved it. Only the MCP App calls this.',
      inputSchema: { id, window, values },
      annotations: READ,
      _meta: APP_ONLY,
    },
    (args) =>
      attempt(async () => {
        const shown = await preview(args, true);
        return answer(shown, previewNote(shown));
      }),
  );

  server.registerTool(
    'send_preview_request',
    {
      title: 'Send a Preview to the Data Team',
      description: 'The button of the User: sends a Request to the Data Team to run a Preview above 1 GB. Only the MCP App calls this.',
      inputSchema: { id, window, values, text: z.string().max(500).optional().describe('A word for the Data Team.') },
      annotations: SHARE,
      _meta: APP_ONLY,
    },
    ({ id: resourceId, window: size = 4, values: chosen = {}, text = '' }) =>
      attempt(async () => {
        const sent = await hub.send<Record<string, unknown>>('query', 'POST', `/resources/${enc(resourceId)}/preview/requests`, { window: size, values: chosen, text });
        return answer({ view: 'sent', ...sent }, 'The User sent the Request to the Data Team; its answer comes in their Message Centre.');
      }),
  );
}

/** The Pre-flight of a query or a Preview, as query gives it (FR-SR-36). */
export interface Preflight {
  runnable: boolean;
  bytes: number | null;
  range: 'free' | 'approve' | 'request' | null;
  partitions: number | null;
  problems: Record<string, unknown>[];
  warnings: Record<string, unknown>[];
}
