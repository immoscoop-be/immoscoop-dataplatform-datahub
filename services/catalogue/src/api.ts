import type { ServiceCallerVerifier } from '@datahub/auth';
import type { CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type CollectionChanges, type Collections, type FolderOutcome, type Movable, NameTaken, NotEmpty, type Viewer } from './collections.js';
import { type Group, type Identity, IdentityUnavailable } from './identity.js';
import { learningRoutes } from './learning-api.js';
import type { Learning } from './learning.js';
import { messageRoutes } from './message-api.js';
import type { Messages } from './messages.js';
import { MODEL_TYPES, type ModelType, type Origins, type PartitionUnit } from './database.js';
import { type Registry, RegistryUnavailable } from './registry.js';
import { REQUEST_TYPES, type RequestFields, type Requests, type RequestType } from './requests.js';
import {
  type AddItem,
  type AddOutcome,
  CARD_KEYS,
  type Card,
  type DeprecateOutcome,
  type Details,
  type EditOutcome,
  type Mapping,
  type Resource,
  type Resources,
  type ResourcesUpdate,
} from './resources.js';

export interface ApiOptions {
  collections: Collections;
  identity: Identity;
  resources: Resources;
  /** Who may hand over the exposed tables: the service account of registry (TR-SR-01). */
  serviceCallers: ServiceCallerVerifier;
  /** registry, for the lineage around a Resource (DEC-AR-06). */
  registry: Registry;
  /** The Requests that wait for the Data Team, such as one to run a very large query (MSG-QRY-01). */
  requests: Requests;
  /** Conversations: the Message Centre and the Messages on every object (FR-CV-01 to FR-CV-09). */
  messages: Messages;
  /** Who may tell about the Lenses and decide on a Request on one: the service account of query (DEC-PF-30). */
  lensCallers: ServiceCallerVerifier;
  /** The progress of every User in the Learning Centre (FR-LR-32). */
  learning: Learning;
}

/** The role of the Data Team, from its Role Group `datahub-datateam@` (Naming Convention). */
const DATA_TEAM = 'datateam';

/** The fields a request may send for a Collection. */
interface Fields {
  name?: string;
  description?: string;
  icon?: CollectionIcon;
  visibility?: CollectionVisibility;
  ownerUnit?: string;
  intro?: string;
}

/** The longest intro of a Collection, in characters of Markdown (TR-CO-08). */
export const INTRO_LIMIT = 10_000;

/** The chosen Owner Unit is not one of the groups of whoever chose it (FR-CO-15), nor of the domain (FR-CO-35). */
class NotYourGroup extends Error {}

/** How many Resources one request adds at most: far more than a Collection takes in at once. */
const ADD_LIMIT = 200;

const NOT_FOUND = { error: 'not_found', message: 'No such Collection.' };
const NO_RESOURCE = { error: 'not_found', message: 'No such Resource.' };
const NO_FOLDER = { error: 'not_found', message: 'No such folder, Resource or Lens in this Collection.' };
const DATA_TEAM_ONLY = { error: 'forbidden', message: 'Only the Data Team adds Resources to Collections and removes them.' };

/** A project with thousands of exposed tables, with their descriptions, fits well within this. */
const UPDATE_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * The routes of Collections (TR-CO-02). Everyone may create one; whoever sees a Collection may read
 * it and its Log; its Owner Unit and the Data Team may change and dissolve it. A Collection someone
 * does not see answers 404, as one that does not exist (FR-CO-17).
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { collections, identity, resources, serviceCallers, registry, requests, messages, lensCallers, learning } = options;

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof NameTaken) {
      return reply.code(409).send({ error: 'name_taken', message: error.message });
    }
    if (error instanceof NotEmpty) {
      return reply.code(409).send({ error: 'not_empty', message: error.message });
    }
    if (error instanceof NotYourGroup) {
      return reply.code(400).send({ error: 'not_your_group', message: 'Choose a group you are in yourself as Owner Unit; the Data Team chooses any group of the domain.' });
    }
    if (error instanceof RegistryUnavailable) {
      request.log.error({ err: error }, 'registry did not give the lineage');
      return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'The lineage could not be read; try again later.' });
    }
    if (error instanceof IdentityUnavailable) {
      request.log.error({ err: error }, 'identity did not tell the groups of the User');
      return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'Your groups could not be read; try again later.' });
    }
    throw error;
  });

  function viewer(request: FastifyRequest): Viewer {
    const user = request.user;
    return { id: user?.sub ?? '', name: user?.name || user?.email || '', groups: user?.groups ?? [], dataTeam: user?.roles.includes(DATA_TEAM) ?? false };
  }

  /**
   * The Owner Unit chosen by the User, read from identity with their own token (TR-CO-03): one of
   * their own groups, or for the Data Team any group of the domain (FR-CO-35). Reading it again also
   * brings its name and address up to date.
   */
  async function ownGroup(request: FastifyRequest, id: string): Promise<Group> {
    const authorization = request.headers.authorization ?? '';
    const groups = viewer(request).dataTeam ? await identity.domainGroups(authorization) : await identity.groups(authorization);
    const group = groups.find((candidate) => candidate.id === id);
    if (!group) {
      throw new NotYourGroup();
    }
    return group;
  }

  /** The answer to adding Resources: what was asked when they were all added, else why none was. */
  async function addOutcome(reply: FastifyReply, outcome: AddOutcome, added: () => Promise<unknown>) {
    switch (outcome.outcome) {
      case 'added':
        return added();
      case 'collection_gone':
        return reply.code(404).send(NOT_FOUND);
      case 'not_found':
        return reply.code(404).send({ ...NO_RESOURCE, resources: outcome.ids });
      case 'in_another_collection':
        return reply
          .code(409)
          .send({ error: 'in_another_collection', message: 'A Resource is in another Collection; remove it there first.', resources: outcome.ids });
      case 'invalid':
        return reply.code(400).send({ error: 'invalid_request', message: outcome.message, resources: [outcome.id] });
    }
  }

  await messageRoutes(app, { collections, messages, lensCallers, viewer });
  await learningRoutes(app, { learning, viewer });

  app.get('/collections', async (request) => ({ collections: await collections.list(viewer(request)) }));

  // The search of the start screen of Collections (FR-CO-37, DEC-UX-127): the Collections and Resources the
  // User sees that share words with a question; query finds the Lenses.
  app.get<{ Querystring: { question?: string } }>('/search', async (request, reply) => {
    const question = (request.query.question ?? '').trim();
    if (question.length > 500) return reply.code(400).send({ error: 'invalid_request', message: 'The question has at most 500 characters.' });
    return collections.search(question, viewer(request));
  });

  app.post<{ Body: unknown }>('/collections', async (request, reply) => {
    const fields = parse(request.body, true);
    if (typeof fields === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: fields });
    }
    const { name, description, icon, ownerUnit, visibility = 'private' } = fields as Required<Fields>;
    const group = await ownGroup(request, ownerUnit);
    const created = await collections.create({ name, description, icon, visibility, ownerUnit: group }, viewer(request));
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/collections/:id', async (request, reply) => {
    return (await collections.get(request.params.id, viewer(request))) ?? reply.code(404).send(NOT_FOUND);
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/collections/:id', async (request, reply) => {
    const fields = parse(request.body, false);
    if (typeof fields === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: fields });
    }
    const who = viewer(request);
    const current = await collections.get(request.params.id, who);
    if (!current) {
      return reply.code(404).send(NOT_FOUND);
    }
    if (!current.canManage) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Owner Unit and the Data Team may change this Collection.' });
    }
    const { ownerUnit, ...rest } = fields;
    const changes: CollectionChanges = { ...rest };
    if (ownerUnit !== undefined && ownerUnit !== current.ownerUnit.id) {
      changes.ownerUnit = await ownGroup(request, ownerUnit);
    }
    return (await collections.change(current.id, changes, who)) ?? reply.code(404).send(NOT_FOUND);
  });

  app.delete<{ Params: { id: string } }>('/collections/:id', async (request, reply) => {
    const who = viewer(request);
    const current = await collections.get(request.params.id, who);
    if (!current) {
      return reply.code(404).send(NOT_FOUND);
    }
    if (!current.canManage) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Owner Unit and the Data Team may dissolve this Collection.' });
    }
    return (await collections.dissolve(current.id, who)) ? reply.code(204).send() : reply.code(404).send(NOT_FOUND);
  });

  // The folders of a Collection (FR-CO-38 to FR-CO-40): its Owner Unit and the Data Team make, rename, delete
  // and move them, and move its Resources and Lenses between them; who sees the Collection sees them.
  /** The Collection, when the User may manage its folders; else the answer has been sent. */
  async function manageable(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const current = await collections.get(request.params.id, viewer(request));
    if (!current) {
      await reply.code(404).send(NOT_FOUND);
      return undefined;
    }
    if (!current.canManage) {
      await reply.code(403).send({ error: 'forbidden', message: 'Only the Owner Unit and the Data Team manage the folders of this Collection.' });
      return undefined;
    }
    return current;
  }

  function folderAnswer<T>(reply: FastifyReply, outcome: FolderOutcome<T>, code = 200) {
    switch (outcome.outcome) {
      case 'done':
        return outcome.value === undefined ? reply.code(204).send() : reply.code(code).send(outcome.value);
      case 'not_found':
        return reply.code(404).send(NO_FOLDER);
      case 'no_folder':
        return reply.code(404).send({ error: 'not_found', message: 'No such folder in this Collection.' });
      case 'into_itself':
        return reply.code(409).send({ error: 'into_itself', message: 'A folder does not go into itself or into a folder inside it.' });
      case 'not_empty':
        return reply.code(409).send({ error: 'not_empty', message: 'Only an empty folder is deleted; move what it holds out first.', holds: outcome.holds });
    }
  }

  app.post<{ Params: { id: string }; Body: unknown }>('/collections/:id/folders', async (request, reply) => {
    const input = parseFolder(request.body, true);
    if (typeof input === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: input });
    }
    const current = await manageable(request, reply);
    if (!current) return reply;
    return folderAnswer(reply, await collections.makeFolder(current.id, input.name, input.parentId ?? null, viewer(request)), 201);
  });

  app.patch<{ Params: { id: string; folderId: string }; Body: unknown }>('/collections/:id/folders/:folderId', async (request, reply) => {
    const input = parseFolder(request.body, false);
    if (typeof input === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: input });
    }
    const current = await manageable(request, reply);
    if (!current) return reply;
    return folderAnswer(reply, await collections.renameFolder(current.id, request.params.folderId, input.name, viewer(request)));
  });

  app.delete<{ Params: { id: string; folderId: string } }>('/collections/:id/folders/:folderId', async (request, reply) => {
    const current = await manageable(request, reply);
    if (!current) return reply;
    return folderAnswer(reply, await collections.deleteFolder(current.id, request.params.folderId, viewer(request)));
  });

  // Where a Resource, a Lens or a folder sits: in a folder of the Collection, or at its top with null.
  app.put<{ Params: { id: string; kind: string; itemId: string }; Body: unknown }>('/collections/:id/places/:kind/:itemId', async (request, reply) => {
    const { kind, itemId } = request.params;
    if (kind !== 'resource' && kind !== 'lens' && kind !== 'folder') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Move a resource, a lens or a folder.' });
    }
    const to = (request.body as { folderId?: unknown } | null)?.folderId;
    if (to !== null && typeof to !== 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Send the folderId to move it to, or null for the top of the Collection.' });
    }
    const current = await manageable(request, reply);
    if (!current) return reply;
    const item: Movable = { kind, id: itemId };
    return folderAnswer(reply, await collections.move(current.id, item, to, viewer(request)));
  });

  app.get<{ Params: { id: string } }>('/collections/:id/log', async (request, reply) => {
    const current = await collections.get(request.params.id, viewer(request));
    if (!current) {
      return reply.code(404).send(NOT_FOUND);
    }
    return { entries: await collections.log(current, 200) };
  });

  // The Resources of a Collection: all of them for its Owner Unit and the Data Team, and for anyone
  // else who sees the Collection only the published ones, which do not exist yet (TR-SR-05).
  app.get<{ Params: { id: string } }>('/collections/:id/resources', async (request, reply) => {
    const current = await collections.get(request.params.id, viewer(request));
    if (!current) {
      return reply.code(404).send(NOT_FOUND);
    }
    // Its Owner Unit and the Data Team see every Resource in it; others the published ones (FR-SR-31).
    const all = await resources.inCollection(current.id);
    return { resources: current.canManage ? all : all.filter((resource) => resource.published && !resource.withdrawn) };
  });

  // registry hands over every exposed table of one dbt project (TR-SR-01, TR-SR-03). No User starts
  // this, so it takes the Google ID token of registry instead of an Access Token.
  app.post<{ Body: unknown }>(
    '/internal/resources',
    {
      config: { public: true },
      bodyLimit: UPDATE_LIMIT_BYTES,
      // Checked before the body is read, so that no one else can make catalogue read a large one.
      onRequest: async (request, reply) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
        try {
          await serviceCallers.verify(token);
        } catch (error) {
          request.log.warn({ err: error }, 'a call for /internal/resources was refused');
          return reply.code(401).send({ error: 'unauthorized', message: 'Only registry hands over the exposed tables.' });
        }
      },
    },
    async (request, reply) => {
      const update = parseUpdate(request.body);
      if (typeof update === 'string') {
        return reply.code(400).send({ error: 'invalid_request', message: update });
      }
      const outcome = await resources.apply(update);
      request.log.info({ projectId: update.projectId, runId: update.runId, ...outcome }, 'Resources brought in line with the exposures');
      return outcome;
    },
  );

  app.get<{ Querystring: { collection?: string } }>('/resources', async (request, reply) => {
    if (request.query.collection !== 'none') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Ask for the Resources without Collection, with collection=none.' });
    }
    if (!viewer(request).dataTeam) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team sees the Resources without Collection.' });
    }
    return { resources: await resources.withoutCollection() };
  });

  // The Data Team adds Resources without a Collection to a Collection, all of them or none (FR-CO-31).
  app.post<{ Params: { id: string }; Body: unknown }>('/collections/:id/resources', async (request, reply) => {
    const who = viewer(request);
    if (!who.dataTeam) {
      return reply.code(403).send(DATA_TEAM_ONLY);
    }
    const items = parseAdd(request.body);
    if (typeof items === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: items });
    }
    const collection = await collections.get(request.params.id, who);
    if (!collection) {
      return reply.code(404).send(NOT_FOUND);
    }
    return addOutcome(reply, await resources.add(items, collection, who), async () => ({ resources: await resources.inCollection(collection.id) }));
  });

  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/collection', async (request, reply) => {
    const who = viewer(request);
    if (!who.dataTeam) {
      return reply.code(403).send(DATA_TEAM_ONLY);
    }
    const resource = await resources.get(request.params.id);
    if (!resource) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const collectionId = (request.body as { collectionId?: unknown } | null)?.collectionId;
    const collection = typeof collectionId === 'string' ? await collections.get(collectionId, who) : undefined;
    if (!collection) {
      return reply.code(404).send(NOT_FOUND);
    }
    return addOutcome(reply, await resources.add([{ id: resource.id }], collection, who), () => resources.get(resource.id));
  });

  app.delete<{ Params: { id: string } }>('/resources/:id/collection', async (request, reply) => {
    const who = viewer(request);
    if (!who.dataTeam) {
      return reply.code(403).send(DATA_TEAM_ONLY);
    }
    const resource = await resources.get(request.params.id);
    if (!resource) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return (await resources.remove(resource.id, who))
      ? reply.code(204).send()
      : reply.code(409).send({ error: 'not_in_a_collection', message: 'The Resource is in no Collection.' });
  });

  // The Log of a Resource, for whoever sees it: the Data Team, and the Owner Unit of its Collection.
  /**
   * Who sees a Resource (FR-SR-31): the Data Team and the members of the Owner Unit of its Collection,
   * and, once it is published, everyone who sees its Collection. Anyone else gets 404, as for one that
   * does not exist.
   */
  async function seen(request: FastifyRequest, resource: Resource | undefined): Promise<boolean> {
    const who = viewer(request);
    const collection = resource?.collectionId ? await collections.get(resource.collectionId, who) : undefined;
    return resource !== undefined && (who.dataTeam || collection?.canManage === true || (collection !== undefined && resource.published && !resource.withdrawn));
  }

  app.get<{ Params: { id: string } }>('/resources/:id', async (request, reply) => {
    const resource = await resources.detail(request.params.id);
    if (!(await seen(request, resource))) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return { resource };
  });

  app.get<{ Params: { id: string } }>('/resources/:id/log', async (request, reply) => {
    const resource = await resources.get(request.params.id);
    if (!resource || !(await seen(request, resource))) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return { entries: await resources.log(resource.id, 200) };
  });

  /**
   * Who may change what Data Hub keeps about a Resource (FR-RC-15): its Owner Unit and the Data Team,
   * once it is in a Collection; before that it has no Owner, and the rest follows once it has one.
   */
  async function editable(request: FastifyRequest, reply: FastifyReply): Promise<Resource | undefined> {
    const resource = await resources.get((request.params as { id: string }).id);
    if (!resource || !(await seen(request, resource))) {
      reply.code(404).send(NO_RESOURCE);
      return undefined;
    }
    if (resource.collectionId === null) {
      reply.code(409).send({ error: 'no_collection', message: 'A Resource gets what Data Hub keeps about it once it is in a Collection.' });
      return undefined;
    }
    // Seeing a published Resource is not changing it.
    const collection = await collections.get(resource.collectionId, viewer(request));
    if (!collection?.canManage) {
      reply.code(403).send({ error: 'forbidden', message: 'Only the Owner Unit of its Collection and the Data Team change a Resource.' });
      return undefined;
    }
    return resource;
  }

  /** The answer to a change to a Resource: the Resource as it is now, else why it was not changed. */
  async function editOutcome(reply: FastifyReply, id: string, outcome: EditOutcome) {
    switch (outcome.outcome) {
      case 'edited':
        return { resource: await resources.detail(id) };
      case 'not_found':
        return reply.code(404).send(NO_RESOURCE);
      case 'not_described':
        return reply
          .code(409)
          .send({ error: 'not_described', message: 'A Business Description is written once dbt describes the Resource, from 2 · Described on.' });
      case 'invalid':
        return reply.code(400).send({ error: 'invalid_request', message: outcome.message });
    }
  }

  // The Owner and the Data Team edit what Data Hub keeps about a Resource in place (FR-RC-15, FR-SR-28).
  app.patch<{ Params: { id: string }; Body: unknown }>('/resources/:id', async (request, reply) => {
    const changes = parseCard(request.body);
    if (typeof changes === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: changes });
    }
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    return editOutcome(reply, resource.id, await resources.edit(resource.id, changes, viewer(request)));
  });

  // The Business Descriptions of the fields, next to their descriptions from dbt (FR-RC-16).
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/fields', async (request, reply) => {
    const descriptions = parseFieldDescriptions(request.body);
    if (typeof descriptions === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: descriptions });
    }
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    return editOutcome(reply, resource.id, await resources.describeFields(resource.id, descriptions, viewer(request)));
  });

  // A Data Admin changes the grain and mappings with Edit relations, as at step 2 of adding (DEC-UX-107).
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/details', async (request, reply) => {
    if (!viewer(request).dataTeam) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only a Data Admin changes the grain and the mappings of a Resource.' });
    }
    const input = request.body;
    const details = input !== null && typeof input === 'object' && !Array.isArray(input) ? parseDetails(input as Record<string, unknown>) : 'Send the details as a JSON object.';
    if (typeof details === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: details });
    }
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    return editOutcome(reply, resource.id, await resources.relate(resource.id, details, viewer(request)));
  });

  // Each mapping with the Resources that carry the same identity, as far as the User sees them (FR-RC-09).
  app.get<{ Params: { id: string } }>('/resources/:id/related', async (request, reply) => {
    const resource = await resources.get(request.params.id);
    if (!resource || !(await seen(request, resource))) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return { related: await resources.related(resource.id, viewer(request)) };
  });

  // The lineage around a Resource, for everyone who sees it (DEC-AR-06, FR-SR-54): the models up- and
  // downstream with their names, layers and projects, and which of them are Resources the User sees.
  app.get<{ Params: { id: string } }>('/resources/:id/lineage', async (request, reply) => {
    const resource = await resources.get(request.params.id);
    if (!resource || !(await seen(request, resource))) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const [upstream, downstream] = await Promise.all([registry.lineage(resource.nodeId, 'upstream'), registry.lineage(resource.nodeId, 'downstream')]);
    const nodeIds = [...new Set([...(upstream?.nodes ?? []), ...(downstream?.nodes ?? [])].map((node) => node.uniqueId))];
    return {
      nodeId: resource.nodeId,
      upstream: upstream ?? null,
      downstream: downstream ?? null,
      resources: await resources.atNodes(nodeIds, viewer(request)),
    };
  });

  // Only the Owner publishes (FR-SR-16): a member of the Owner Unit of its Collection, from Described on
  // (FR-SR-17). Publishing is the first Confirmation (FR-SR-49).
  app.post<{ Params: { id: string } }>('/resources/:id/publication', async (request, reply) => {
    const resource = await resources.get(request.params.id);
    if (!resource || !(await seen(request, resource))) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const who = viewer(request);
    const collection = resource.collectionId ? await collections.get(resource.collectionId, who) : undefined;
    if (!collection || !who.groups.includes(collection.ownerUnit.id)) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Owner of a Resource publishes it: a member of the Owner Unit of its Collection.' });
    }
    switch (await resources.publish(resource.id, who)) {
      case 'published':
        return { resource: await resources.detail(resource.id) };
      case 'not_found':
        return reply.code(404).send(NO_RESOURCE);
      case 'no_collection':
        return reply.code(409).send({ error: 'no_collection', message: 'A Resource is published from its Collection.' });
      case 'already_published':
        return reply.code(409).send({ error: 'already_published', message: 'It is published already; a Publication cannot be undone.' });
      case 'not_described':
        return reply.code(409).send({ error: 'not_described', message: 'A Resource is published from 2 · Described: dbt describes its table and at least one of its fields.' });
    }
  });

  // The Owner Unit and the Data Team mark the changes since the last Confirmation seen (FR-MR-12).
  app.post<{ Params: { id: string } }>('/resources/:id/changes/seen', async (request, reply) => {
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    await resources.markSeen(resource.id, viewer(request));
    return { resource: await resources.detail(resource.id) };
  });

  // The Owner Unit and the Data Team deprecate a published Resource, and take it away again (FR-SR-50).
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/deprecation', async (request, reply) => {
    const body = (request.body ?? {}) as { reason?: unknown; insteadOf?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 1 || reason.length > 500 || (body.insteadOf !== undefined && body.insteadOf !== null && typeof body.insteadOf !== 'string')) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Say why it is deprecated, in at most 500 characters, and what to use instead, or nothing.' });
    }
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    return deprecationOutcome(reply, resource.id, await resources.deprecate(resource.id, reason, (body.insteadOf as string | null | undefined) ?? null, viewer(request)));
  });

  app.delete<{ Params: { id: string } }>('/resources/:id/deprecation', async (request, reply) => {
    const resource = await editable(request, reply);
    if (!resource) {
      return reply;
    }
    return deprecationOutcome(reply, resource.id, await resources.undeprecate(resource.id, viewer(request)));
  });

  async function deprecationOutcome(reply: FastifyReply, id: string, outcome: DeprecateOutcome) {
    switch (outcome) {
      case 'done':
        return { resource: await resources.detail(id) };
      case 'not_found':
        return reply.code(404).send(NO_RESOURCE);
      case 'not_published':
        return reply.code(409).send({ error: 'not_published', message: 'Only a published Resource is deprecated.' });
      case 'not_deprecated':
        return reply.code(409).send({ error: 'not_deprecated', message: 'It is not deprecated.' });
      case 'invalid':
        return reply.code(400).send({ error: 'invalid_request', message: 'What to use instead is another Resource that is not withdrawn.' });
    }
  }

  // A Request to the Data Team (FR-CV-08), sent by query for its User with their own token: a query that
  // reads more than 1 GB (MSG-QRY-01, DEC-SR-29), or a very large Lens (MSG-LEN-01, FR-LE-09). It waits
  // until the Data Team answers, in the Message Centre; one of the same writer on the same object that still
  // waits is given back instead.
  app.post<{ Body: unknown }>('/requests', async (request, reply) => {
    const fields = parseRequest(request.body);
    if (typeof fields === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: fields });
    }
    const { request: sent, sent: isNew } = await requests.send(fields, viewer(request));
    return reply.code(isNew ? 201 : 200).send({ request: sent });
  });

  // The Requests of the User on queries or Lenses, on one or on all; the Data Team sees everyone's on one.
  app.get<{ Querystring: { subjectKind?: string; subjectId?: string } }>('/requests', async (request, reply) => {
    const { subjectKind, subjectId } = request.query;
    if (subjectKind !== 'query' && subjectKind !== 'lens') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Name the kind of object: subjectKind=query or lens.' });
    }
    if (subjectId !== undefined && !UUID.test(subjectId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A query or a Lens is named by its ID.' });
    }
    const who = viewer(request);
    const everyone = who.dataTeam && subjectId !== undefined;
    return { requests: await requests.list({ subjectKind, subjectId, writerId: everyone ? undefined : who.id }) };
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks a Request to the Data Team: its type, its query and what one run reads above which threshold. */
export function parseRequest(body: unknown): RequestFields | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Send a JSON object.';
  }
  const fields = body as Record<string, unknown>;
  const unknown = Object.keys(fields).find((key) => !['type', 'subjectId', 'subject', 'reads', 'threshold', 'text', 'partitions'].includes(key));
  if (unknown) {
    return `A Request has no field ${unknown}.`;
  }
  if (!REQUEST_TYPES.includes(fields.type as RequestType)) {
    return `The type of a Request is one of ${REQUEST_TYPES.join(', ')}.`;
  }
  if (typeof fields.subjectId !== 'string' || !UUID.test(fields.subjectId)) {
    return 'A query or a Lens is named by its ID.';
  }
  if (typeof fields.subject !== 'string' || fields.subject.trim().length < 1 || fields.subject.trim().length > 120) {
    return 'The name of the query or the Lens has 1 to 120 characters.';
  }
  const size = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  if (!size(fields.reads) || !size(fields.threshold)) {
    return 'What a run reads and the threshold are numbers of bytes.';
  }
  if ((fields.reads as number) <= (fields.threshold as number)) {
    return 'A query or a Lens that reads no more than the threshold needs no Request.';
  }
  if (fields.partitions !== undefined && (typeof fields.partitions !== 'number' || !Number.isSafeInteger(fields.partitions) || fields.partitions < 0)) {
    return 'The partitions one run reads are a count.';
  }
  const text = fields.text ?? '';
  if (typeof text !== 'string' || text.trim().length > 500) {
    return 'A word for the Data Team has at most 500 characters.';
  }
  return {
    type: fields.type as RequestType,
    subjectId: fields.subjectId.toLowerCase(),
    subject: fields.subject.trim(),
    reads: fields.reads as number,
    threshold: fields.threshold as number,
    text: text.trim(),
    ...(fields.partitions === undefined ? {} : { partitions: fields.partitions as number }),
  };
}

const TEXT_LIMITS = { businessDescription: 4000, intendedUse: 2000, pitfalls: 2000 } as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks what changes about a Resource (FR-RC-15): its Business Description, intended use and pitfalls
 * as texts, its Known Gaps as a list of texts, since when it is reliable as a day or null, and its key
 * fields and Parameters as lists of fields. Returns the problem as a sentence when there is one.
 */
export function parseCard(body: unknown): Partial<Card> | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send what changes as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => !(CARD_KEYS as readonly string[]).includes(key));
  if (unknown !== undefined) {
    return `A Resource has no ${unknown} to change.`;
  }
  const card: Partial<Card> = {};
  for (const key of ['businessDescription', 'intendedUse', 'pitfalls'] as const) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' || value.trim().length > TEXT_LIMITS[key]) {
      return `The ${key} is a text of at most ${TEXT_LIMITS[key]} characters.`;
    }
    card[key] = value.trim();
  }
  if (input.knownGaps !== undefined) {
    const gaps = input.knownGaps;
    if (!Array.isArray(gaps) || gaps.length > 20 || !gaps.every((gap) => typeof gap === 'string' && gap.trim().length <= 1000)) {
      return 'The Known Gaps are a list of at most 20 texts of at most 1000 characters.';
    }
    card.knownGaps = (gaps as string[]).map((gap) => gap.trim()).filter(Boolean);
  }
  if (input.reliableSince !== undefined) {
    const day = input.reliableSince;
    if (day !== null && !(typeof day === 'string' && DAY.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().startsWith(day))) {
      return 'Since when it is reliable is a day, as YYYY-MM-DD, or null.';
    }
    card.reliableSince = day as string | null;
  }
  for (const key of ['keyFields', 'parameters'] as const) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value) || value.length > 50 || !value.every((name) => NAME(name)) || new Set(value).size !== value.length) {
      return `The ${key} are a list of at most 50 different fields.`;
    }
    card[key] = value as string[];
  }
  if (Object.keys(card).length === 0) {
    return 'Send at least one thing to change.';
  }
  return card;
}

/**
 * Checks the Business Descriptions of fields to write (FR-RC-16): each field once, with a text of at
 * most 2000 characters; an empty text removes it. Returns the problem as a sentence when there is one.
 */
export function parseFieldDescriptions(body: unknown): { field: string; text: string }[] | string {
  const list = (body as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(list) || list.length === 0 || list.length > 1000) {
    return 'Send the fields as a list of 1 to 1000.';
  }
  const entries: { field: string; text: string }[] = [];
  for (const raw of list as unknown[]) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!NAME(entry.name) || typeof entry.businessDescription !== 'string' || entry.businessDescription.trim().length > 2000) {
      return 'Each field has its name and a Business Description of at most 2000 characters.';
    }
    entries.push({ field: entry.name, text: entry.businessDescription.trim() });
  }
  if (new Set(entries.map((entry) => entry.field)).size !== entries.length) {
    return 'Name each field once.';
  }
  return entries;
}

/** Checks what registry sends (TR-AR-08); returns the problem as a sentence when there is one. */
export function parseUpdate(body: unknown): ResourcesUpdate | string {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
  if (!text(input.projectId, 20) || !/^\d+$/.test(input.projectId as string) || !text(input.runId, 20) || !/^\d+$/.test(input.runId as string)) {
    return 'A dbt project and a run are named by their numeric IDs.';
  }
  if (input.projectName !== null && !text(input.projectName, 1000)) {
    return 'The name of the dbt project is a text, or null.';
  }
  if (input.generatedAt !== null && !(text(input.generatedAt, 40) && !Number.isNaN(Date.parse(input.generatedAt as string)))) {
    return 'When dbt made the manifest is a moment in ISO 8601, or null.';
  }
  if (!Array.isArray(input.tables)) {
    return 'The exposed tables come as a list.';
  }
  for (const table of input.tables as Record<string, unknown>[]) {
    const fits =
      table !== null &&
      typeof table === 'object' &&
      text(table.key, 1024) &&
      (table.fullName === undefined || text(table.fullName, 1024)) &&
      text(table.nodeId, 1024) &&
      text(table.name, 1024) &&
      text(table.resourceType, 100) &&
      typeof table.description === 'string' &&
      Array.isArray(table.exposures) &&
      (table.exposures as unknown[]).every((name) => text(name, 1024)) &&
      (table.label === null || text(table.label, 1000)) &&
      (table.checksum === null || text(table.checksum, 200)) &&
      Array.isArray(table.columns) &&
      (table.columns as Record<string, unknown>[]).every(
        (column) =>
          column !== null &&
          typeof column === 'object' &&
          text(column.name, 1024) &&
          (column.position === null || Number.isInteger(column.position)) &&
          (column.dataType === null || text(column.dataType, 4096)) &&
          typeof column.description === 'string',
      );
    if (!fits) {
      return 'Every exposed table has a key, a Node, a name, a kind, a description, its exposures, a label or null, a checksum or null, and its columns.';
    }
  }
  return input as unknown as ResourcesUpdate;
}

/**
 * Checks the fields of a Collection in a request: all of name, description, icon and Owner Unit to
 * create one (visibility is private unless given), and at least one field to change one. A
 * Collection has no colour (DEC-CO-23), and its icon cannot be taken away (DEC-CO-25). Returns the
 * problem as a sentence when there is one.
 */
export function parse(body: unknown, creating: boolean): Fields | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send the fields of the Collection as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const known = new Set(['name', 'description', 'icon', 'visibility', 'ownerUnit', 'intro']);
  const unknown = Object.keys(input).find((key) => !known.has(key));
  if (unknown !== undefined) {
    return `A Collection has no field ${unknown}.`;
  }
  const fields: Fields = {};
  const text = (key: 'name' | 'description', max: number): string | undefined => {
    const value = input[key];
    if (value === undefined) {
      return undefined;
    }
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length < 1 || trimmed.length > max) {
      return `The ${key} has 1 to ${max} characters.`;
    }
    fields[key] = trimmed;
    return undefined;
  };
  const problem = text('name', 80) ?? text('description', 500);
  if (problem) {
    return problem;
  }
  if (input.icon !== undefined) {
    if (!isCollectionIcon(input.icon)) {
      return 'The icon is the name of an icon of Phosphor that is not the logo of a brand.';
    }
    fields.icon = input.icon;
  }
  if (input.visibility !== undefined) {
    if (input.visibility !== 'private' && input.visibility !== 'public') {
      return 'The visibility is private or public.';
    }
    fields.visibility = input.visibility;
  }
  if (input.ownerUnit !== undefined) {
    if (typeof input.ownerUnit !== 'string' || !/^[\w-]{1,128}$/.test(input.ownerUnit)) {
      return 'The Owner Unit is named by the ID of a group.';
    }
    fields.ownerUnit = input.ownerUnit;
  }
  if (input.intro !== undefined) {
    // Markdown, kept as written but for the white space at its ends; empty for none (FR-CO-41).
    if (typeof input.intro !== 'string' || input.intro.length > INTRO_LIMIT) {
      return `The intro is Markdown of at most ${INTRO_LIMIT} characters.`;
    }
    fields.intro = input.intro.trim();
  }
  if (creating) {
    const missing = (['name', 'description', 'icon', 'ownerUnit'] as const).find((key) => fields[key] === undefined);
    if (missing) {
      return `A new Collection needs ${missing === 'ownerUnit' ? 'an Owner Unit' : missing === 'icon' ? 'an icon' : `a ${missing}`}.`;
    }
  } else if (Object.keys(fields).length === 0) {
    return 'Send at least one field to change.';
  }
  return fields;
}

/** The name of a folder, and for a new one the folder it goes in, if any (FR-CO-39). */
export function parseFolder(body: unknown, creating: boolean): { name: string; parentId?: string | null } | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send the folder as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => key !== 'name' && !(creating && key === 'parentId'));
  if (unknown !== undefined) {
    return `A folder has no field ${unknown}${creating ? '' : ' to change'}.`;
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > 80) {
    return 'The name of a folder has 1 to 80 characters.';
  }
  if (input.parentId !== undefined && input.parentId !== null && typeof input.parentId !== 'string') {
    return 'The parentId is the ID of a folder of the Collection, or null for its top.';
  }
  return { name, ...(creating ? { parentId: (input.parentId as string | null | undefined) ?? null } : {}) };
}

const UNITS = ['hour', 'day', 'month', 'year'] as const;
const FILTERS = ['none', 'dataHub', 'bigQuery'] as const;
const KINDS = ['is', 'relation', 'performedBy'] as const;
const MAPPING_ORIGINS = ['domainModel', 'name', 'here'] as const;
const ORIGINS = ['dbt', 'test', 'domainModel', 'here'] as const;
const ORIGIN_KEYS = ['partition', 'clusterBy', 'partitionFilter', 'grain', 'grainSentence', 'modelType'] as const;
const IDENTITY = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;
const NAME = (value: unknown, max = 1024): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const one = <T extends string>(values: readonly T[], value: unknown): value is T => values.includes(value as T);

/**
 * Checks the Resources to add (FR-CO-31): each by its ID, or as an object with its ID and what the Data
 * Admin recorded for it at step 2 (FR-CO-33, FR-CO-34). Whether the fields exist is checked when it is
 * added. Returns the problem as a sentence when there is one.
 */
export function parseAdd(body: unknown): AddItem[] | string {
  const list = (body as { resources?: unknown } | null)?.resources;
  if (!Array.isArray(list) || list.length === 0 || list.length > ADD_LIMIT) {
    return `Send the Resources to add as a list of 1 to ${ADD_LIMIT}.`;
  }
  const items: AddItem[] = [];
  for (const entry of list as unknown[]) {
    if (typeof entry === 'string') {
      items.push({ id: entry });
      continue;
    }
    const input = (entry ?? {}) as Record<string, unknown>;
    if (!NAME(input.id, 64)) {
      return 'Each Resource to add has its ID.';
    }
    const details = parseDetails(input);
    if (typeof details === 'string') {
      return details;
    }
    items.push({ id: input.id, details });
  }
  return items;
}

function parseDetails(input: Record<string, unknown>): Details | string {
  const names = (value: unknown, max: number) => Array.isArray(value) && value.length <= max && value.every((name) => NAME(name));
  const partition = input.partition as Record<string, unknown> | null | undefined;
  if (partition !== null && !(typeof partition === 'object' && partition !== undefined && NAME(partition.field) && (partition.unit === null || one(UNITS, partition.unit)))) {
    return 'The partition is null, or a field with its unit: hour, day, month, year or null.';
  }
  if (!names(input.clusterBy, 4)) {
    return 'A Resource is clustered by at most four fields.';
  }
  if (!one(FILTERS, input.partitionFilter) || (input.partitionFilter !== 'none' && partition === null)) {
    return 'A partition filter is none, dataHub or bigQuery, and needs a partition.';
  }
  if (!names(input.grain, 20) || typeof input.grainSentence !== 'string' || input.grainSentence.length > 200) {
    return 'The grain is a list of fields, with a sentence of at most 200 characters.';
  }
  if (input.modelType !== null && !one(MODEL_TYPES, input.modelType)) {
    return `The model type is one of ${MODEL_TYPES.join(', ')}, or null.`;
  }
  const origins = (input.origins ?? {}) as Record<string, unknown>;
  if (typeof origins !== 'object' || Array.isArray(origins) || !Object.entries(origins).every(([key, value]) => one(ORIGIN_KEYS, key) && one(ORIGINS, value))) {
    return 'The origins name where the partition, cluster, filter, grain, sentence and model type come from.';
  }
  if (input.release !== null && !NAME(input.release, 40)) {
    return 'The release of the Domain Model is a version, or null.';
  }
  if (!Array.isArray(input.mappings) || input.mappings.length > 1000) {
    return 'The mappings come as a list.';
  }
  const mappings: Mapping[] = [];
  for (const raw of input.mappings as Record<string, unknown>[]) {
    const mapping = raw ?? {};
    const fits =
      NAME(mapping.field) &&
      one(KINDS, mapping.kind) &&
      (mapping.kind === 'relation' ? NAME(mapping.relationType, 64) && /^[a-z][A-Za-z]*$/.test(mapping.relationType as string) : mapping.relationType === null) &&
      typeof mapping.identity === 'string' &&
      IDENTITY.test(mapping.identity) &&
      (mapping.subject === null || NAME(mapping.subject)) &&
      one(MAPPING_ORIGINS, mapping.origin) &&
      typeof mapping.inDomainModel === 'boolean';
    if (!fits) {
      return 'Each mapping has a field, is, a relation type or performedBy, an identity as entity.identifier, a subject or null, its origin, and whether the Domain Model has it.';
    }
    mappings.push({
      field: mapping.field as string,
      kind: mapping.kind as Mapping['kind'],
      relationType: (mapping.relationType as string | null) ?? null,
      identity: mapping.identity as string,
      subject: (mapping.subject as string | null) ?? null,
      origin: mapping.origin as Mapping['origin'],
      inDomainModel: mapping.inDomainModel as boolean,
    });
  }
  return {
    partition: partition ? { field: partition.field as string, unit: partition.unit as PartitionUnit | null } : null,
    clusterBy: input.clusterBy as string[],
    partitionFilter: input.partitionFilter,
    grain: input.grain as string[],
    grainSentence: (input.grainSentence as string).trim(),
    modelType: input.modelType as ModelType | null,
    origins: origins as Origins,
    release: (input.release as string | null) ?? null,
    mappings,
  };
}
