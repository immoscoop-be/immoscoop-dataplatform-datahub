import { z } from 'zod';
import { answer, attempt, firstSentence, levelName, plain, refusal } from './answers.js';
import { rangesOf } from '@datahub/contracts';
import { APP_ONLY, bytes, type Context, READ, SHARE, SHOWS, WRITE } from './context.js';
import { pages, Refused } from './datahub.js';
import { collectionIcon } from './icons.js';
import { CARD_RULE, cardAnswer, notInClaude, runShape, shapeOf, shapeText } from './results.js';
import { type SummaryFacts, summaryParts, summaryText } from './summary.js';

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
  /** The name of its icon in Phosphor, such as `coins` (DEC-CO-19). */
  icon: string | null;
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

/**
 * The tools around Resources (see docs/requirements/functional/17-claude.md, Resources through the MCP): those that
 * write, Preview or publish only when the Permissions of the User allow it (TR-PL-09).
 */
export function resourceTools({ server, hub, user, permits }: Context): void {
  // The ranges of one run of this User, from their Permission group (runs.ranges, DEC-SR-29).
  const free = bytes(rangesOf(user.permissions).approve);
  const large = bytes(rangesOf(user.permissions).request);
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
    // Its icon goes with the card, as the MCP App loads nothing from outside (DEC-UX-164).
    const icon = collection ? await collectionIcon(collection.icon) : '';
    return {
      ...resource,
      levelName: levelName(resource.level),
      storage,
      collection: collection ? { id: collection.id, name: collection.name, icon, owner: collection.ownerUnit.name, visibility: collection.visibility } : null,
      // Who may change it, and who may publish it: its Owner Unit, as far as their Permission group lets them (FR-SR-16, FR-PL-14).
      mayChange: collection?.canManage ?? false,
      mayPublish: permits.publish && collection !== null && user.groups.includes(collection.ownerUnit.id),
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

  /**
   * The Summary of a Resource, as text for Claude and as its parts for the MCP App (FR-CL-25, FR-CL-26): from the card
   * and what it takes besides, the threads, the Log and what it joins, each of which may be missing.
   */
  async function summaryOf(resource: Awaited<ReturnType<typeof readResource>>) {
    const [threads, log, related] = await Promise.all([
      hub.get<{ messages: SummaryFacts['threads'] }>('catalogue', `/messages/on/resource/${enc(resource.id)}`).then((body) => body.messages).catch(() => []),
      hub.get<{ entries: SummaryFacts['log'] }>('catalogue', `/resources/${enc(resource.id)}/log`).then((body) => body.entries).catch(() => []),
      hub.get<{ related: SummaryFacts['related'] }>('catalogue', `/resources/${enc(resource.id)}/related`).then((body) => body.related).catch(() => []),
    ]);
    const facts: SummaryFacts = {
      ...(resource as unknown as SummaryFacts),
      levelName: resource.levelName,
      page: resource.page,
      collection: resource.collection ? { name: resource.collection.name, owner: resource.collection.owner } : null,
      storage: resource.storage as SummaryFacts['storage'],
      threads,
      log,
      related,
    };
    return { text: summaryText(facts), parts: summaryParts(facts) };
  }

  server.registerTool(
    'get_resource',
    {
      title: 'Read a Resource',
      description:
        'The Summary of a Resource, the general instruction on it, first: everything Data Hub knows about it in the order to read it, each part with its weight (Read first, Before you query, When interpreting results, Context), among them the Q&A of its Owner and the Data Team. Then the Resource Card as data: the description of every field (the Business Description and the one from dbt, each marked), its grain, partition and cluster columns, size, Known Gaps, key fields and Parameters. Read it before you query the Resource, and follow its weights.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await readResource(resourceId);
        const summary = await summaryOf(resource);
        // The Summary first, as Markdown, so that Claude reads it as written; the card as data after it (FR-CL-25, DEC-CL-16).
        return {
          content: [{ type: 'text', text: `${stateNote(resource)}\n\n${summary.text}` }, { type: 'text', text: JSON.stringify(resource) }],
          structuredContent: { summary: summary.text, ...resource },
        };
      }),
  );

  server.registerTool(
    'show_resource',
    {
      title: 'Show a Resource',
      description:
        'Shows the Resource to the User in the conversation, as a window that opens on its Summary, with its Columns, when they ask to see it. You get the same as from get_resource: the Summary first, read it and follow its weights, then the Resource Card as data.',
      inputSchema: { id },
      annotations: READ,
      _meta: SHOWS,
    },
    ({ id: resourceId }) =>
      attempt(async () => {
        const resource = await readResource(resourceId);
        const summary = await summaryOf(resource);
        // Claude reads the Summary first, as from get_resource; the MCP App draws its parts (FR-CL-26, DEC-CL-16).
        return {
          content: [
            { type: 'text', text: `${stateNote(resource)} The Resource is shown to the User in the conversation, on its Summary.\n\n${summary.text}` },
            { type: 'text', text: JSON.stringify(resource) },
          ],
          structuredContent: { summary: summary.text, view: 'resource', parts: summary.parts, resource },
        };
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

  // The queries of others on a Resource, for a User whose Permission group lets them see those (queries.seeOthers).
  if (permits.queriesOnResource) {
    server.registerTool(
      'get_resource_queries',
      {
        title: 'The queries on a Resource',
        description: 'The queries and Lenses that read a Resource in the last month, with who ran them, as far as the User may see the queries of others.',
        inputSchema: { id },
        annotations: READ,
      },
      ({ id: resourceId }) => attempt(async () => answer(await hub.get<Record<string, unknown>>('query', `/resources/${enc(resourceId)}/queries`))),
    );
  }

  // What changes about a Resource is shown to the User first and written once they agree; `before` is what
  // Claude showed, so a change by a colleague meanwhile is not overwritten unseen (FR-CL-10, EC-CL-03).
  const card = {
    businessDescription: z.string().max(4000).optional().describe('The Business Description of the table, next to the one from dbt, in Markdown.'),
    intendedUse: z.string().max(2000).optional().describe('What it is meant for, in Markdown (FR-RC-23).'),
    pitfalls: z.string().max(2000).optional().describe('Where it trips people up, in Markdown (FR-RC-23).'),
    knownGaps: z.array(z.string().max(1000)).max(50).optional().describe('Every Known Gap, the whole list as its texts: a gap whose text stays keeps who added it.'),
    reliableSince: z.string().nullable().optional().describe('Since when its data is reliable: YYYY-MM-DD, or null.'),
    keyFields: z.array(z.string()).max(50).optional(),
    parameters: z.array(z.string()).max(50).optional().describe('The fields a Preview offers to choose by.'),
  };
  const CARD_NAMES: Record<keyof typeof card, string> = {
    businessDescription: 'the Business Description',
    intendedUse: 'intended use',
    pitfalls: 'pitfalls',
    knownGaps: 'Known Gaps',
    reliableSince: 'since when it is reliable',
    keyFields: 'key fields',
    parameters: 'Parameters',
  };
  // Only the parts of the card the Permission group lets Claude write for the User (claude.use, resources.describe).
  const writable = Object.fromEntries(permits.card.map((key) => [key, card[key]])) as typeof card;

  if (permits.card.length > 0) {
    server.registerTool(
      'update_resource_card',
      {
        title: 'Describe a Resource',
        description: `Writes what Data Hub keeps about a Resource the User may describe: ${permits.card.map((key) => CARD_NAMES[key]).join(', ')}. Show the User what you will write first, and call this only once they agree. Pass in before the values you showed as they were.`,
        inputSchema: {
          id,
          ...writable,
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
            // The Known Gaps are items with who added them; Claude shows and sends their texts.
            const now = (key: string) => (key === 'knownGaps' ? ((resource.card.knownGaps ?? []) as { text: string }[]).map((gap) => gap.text) : resource.card[key]);
            const moved = Object.entries(before).filter(([key, value]) => JSON.stringify(now(key) ?? null) !== JSON.stringify(value ?? null));
            if (moved.length > 0) {
              return refusal(
                `Changed since you showed it, by someone else: ${moved.map(([key]) => `${key} is now ${JSON.stringify(now(key) ?? null)}`).join('; ')}. Show the User the new text, and ask again before you write.`,
              );
            }
          }
          const { resource } = await hub.send<{ resource: Detail }>('catalogue', 'PATCH', `/resources/${enc(resourceId)}`, given);
          return answer({ changed: Object.keys(given), card: resource.card, page: hub.page(pages.resource(resourceId)) }, 'Written.');
        }),
    );
  }

  if (permits.fields) {
    server.registerTool(
      'describe_fields',
      {
        title: 'Describe the fields of a Resource',
        description:
          'Writes the Business Description of fields of a Resource the User may describe, next to their description from dbt; an empty text removes one. Show the User what you will write first, and call this only once they agree. Pass in before the texts you showed as they were.',
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
  }

  if (permits.changesSeen) {
    server.registerTool(
      'mark_changes_seen',
      {
        title: 'Mark the changes of a Resource seen',
        description: 'Marks the changes since the last Confirmation of a Resource the User may describe seen. Ask the User first.',
        inputSchema: { id },
        annotations: WRITE,
      },
      ({ id: resourceId }) =>
        attempt(async () => {
          await hub.send('catalogue', 'POST', `/resources/${enc(resourceId)}/changes/seen`);
          return answer({ seen: true, page: hub.page(pages.resource(resourceId)) }, 'The changes are marked seen.');
        }),
    );
  }

  if (permits.deprecate) {
    server.registerTool(
      'deprecate_resource',
      {
        title: 'Deprecate a Resource',
        description:
          'Marks a published Resource the User may deprecate deprecated: everyone who sees it is told why, and what to use instead. It still works. Show the User the reason first, and call this only once they agree.',
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
        description: 'Takes the deprecation of a Resource the User may deprecate away. Ask the User first.',
        inputSchema: { id },
        annotations: SHARE,
      },
      ({ id: resourceId }) =>
        attempt(async () => {
          await hub.send('catalogue', 'DELETE', `/resources/${enc(resourceId)}/deprecation`);
          return answer({ deprecated: false, page: hub.page(pages.resource(resourceId)) }, 'The deprecation is taken away.');
        }),
    );
  }

  // Publishing cannot be undone, so only the User publishes, in the MCP App (FR-CL-12, DEC-CL-07).
  if (permits.publish) {
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
  }

  if (permits.preview) previewTools();

  /**
   * A Preview in the conversation: up to 100 MB it runs, above only the User approves or sends a Request (FR-CL-09).
   * Its result reaches Claude as the Permission group of the User says (FR-CL-28): in Claude, its rows and choices; in a
   * card only, its head, while the MCP App reads its rows and choices through tools only it calls; not in Claude, the
   * link to the Resource in Data Hub.
   */
  function previewTools(): void {
    const card = permits.results === 'card';
    const NARROWER = 'a narrower window or a Parameter';

    if (permits.results === 'none') {
      server.registerTool(
        'preview_resource',
        {
          title: 'Preview a Resource',
          description: 'The link to a Resource in Data Hub, where the User previews it: their Permission group does not show results in Claude.',
          inputSchema: { id, window, values },
          annotations: READ,
        },
        ({ id: resourceId }) =>
          attempt(async () => {
            const { resource } = await hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`);
            const shown = { id: resource.id, displayName: resource.displayName, levelName: levelName(resource.level) };
            return notInClaude(`The Preview of ${shown.displayName} (${shown.levelName})`, { resource: shown, page: hub.page(pages.resource(resource.id)) });
          }),
      );
      return;
    }

    interface PreviewArgs {
      id: string;
      window?: (typeof WINDOWS)[number] | undefined;
      values?: Record<string, string> | undefined;
    }

    async function preview({ id: resourceId, window: size = 4, values: chosen = {} }: PreviewArgs, approve: boolean) {
      const path = `/resources/${enc(resourceId)}/preview`;
      const body = { window: size, values: chosen };
      // In a card only, the values of its choices are no head for Claude: the MCP App reads them itself.
      const [{ resource }, choices, checked] = await Promise.all([
        hub.get<{ resource: Detail }>('catalogue', `/resources/${enc(resourceId)}`),
        card ? Promise.resolve(null) : hub.send<Record<string, unknown>>('query', 'POST', `${path}/choices`, { window: size }),
        hub.send<{ preflight: Preflight; request: { state: string } | null }>('query', 'POST', `${path}/preflight`, body),
      ]);
      // The Collection of the Resource, with its icon, for the head of the Preview (DEC-UX-164).
      const collection = resource.collectionId ? await hub.get<Collection>('catalogue', `/collections/${enc(resource.collectionId)}`).catch(() => null) : null;
      const head = {
        view: 'preview',
        collection: collection ? { name: collection.name, icon: await collectionIcon(collection.icon) } : null,
        resource: { id: resource.id, displayName: resource.displayName, level: resource.level, levelName: levelName(resource.level), page: hub.page(pages.resource(resource.id)) },
        window: size,
        values: chosen,
        choices,
        preflight: checked.preflight,
        reads: bytes(checked.preflight.bytes),
        request: checked.request,
      };
      const range = checked.preflight.range;
      const big = tooLarge(checked.preflight, NARROWER);
      if (!checked.preflight.runnable) return { ...head, outcome: 'blocked' as const, ...(big ? { problem: big.forUser } : {}) };
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
          return `The Preview of ${name} reads ${shown.reads}, more than the ${free} Data Hub runs freely. Only the User approves it, in the window; you cannot. A narrower window or a Parameter reads less.`;
        case 'request':
          return `The Preview of ${name} reads ${shown.reads}, more than ${large}: the Data Team accepts it first. Only the User sends that Request, in the window; you cannot.${shown.request?.state === 'waiting' ? ' A Request of theirs is waiting already.' : ''}`;
        case 'blocked': {
          const big = tooLarge(shown.preflight, NARROWER);
          if (big) return `The Preview of ${name} cannot run: ${big.forClaude}`;
          return `The Preview of ${name} cannot run as it is: ${'problem' in shown && shown.problem ? shown.problem : JSON.stringify(shown.preflight.problems)}`;
        }
      }
    };

    /** What Claude reads of a Preview: in a card only its head, its shape without a value; else all of it (FR-CL-28). */
    const previewAnswer = (shown: Awaited<ReturnType<typeof preview>>) => {
      if (!card) return answer(shown, previewNote(shown));
      if (shown.outcome !== 'ran') return cardAnswer(shown, previewNote(shown));
      const { page, run, ...head } = shown;
      const result = shapeOf(page);
      const name = `${shown.resource.displayName} (${shown.resource.levelName})`;
      return cardAnswer(
        { ...head, run: runShape(run), result },
        `The Preview of ${name} ran and is shown to the User, in the card only: ${shapeText(result, shown.reads)}. ${CARD_RULE}`,
      );
    };

    server.registerTool(
      'preview_resource',
      {
        title: 'Preview a Resource',
        description: card
          ? `Shows the first rows of a Resource to the User in the conversation, in a card only, filtered by its Parameters, through the Pre-flight: up to ${free} it runs, and you get its shape (its columns, how many rows, what it read), never its values; above, only the User approves it, or sends a Request to the Data Team above ${large}, in the window.`
          : `Shows the first rows of a Resource to the User in the conversation, filtered by its Parameters, through the Pre-flight: up to ${free} it runs and you get the rows too; above, only the User approves it, or sends a Request to the Data Team above ${large}, in the window.`,
        inputSchema: { id, window, values },
        annotations: READ,
        _meta: SHOWS,
      },
      (args) => attempt(async () => previewAnswer(await preview(args, false))),
    );

    server.registerTool(
      'run_preview_approved',
      {
        title: 'Approve and run a Preview',
        description: `The button of the User: runs a Preview that reads more than ${free}, as they approved it. Only the MCP App calls this.`,
        inputSchema: { id, window, values },
        annotations: READ,
        _meta: APP_ONLY,
      },
      (args) => attempt(async () => previewAnswer(await preview(args, true))),
    );

    server.registerTool(
      'send_preview_request',
      {
        title: 'Send a Preview to the Data Team',
        description: `The button of the User: sends a Request to the Data Team to run a Preview above ${large}. Only the MCP App calls this.`,
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

    // In a card only, the MCP App reads the values of the choices of a Preview itself, so that they stay out of what Claude reads (FR-CL-28).
    if (card) {
      server.registerTool(
        'read_preview_choices',
        {
          title: 'Read the choices of a Preview',
          description: 'The values each Parameter of a Preview offers, for the card only. Only the MCP App calls this.',
          inputSchema: { id, window },
          annotations: READ,
          _meta: APP_ONLY,
        },
        ({ id: resourceId, window: size = 4 }) =>
          attempt(async () => {
            const choices = await hub.send<Record<string, unknown>>('query', 'POST', `/resources/${enc(resourceId)}/preview/choices`, { window: size });
            return { content: [{ type: 'text', text: 'The choices of the Preview, for the card only.' }], structuredContent: { choices } };
          }),
      );
    }
  }
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

/**
 * A run above the ranges of a User whose Permission group sends nothing to the Data Team (runs.ranges, above:
 * refuse): it cannot run, and no Request can be sent. What the MCP App shows the User, and what Claude is told: to
 * help narrow it, never to offer a Request. `narrower` names what reads less, such as a filter on the partition column.
 */
export function tooLarge(preflight: Preflight | null | undefined, narrower: string): { forUser: string; forClaude: string } | null {
  const found = preflight?.problems?.find((problem) => problem.kind === 'tooLarge');
  if (!found) return null;
  const reads = bytes(typeof found.bytes === 'number' ? found.bytes : null) ?? 'more';
  const limit = bytes(typeof found.limit === 'number' ? found.limit : null) ?? 'less';
  return {
    forUser: `Too large for your Permission group: it reads ${reads}, and at most ${limit} runs. Narrow it: ${narrower} reads less.`,
    forClaude: `It reads ${reads}, more than the Permission group of the User runs, at most ${limit}: it cannot run, and no Request can be sent to the Data Team, so do not offer one. Help them narrow it: ${narrower} reads less.`,
  };
}
