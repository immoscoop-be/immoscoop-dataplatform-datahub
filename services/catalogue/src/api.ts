import type { ServiceCallerVerifier } from '@datahub/auth';
import { canWith, type CollectionIcon, type CollectionVisibility, NO_PERMISSIONS, permissionValue, reach } from '@datahub/contracts';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';
import { type GapScope, gapScopeSchema } from '@datahub/contracts/gaps';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type Collection, type CollectionChanges, type Collections, type FolderOutcome, type Movable, NameTaken, NotEmpty, type Viewer } from './collections.js';
import { type Group, type Identity, IdentityUnavailable } from './identity.js';
import { learningRoutes } from './learning-api.js';
import type { Learning } from './learning.js';
import { messageRoutes } from './message-api.js';
import type { Messages } from './messages.js';
import { MODEL_TYPES, type ModelType, type Origins, type PartitionUnit } from './database.js';
import type { QueryService } from './query.js';
import { type Registry, RegistryUnavailable } from './registry.js';
import { REQUEST_TYPES, type RequestFields, type Requests, type RequestType } from './requests.js';
import {
  type AddItem,
  type AddOutcome,
  CARD_KEYS,
  type CardKey,
  type CardChanges,
  MAX_GAPS,
  type DeprecateOutcome,
  type Details,
  type EditOutcome,
  type GapOutcome,
  type Mapping,
  type Resource,
  type Resources,
  type ResourcesUpdate,
  whatDetailsChange,
} from './resources.js';
import { type Attribute, describable, describes, forbidden, may, reaches, seesAll, seesInside, theirs } from './viewer.js';

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
  /** identity, which tells about an Excel key (FR-PL-03). */
  keyCallers?: ServiceCallerVerifier;
  /** The progress of every User in the Learning Centre (FR-LR-32). */
  learning: Learning;
  /** query, to check what reads the Resources a new Current Version changed (FR-SR-52); absent, nothing is checked then. */
  query?: QueryService;
}

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
const ASSIGN_ONLY = forbidden('resources.assign', 'Only a Data Admin adds Resources to Collections and moves them.');
const REMOVE_ONLY = forbidden('resources.remove', 'You may not take this Resource out of its Collection.');
const REMOVE_PUBLISHED = forbidden(
  'resources.remove',
  'It is published: colleagues may rely on it, so only the Data Team takes it out of its Collection now. Before it is published, its Owner Unit can.',
);

/**
 * Whether the User may take a Resource out of its Collection (DEC-PL-08, FR-CO-43): with `resources.remove` for every
 * Resource, published or not; for those of their Owner Units, only while it is not published.
 */
function removable(who: Viewer, published: boolean, ownerUnit: string | null): boolean {
  const how = reach(who.permissions, 'resources.remove');
  return how === 'every' || (how === 'theirs' && !published && theirs(who, ownerUnit));
}

/** A refusal for want of a Permission, as a route answers it (TR-PL-06): for an attribute of a Resource, with that attribute. */
type Refusal = ReturnType<typeof forbidden> & { attribute?: Attribute };

/** How the refusal of an attribute names it (DEC-PL-03). */
const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  description: 'Business Description',
  behaviour: 'intended use',
  pitfalls: 'pitfalls',
  availableSince: 'available since',
  gaps: 'Known Gaps',
  keyFields: 'key fields and Parameters',
  entityMapping: 'Entity mapping',
};

/** The refusal to describe an attribute of a Resource, with the attribute it names (DEC-PL-03). */
const notDescribed = (attribute: Attribute): Refusal => ({
  ...forbidden('resources.describe', `You may not change the ${ATTRIBUTE_NAMES[attribute]} of this Resource.`),
  attribute,
});

/** The attribute each field of the Resource Card belongs to (DEC-PL-03). */
const CARD_ATTRIBUTES: Record<CardKey, Attribute> = {
  businessDescription: 'description',
  intendedUse: 'behaviour',
  pitfalls: 'pitfalls',
  knownGaps: 'gaps',
  reliableSince: 'availableSince',
  keyFields: 'keyFields',
  parameters: 'keyFields',
};

/** A project with thousands of exposed tables, with their descriptions, fits well within this. */
const UPDATE_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * The routes of Collections (TR-CO-02). Who may do what follows their Permissions (TR-PL-06): with
 * `collections.make` a User creates one; whoever sees a Collection reads it and its Log; with
 * `collections.manage` they change and dissolve theirs, or every one. A Collection someone does not
 * see answers 404, as one that does not exist (FR-CO-17); what they may not do, 403 with the
 * Permission it needs.
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { collections, identity, resources, serviceCallers, registry, requests, messages, lensCallers, keyCallers, learning } = options;

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof NameTaken) {
      return reply.code(409).send({ error: 'name_taken', message: error.message });
    }
    if (error instanceof NotEmpty) {
      return reply.code(409).send({ error: 'not_empty', message: error.message });
    }
    if (error instanceof NotYourGroup) {
      return reply.code(400).send({ error: 'not_your_group', message: 'Choose a group you are in yourself as Owner Unit, or any group of the domain when your Permission group allows it.' });
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
    return { id: user?.sub ?? '', name: user?.name || user?.email || '', groups: user?.groups ?? [], permissions: user?.permissions ?? NO_PERMISSIONS };
  }

  /**
   * The Owner Unit chosen by the User, read from identity with their own token (TR-CO-03): one of
   * their own groups, or any group of the domain when `collections.make` says any (FR-CO-35). Reading
   * it again also brings its name and address up to date.
   */
  async function ownGroup(request: FastifyRequest, id: string): Promise<Group> {
    const authorization = request.headers.authorization ?? '';
    const who = viewer(request);
    const anyGroup = may(who, 'collections.make') && permissionValue(who.permissions, 'collections.make', 'ownerUnit') === 'any';
    const groups = anyGroup ? await identity.domainGroups(authorization) : await identity.groups(authorization);
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

  await messageRoutes(app, { collections, messages, lensCallers, keyCallers, viewer });
  await learningRoutes(app, { learning, viewer });

  app.get('/collections', async (request) => ({ collections: await collections.list(viewer(request)) }));

  // The Collections of an Owner Unit the User sees, for the page of a Group (FR-UM-18, TR-UM-05).
  app.get<{ Params: { id: string } }>('/owner-units/:id/collections', async (request) => ({
    collections: (await collections.list(viewer(request)))
      .filter((collection) => collection.ownerUnit.id === request.params.id)
      .map((collection) => ({ id: collection.id, name: collection.name, icon: collection.icon, visibility: collection.visibility })),
  }));

  // identity asks what a Group owns before it deletes it, with its Google ID token for catalogue's address (TR-UM-05).
  if (keyCallers) {
    app.get<{ Params: { id: string } }>(
      '/internal/owner-units/:id',
      {
        config: { public: true },
        onRequest: async (request, reply) => {
          const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
          try {
            await keyCallers.verify(token);
          } catch (error) {
            request.log.warn({ err: error }, 'a call for what a group owns was refused');
            return reply.code(401).send({ error: 'unauthorized', message: 'Only identity asks what a group owns.' });
          }
        },
      },
      async (request) => collections.ownedBy(request.params.id),
    );
  }

  // The search of the start screen of Collections (FR-CO-37, DEC-UX-127): the Collections and Resources the
  // User sees that share words with a question; query finds the Lenses.
  app.get<{ Querystring: { question?: string } }>('/search', async (request, reply) => {
    const question = (request.query.question ?? '').trim();
    if (question.length > 500) return reply.code(400).send({ error: 'invalid_request', message: 'The question has at most 500 characters.' });
    return collections.search(question, viewer(request));
  });

  app.post<{ Body: unknown }>('/collections', async (request, reply) => {
    if (!may(viewer(request), 'collections.make')) {
      return reply.code(403).send(forbidden('collections.make', 'You may not make a Collection.'));
    }
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
      return reply.code(403).send(forbidden('collections.manage', 'You may not change this Collection.'));
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
      return reply.code(403).send(forbidden('collections.manage', 'You may not dissolve this Collection.'));
    }
    return (await collections.dissolve(current.id, who)) ? reply.code(204).send() : reply.code(404).send(NOT_FOUND);
  });

  // The folders of a Collection (FR-CO-38 to FR-CO-40): with `collections.manage` a User makes, renames, deletes
  // and moves them, and moves its Resources and Lenses between them; who sees the Collection sees them.
  /** The Collection, when the User may manage its folders; else the answer has been sent. */
  async function manageable(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const current = await collections.get(request.params.id, viewer(request));
    if (!current) {
      await reply.code(404).send(NOT_FOUND);
      return undefined;
    }
    if (!current.canManage) {
      await reply.code(403).send(forbidden('collections.manage', 'You may not manage the folders of this Collection.'));
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
    return folderAnswer(reply, await collections.makeFolder(current.id, input.name!, input.parentId ?? null, viewer(request), input.description), 201);
  });

  app.patch<{ Params: { id: string; folderId: string }; Body: unknown }>('/collections/:id/folders/:folderId', async (request, reply) => {
    const input = parseFolder(request.body, false);
    if (typeof input === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: input });
    }
    const current = await manageable(request, reply);
    if (!current) return reply;
    return folderAnswer(reply, await collections.changeFolder(current.id, request.params.folderId, input, viewer(request)));
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
    return { entries: await collections.log(current, viewer(request), 200) };
  });

  // The Resources of a Collection: all of them for its Owner Unit and whoever sees all, and for anyone
  // else who sees the Collection only the published ones (TR-SR-05, FR-SR-31, DEC-PL-02).
  app.get<{ Params: { id: string } }>('/collections/:id/resources', async (request, reply) => {
    const who = viewer(request);
    const current = await collections.get(request.params.id, who);
    if (!current) {
      return reply.code(404).send(NOT_FOUND);
    }
    const all = await resources.inCollection(current.id);
    return { resources: seesInside(who, current.ownerUnit.id) ? all : all.filter((resource) => resource.published && !resource.withdrawn) };
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
      // What reads a Resource that was withdrawn, came back or lost or regained a field is checked now (FR-SR-52);
      // if query does not answer, its daily check finds the same within a day.
      if (outcome.changed.length > 0 && options.query) {
        try {
          await options.query.check(outcome.changed);
        } catch (error) {
          request.log.warn({ err: error, resources: outcome.changed.length }, 'query could not check what reads the Resources that changed; its daily check will');
        }
      }
      return outcome;
    },
  );

  app.get<{ Querystring: { collection?: string } }>('/resources', async (request, reply) => {
    if (request.query.collection !== 'none') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Ask for the Resources without Collection, with collection=none.' });
    }
    // Only who sees all of the catalogue sees the Resources without a Collection (DEC-PL-02).
    if (!seesAll(viewer(request))) {
      return reply.code(403).send(forbidden('catalogue.see', 'Only who sees all of the catalogue sees the Resources without a Collection.'));
    }
    return { resources: await resources.withoutCollection() };
  });

  // A Data Admin, with `resources.assign`, adds Resources without a Collection to a Collection, all of them or none (FR-CO-31).
  app.post<{ Params: { id: string }; Body: unknown }>('/collections/:id/resources', async (request, reply) => {
    const who = viewer(request);
    if (!may(who, 'resources.assign')) {
      return reply.code(403).send(ASSIGN_ONLY);
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
    if (!may(who, 'resources.assign')) {
      return reply.code(403).send(ASSIGN_ONLY);
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

  // With `resources.remove`, a User takes a Resource out of its Collection: every one, or one of their Owner Units
  // while it is not published (DEC-PL-08, FR-CO-43).
  app.delete<{ Params: { id: string } }>('/resources/:id/collection', async (request, reply) => {
    const who = viewer(request);
    if (!may(who, 'resources.remove')) {
      return reply.code(403).send(REMOVE_ONLY);
    }
    const resource = await resources.get(request.params.id);
    if (!resource) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const collection = resource.collectionId ? await collections.get(resource.collectionId, who) : undefined;
    if (resource.collectionId && !removable(who, resource.published, collection?.ownerUnit.id ?? null)) {
      return reply.code(403).send(reach(who.permissions, 'resources.remove') === 'theirs' && resource.published && collection?.owned ? REMOVE_PUBLISHED : REMOVE_ONLY);
    }
    return (await resources.remove(resource.id, who))
      ? reply.code(204).send()
      : reply.code(409).send({ error: 'not_in_a_collection', message: 'The Resource is in no Collection.' });
  });

  // Every Resource that dbt withdrew, for whoever opens the tool Withdrawn of Admin (FR-SR-55, DEC-UX-213).
  app.get('/withdrawn', async (request, reply) => {
    if (!canWith(viewer(request).permissions, 'admin.open', 'tools', 'withdrawn')) {
      return reply.code(403).send(forbidden('admin.open', 'Only who may open Withdrawn in Admin sees every withdrawn Resource.'));
    }
    return { resources: await resources.withdrawnList() };
  });

  /** A Resource the User sees, with its Collection as they see it: none for a Resource without one. */
  interface Seen {
    resource: Resource;
    collection: Collection | undefined;
  }

  /**
   * Who sees a Resource (FR-SR-31, DEC-PL-02): the members of the Owner Unit of its Collection, and once it is
   * published, everyone who sees its Collection; who sees all sees every one, also without a Collection and
   * withdrawn. Anyone else gets 404, as for one that does not exist.
   */
  async function seenResource(request: FastifyRequest, id: string): Promise<Seen | undefined> {
    const resource = await resources.get(id);
    if (!resource) {
      return undefined;
    }
    const who = viewer(request);
    const collection = resource.collectionId ? await collections.get(resource.collectionId, who) : undefined;
    const sees = seesAll(who) || (collection !== undefined && (collection.owned || (resource.published && !resource.withdrawn)));
    return sees ? { resource, collection } : undefined;
  }

  /**
   * What the User may do with a Resource, from their Permissions and the Owner Unit of its Collection, as the web app
   * shows it (TR-PL-06): each attribute they may describe (DEC-PL-03), any of them as `canEdit`, publishing as its Owner
   * (DEC-PL-06), deprecating, taking it out of its Collection (DEC-PL-08), and the work of a Data Admin. Without a
   * Collection, a Resource has nothing to describe yet.
   */
  function abilities(who: Viewer, collection: Collection | undefined, published: boolean) {
    const ownerUnit = collection?.ownerUnit.id ?? null;
    const canDescribe = describable(who, ownerUnit);
    return {
      canEdit: ownerUnit !== null && Object.values(canDescribe).some(Boolean),
      canDescribe,
      canPublish: ownerUnit !== null && may(who, 'resources.publish') && theirs(who, ownerUnit),
      canDeprecate: ownerUnit !== null && reaches(who, 'resources.deprecate', ownerUnit),
      canAssign: may(who, 'resources.assign'),
      canRemove: ownerUnit !== null && removable(who, published, ownerUnit),
    };
  }

  /**
   * The Resource as it is now, with its fields and what the User may do with it, as an answer; 404 when it is gone
   * meanwhile. Its Collection, as the User saw it a moment ago, still says whose it is.
   */
  async function resourceAnswer(request: FastifyRequest, reply: FastifyReply, found: Seen) {
    const detail = await resources.detail(found.resource.id);
    if (!detail) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const who = viewer(request);
    const collection = detail.collectionId === found.resource.collectionId ? found.collection : detail.collectionId ? await collections.get(detail.collectionId, who) : undefined;
    return { resource: { ...detail, ...abilities(who, collection, detail.published) } };
  }

  app.get<{ Params: { id: string } }>('/resources/:id', async (request, reply) => {
    const found = await seenResource(request, request.params.id);
    if (!found) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return resourceAnswer(request, reply, found);
  });

  // The Log of a Resource, for whoever sees it.
  app.get<{ Params: { id: string } }>('/resources/:id/log', async (request, reply) => {
    const found = await seenResource(request, request.params.id);
    if (!found) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return { entries: await resources.log(found.resource.id, 200) };
  });

  /**
   * A Resource the User may change as asked (FR-RC-15, TR-PL-06): one they see, in a Collection, and a check of the
   * Permission that covers the change, with the Owner Unit of its Collection; else the answer is sent. Before it is in
   * a Collection it has no Owner, and the rest follows once it has one. Seeing a published Resource is not changing it.
   */
  async function changeable(
    request: FastifyRequest,
    reply: FastifyReply,
    refusal: (who: Viewer, ownerUnit: string) => Refusal | null,
  ): Promise<(Seen & { collection: Collection }) | undefined> {
    const found = await seenResource(request, (request.params as { id: string }).id);
    if (!found) {
      reply.code(404).send(NO_RESOURCE);
      return undefined;
    }
    if (!found.collection) {
      reply.code(409).send({ error: 'no_collection', message: 'A Resource gets what Data Hub keeps about it once it is in a Collection.' });
      return undefined;
    }
    const refused = refusal(viewer(request), found.collection.ownerUnit.id);
    if (refused) {
      reply.code(403).send(refused);
      return undefined;
    }
    return { resource: found.resource, collection: found.collection };
  }

  /** The check that the User may describe an attribute of the Resource (DEC-PL-03). */
  const describing =
    (attribute: Attribute) =>
    (who: Viewer, ownerUnit: string): Refusal | null =>
      describes(who, ownerUnit, attribute) ? null : notDescribed(attribute);

  /** The answer to a change to a Resource: the Resource as it is now, else why it was not changed. */
  async function editOutcome(request: FastifyRequest, reply: FastifyReply, found: Seen, outcome: EditOutcome) {
    switch (outcome.outcome) {
      case 'edited':
        return resourceAnswer(request, reply, found);
      case 'not_found':
        return reply.code(404).send(NO_RESOURCE);
      case 'not_described':
        return reply
          .code(409)
          .send({ error: 'not_described', message: 'A Business Description is written once dbt describes the Resource, from 2 · Described on.' });
      case 'invalid':
        return reply.code(400).send({ error: 'invalid_request', message: outcome.message });
      case 'forbidden':
        return reply.code(403).send(notDescribed(CARD_ATTRIBUTES[outcome.field]));
    }
  }

  // Who may describe a Resource edits what Data Hub keeps about it in place, attribute by attribute (FR-RC-15,
  // FR-SR-28, DEC-PL-03): each field that changes needs its attribute; one sent as it is changes nothing.
  app.patch<{ Params: { id: string }; Body: unknown }>('/resources/:id', async (request, reply) => {
    const changes = parseCard(request.body);
    if (typeof changes === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: changes });
    }
    // Who may describe none of what is sent may change nothing of it.
    const sent = [...new Set((Object.keys(changes) as (keyof typeof changes)[]).map((key) => CARD_ATTRIBUTES[key]))];
    const found = await changeable(request, reply, (who, ownerUnit) => {
      const refused = sent.find((attribute) => !describes(who, ownerUnit, attribute));
      return refused && !sent.some((attribute) => describes(who, ownerUnit, attribute)) ? notDescribed(refused) : null;
    });
    if (!found) {
      return reply;
    }
    const who = viewer(request);
    const ownerUnit = found.collection.ownerUnit.id;
    return editOutcome(request, reply, found, await resources.edit(found.resource.id, changes, who, (key) => describes(who, ownerUnit, CARD_ATTRIBUTES[key])));
  });

  /** What adding, changing or removing a Known Gap came to, as an answer. */
  function gapOutcome(reply: FastifyReply, outcome: GapOutcome, created = false) {
    switch (outcome.outcome) {
      case 'done':
        return outcome.gap ? reply.code(created ? 201 : 200).send({ gap: outcome.gap }) : reply.code(204).send();
      case 'not_found':
        return reply.code(404).send({ error: 'not_found', message: 'No such Resource or Known Gap.' });
      case 'invalid':
        return reply.code(400).send({ error: 'invalid_request', message: outcome.message });
    }
  }

  // The Known Gaps one at a time, each with who added it and when, for who may describe them (FR-RC-21, DEC-PL-03).
  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/gaps', async (request, reply) => {
    const gap = parseGap(request.body);
    if (typeof gap === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: gap });
    }
    const found = await changeable(request, reply, describing('gaps'));
    if (!found) {
      return reply;
    }
    return gapOutcome(reply, await resources.addGap(found.resource.id, gap.text, gap.scope ?? null, viewer(request)), true);
  });

  app.patch<{ Params: { id: string; gapId: string }; Body: unknown }>('/resources/:id/gaps/:gapId', async (request, reply) => {
    const gap = parseGap(request.body);
    if (typeof gap === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: gap });
    }
    const found = await changeable(request, reply, describing('gaps'));
    if (!found) {
      return reply;
    }
    return gapOutcome(reply, await resources.changeGap(found.resource.id, request.params.gapId, gap.text, gap.scope, viewer(request)));
  });

  app.delete<{ Params: { id: string; gapId: string } }>('/resources/:id/gaps/:gapId', async (request, reply) => {
    const found = await changeable(request, reply, describing('gaps'));
    if (!found) {
      return reply;
    }
    return gapOutcome(reply, await resources.removeGap(found.resource.id, request.params.gapId, viewer(request)));
  });

  // The Business Descriptions of the fields, next to their descriptions from dbt (FR-RC-16): the attribute description.
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/fields', async (request, reply) => {
    const descriptions = parseFieldDescriptions(request.body);
    if (typeof descriptions === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: descriptions });
    }
    const found = await changeable(request, reply, describing('description'));
    if (!found) {
      return reply;
    }
    return editOutcome(request, reply, found, await resources.describeFields(found.resource.id, descriptions, viewer(request)));
  });

  // Edit relations, as at step 2 of adding (DEC-UX-107): the grain, storage and model type are the work of a Data Admin
  // (`resources.assign`); the mappings are the Entity mapping, an attribute to describe (DEC-PL-03). Each part that
  // changes needs its own Permission.
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/details', async (request, reply) => {
    const input = request.body;
    const details = input !== null && typeof input === 'object' && !Array.isArray(input) ? parseDetails(input as Record<string, unknown>) : 'Send the details as a JSON object.';
    if (typeof details === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: details });
    }
    const assigning = forbidden('resources.assign', 'Only a Data Admin changes the grain, storage and model type of a Resource.');
    const found = await changeable(request, reply, (who, ownerUnit) => (may(who, 'resources.assign') || describes(who, ownerUnit, 'entityMapping') ? null : assigning));
    if (!found) {
      return reply;
    }
    const before = await resources.detail(found.resource.id);
    if (!before) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const who = viewer(request);
    const { assigned, mapped } = whatDetailsChange(before.details, details);
    if (assigned && !may(who, 'resources.assign')) {
      return reply.code(403).send(assigning);
    }
    if (mapped && !describes(who, found.collection.ownerUnit.id, 'entityMapping')) {
      return reply.code(403).send(notDescribed('entityMapping'));
    }
    return editOutcome(request, reply, found, await resources.relate(found.resource.id, details, who));
  });

  // Each mapping with the Resources that carry the same identity, as far as the User sees them (FR-RC-09).
  app.get<{ Params: { id: string } }>('/resources/:id/related', async (request, reply) => {
    const found = await seenResource(request, request.params.id);
    if (!found) {
      return reply.code(404).send(NO_RESOURCE);
    }
    return { related: await resources.related(found.resource.id, viewer(request)) };
  });

  // The lineage around a Resource, for everyone who sees it (DEC-AR-06, FR-SR-54): the models up- and
  // downstream with their names, layers and projects, and which of them are Resources the User sees.
  app.get<{ Params: { id: string } }>('/resources/:id/lineage', async (request, reply) => {
    const found = await seenResource(request, request.params.id);
    if (!found) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const { resource } = found;
    const [upstream, downstream] = await Promise.all([registry.lineage(resource.nodeId, 'upstream'), registry.lineage(resource.nodeId, 'downstream')]);
    const nodeIds = [...new Set([...(upstream?.nodes ?? []), ...(downstream?.nodes ?? [])].map((node) => node.uniqueId))];
    return {
      nodeId: resource.nodeId,
      upstream: upstream ?? null,
      downstream: downstream ?? null,
      resources: await resources.atNodes(nodeIds, viewer(request)),
    };
  });

  // Only the Owner publishes (FR-SR-16, DEC-PL-06): a member of the Owner Unit of its Collection, with `resources.publish`,
  // in their own name, also in the Permission group Admin; from Described on (FR-SR-17). Publishing is the first
  // Confirmation (FR-SR-49).
  app.post<{ Params: { id: string } }>('/resources/:id/publication', async (request, reply) => {
    const found = await seenResource(request, request.params.id);
    if (!found) {
      return reply.code(404).send(NO_RESOURCE);
    }
    const who = viewer(request);
    if (!found.collection || !may(who, 'resources.publish') || !theirs(who, found.collection.ownerUnit.id)) {
      return reply.code(403).send(forbidden('resources.publish', 'Only the Owner of a Resource publishes it: a member of the Owner Unit of its Collection, with resources.publish.'));
    }
    switch (await resources.publish(found.resource.id, who)) {
      case 'published':
        return resourceAnswer(request, reply, found);
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

  // Who may describe a Resource marks the changes since the last Confirmation seen (FR-MR-12): part of the attribute
  // description, with its Business Descriptions (DEC-PL-03).
  app.post<{ Params: { id: string } }>('/resources/:id/changes/seen', async (request, reply) => {
    const found = await changeable(request, reply, describing('description'));
    if (!found) {
      return reply;
    }
    await resources.markSeen(found.resource.id, viewer(request));
    return resourceAnswer(request, reply, found);
  });

  /** The check that the User may deprecate a Resource of this Owner Unit: `resources.deprecate`, on theirs or every one. */
  const deprecating = (who: Viewer, ownerUnit: string): Refusal | null =>
    reaches(who, 'resources.deprecate', ownerUnit) ? null : forbidden('resources.deprecate', 'You may not deprecate this Resource, nor take its deprecation away.');

  // With `resources.deprecate`, a User deprecates a published Resource, and takes it away again (FR-SR-50).
  app.put<{ Params: { id: string }; Body: unknown }>('/resources/:id/deprecation', async (request, reply) => {
    const body = (request.body ?? {}) as { reason?: unknown; insteadOf?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 1 || reason.length > 500 || (body.insteadOf !== undefined && body.insteadOf !== null && typeof body.insteadOf !== 'string')) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Say why it is deprecated, in at most 500 characters, and what to use instead, or nothing.' });
    }
    const found = await changeable(request, reply, deprecating);
    if (!found) {
      return reply;
    }
    return deprecationOutcome(request, reply, found, await resources.deprecate(found.resource.id, reason, (body.insteadOf as string | null | undefined) ?? null, viewer(request)));
  });

  app.delete<{ Params: { id: string } }>('/resources/:id/deprecation', async (request, reply) => {
    const found = await changeable(request, reply, deprecating);
    if (!found) {
      return reply;
    }
    return deprecationOutcome(request, reply, found, await resources.undeprecate(found.resource.id, viewer(request)));
  });

  async function deprecationOutcome(request: FastifyRequest, reply: FastifyReply, found: Seen, outcome: DeprecateOutcome) {
    switch (outcome) {
      case 'done':
        return resourceAnswer(request, reply, found);
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
  // until someone with `requests.decide` answers, in the Message Centre; one of the same writer on the same
  // object that still waits is given back instead.
  app.post<{ Body: unknown }>('/requests', async (request, reply) => {
    const fields = parseRequest(request.body);
    if (typeof fields === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: fields });
    }
    const { request: sent, sent: isNew } = await requests.send(fields, viewer(request));
    return reply.code(isNew ? 201 : 200).send({ request: sent });
  });

  // The Requests of the User on queries or Lenses, on one or on all; who decides on Requests (`requests.decide`)
  // sees everyone's on one.
  app.get<{ Querystring: { subjectKind?: string; subjectId?: string } }>('/requests', async (request, reply) => {
    const { subjectKind, subjectId } = request.query;
    if (subjectKind !== 'query' && subjectKind !== 'lens') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Name the kind of object: subjectKind=query or lens.' });
    }
    if (subjectId !== undefined && !UUID.test(subjectId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A query or a Lens is named by its ID.' });
    }
    const who = viewer(request);
    const everyone = may(who, 'requests.decide') && subjectId !== undefined;
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
export function parseCard(body: unknown): CardChanges | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send what changes as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => !(CARD_KEYS as readonly string[]).includes(key));
  if (unknown !== undefined) {
    return `A Resource has no ${unknown} to change.`;
  }
  const card: CardChanges = {};
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
    if (!Array.isArray(gaps) || gaps.length > MAX_GAPS || !gaps.every((gap) => typeof gap === 'string' && gap.trim().length <= 1000)) {
      return `The Known Gaps are a list of at most ${MAX_GAPS} texts of at most 1000 characters.`;
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
 * Checks one Known Gap: plain text of 1 to 1000 characters (FR-RC-21), and its scope, a period, fields and rows, or
 * null for none (FR-RC-24); left out, a change keeps the scope it had. Returns the problem as a sentence when there is one.
 */
export function parseGap(body: unknown): { text: string; scope?: GapScope | null } | string {
  const input = (body as { text?: unknown; scope?: unknown } | null) ?? {};
  const text = input.text;
  if (typeof text !== 'string' || text.trim().length === 0 || text.trim().length > 1000) {
    return 'A Known Gap is a text of 1 to 1000 characters.';
  }
  if (input.scope === undefined) {
    return { text: text.trim() };
  }
  if (input.scope === null) {
    return { text: text.trim(), scope: null };
  }
  const scope = gapScopeSchema.safeParse(input.scope);
  if (!scope.success) {
    return `The scope of a Known Gap is a period, fields and rows: ${scope.error.issues[0]?.message ?? 'it does not fit'}`;
  }
  return { text: text.trim(), scope: scope.data };
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
  /** How dbt says a table is stored (DEC-SR-34): a partition column with its unit or none, cluster columns, a filter. */
  const storageFits = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return false;
    const storage = value as Record<string, unknown>;
    const partition = storage.partition as Record<string, unknown> | null | undefined;
    return (
      (partition === null ||
        (typeof partition === 'object' && partition !== undefined && text(partition.field, 300) && (partition.unit === null || ['hour', 'day', 'month', 'year'].includes(partition.unit as string)))) &&
      Array.isArray(storage.clusterBy) &&
      (storage.clusterBy as unknown[]).every((name) => text(name, 300)) &&
      typeof storage.requirePartitionFilter === 'boolean'
    );
  };
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
      ) &&
      (table.storage === undefined || table.storage === null || storageFits(table.storage));
    if (!fits) {
      return 'Every exposed table has a key, a Node, a name, a kind, a description, its exposures, a label or null, a checksum or null, its columns, and how it is stored or null.';
    }
  }
  if (input.changes !== undefined) {
    const KINDS = ['description', 'logic', 'type', 'structural', 'added', 'removed'];
    const changes = Array.isArray(input.changes) ? (input.changes as Record<string, unknown>[]) : null;
    const fits = (change: Record<string, unknown>) =>
      change !== null &&
      typeof change === 'object' &&
      KINDS.includes(change.kind as string) &&
      text(change.node, 1024) &&
      (change.field === undefined || text(change.field, 1024)) &&
      (change.direction === undefined || change.direction === 'added' || change.direction === 'removed') &&
      (change.old === undefined || change.old === null || text(change.old, 4096)) &&
      (change.new === undefined || change.new === null || text(change.new, 4096)) &&
      Array.isArray(change.reaches) &&
      (change.reaches as Record<string, unknown>[]).every(
        (reach) => reach !== null && typeof reach === 'object' && text(reach.nodeId, 1024) && Number.isInteger(reach.distance) && (reach.distance as number) >= 0,
      );
    if (!changes || !changes.every(fits)) {
      return 'Every change has a kind, the Node that changed and the tables it reaches, each with its distance.';
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
/**
 * A folder to make, with its name and where; or what changes about one: its name, its description or both
 * (FR-CO-39, FR-CO-42). The description is plain text, at most 500 characters, and may be empty.
 */
export function parseFolder(body: unknown, creating: boolean): { name?: string; description?: string; parentId?: string | null } | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send the folder as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => key !== 'name' && key !== 'description' && !(creating && key === 'parentId'));
  if (unknown !== undefined) {
    return `A folder has no field ${unknown}${creating ? '' : ' to change'}.`;
  }
  if (!creating && input.name === undefined && input.description === undefined) {
    return 'Send the name of the folder, its description, or both.';
  }
  const result: { name?: string; description?: string; parentId?: string | null } = {};
  if (creating || input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      return 'The name of a folder has 1 to 80 characters.';
    }
    result.name = name;
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim().length > 500) {
      return 'The description of a folder is text of at most 500 characters.';
    }
    result.description = input.description.trim();
  }
  if (input.parentId !== undefined && input.parentId !== null && typeof input.parentId !== 'string') {
    return 'The parentId is the ID of a folder of the Collection, or null for its top.';
  }
  if (creating) result.parentId = (input.parentId as string | null | undefined) ?? null;
  return result;
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
  // The release of the Domain Model is optional: it only says which version each mapping was made against
  // (DEC-AR-05). Missing or empty, it is none, and never keeps a Resource from being added.
  const release = typeof input.release === 'string' && input.release.trim() === '' ? null : (input.release ?? null);
  if (release !== null && !NAME(release, 40)) {
    return 'The release of the Domain Model is a version, or none.';
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
    release: release as string | null,
    mappings,
  };
}
