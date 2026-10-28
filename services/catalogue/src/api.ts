import type { ServiceCallerVerifier } from '@datahub/auth';
import type { CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type CollectionChanges, type Collections, NameTaken, NotEmpty, type Viewer } from './collections.js';
import { type Group, type Identity, IdentityUnavailable } from './identity.js';
import { MODEL_TYPES, type ModelType, type Origins, type PartitionUnit } from './database.js';
import type { AddItem, AddOutcome, Details, Mapping, Resource, Resources, ResourcesUpdate } from './resources.js';

export interface ApiOptions {
  collections: Collections;
  identity: Identity;
  resources: Resources;
  /** Who may hand over the exposed tables: the service account of registry (TR-SR-01). */
  serviceCallers: ServiceCallerVerifier;
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
}

/** The chosen Owner Unit is not one of the groups of whoever chose it (FR-CO-15), nor of the domain (FR-CO-35). */
class NotYourGroup extends Error {}

/** How many Resources one request adds at most: far more than a Collection takes in at once. */
const ADD_LIMIT = 200;

const NOT_FOUND = { error: 'not_found', message: 'No such Collection.' };
const NO_RESOURCE = { error: 'not_found', message: 'No such Resource.' };
const DATA_TEAM_ONLY = { error: 'forbidden', message: 'Only the Data Team adds Resources to Collections and removes them.' };

/** A project with thousands of exposed tables, with their descriptions, fits well within this. */
const UPDATE_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * The routes of Collections (TR-CO-02). Everyone may create one; whoever sees a Collection may read
 * it and its Log; its Owner Unit and the Data Team may change and dissolve it. A Collection someone
 * does not see answers 404, as one that does not exist (FR-CO-17).
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { collections, identity, resources, serviceCallers } = options;

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

  app.get('/collections', async (request) => ({ collections: await collections.list(viewer(request)) }));

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
    return { resources: current.canManage ? await resources.inCollection(current.id) : [] };
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
   * Who sees a Resource that is not published: the Data Team and the members of the Owner Unit of its
   * Collection (FR-SR-31); Publication is not built yet. Anyone else gets 404, as for one that does not exist.
   */
  async function seen(request: FastifyRequest, resource: Resource | undefined): Promise<boolean> {
    const who = viewer(request);
    const collection = resource?.collectionId ? await collections.get(resource.collectionId, who) : undefined;
    return resource !== undefined && (who.dataTeam || collection?.canManage === true);
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
  const known = new Set(['name', 'description', 'icon', 'visibility', 'ownerUnit']);
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
