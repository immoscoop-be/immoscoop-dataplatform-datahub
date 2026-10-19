import { type CollectionColour, type CollectionVisibility, isCollectionColour } from '@datahub/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { type CollectionChanges, type Collections, NameTaken, type Viewer } from './collections.js';
import { type Group, type Identity, IdentityUnavailable } from './identity.js';

export interface ApiOptions {
  collections: Collections;
  identity: Identity;
}

/** The role of the Data Team, from its Role Group `datahub-datateam@` (Naming Convention). */
const DATA_TEAM = 'datateam';

/** The fields a request may send for a Collection. */
interface Fields {
  name?: string;
  description?: string;
  colour?: CollectionColour;
  visibility?: CollectionVisibility;
  ownerUnit?: string;
}

/** The chosen Owner Unit is not one of the groups of whoever chose it (FR-CO-15). */
class NotYourGroup extends Error {}

const NOT_FOUND = { error: 'not_found', message: 'No such Collection.' };

/**
 * The routes of Collections (TR-CO-02). Everyone may create one; whoever sees a Collection may read
 * it and its Log; its Owner Unit and the Data Team may change and dissolve it. A Collection someone
 * does not see answers 404, as one that does not exist (FR-CO-17).
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { collections, identity } = options;

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof NameTaken) {
      return reply.code(409).send({ error: 'name_taken', message: error.message });
    }
    if (error instanceof NotYourGroup) {
      return reply.code(400).send({ error: 'not_your_group', message: 'Choose a group you are in yourself as Owner Unit.' });
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

  /** The Owner Unit chosen by the User, read from identity with their own token (TR-CO-03). */
  async function ownGroup(request: FastifyRequest, id: string): Promise<Group> {
    const group = (await identity.groups(request.headers.authorization ?? '')).find((candidate) => candidate.id === id);
    if (!group) {
      throw new NotYourGroup();
    }
    return group;
  }

  app.get('/collections', async (request) => ({ collections: await collections.list(viewer(request)) }));

  app.post<{ Body: unknown }>('/collections', async (request, reply) => {
    const fields = parse(request.body, true);
    if (typeof fields === 'string') {
      return reply.code(400).send({ error: 'invalid_request', message: fields });
    }
    const { name, description, colour, ownerUnit, visibility = 'private' } = fields as Required<Fields>;
    const group = await ownGroup(request, ownerUnit);
    const created = await collections.create({ name, description, colour, visibility, ownerUnit: group }, viewer(request));
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
    return { entries: await collections.log(current.id, 200) };
  });
}

/**
 * Checks the fields of a Collection in a request: all of name, description, colour and Owner Unit
 * to create one (visibility is private unless given), and at least one field to change one.
 * Returns the problem as a sentence when there is one.
 */
export function parse(body: unknown, creating: boolean): Fields | string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Send the fields of the Collection as a JSON object.';
  }
  const input = body as Record<string, unknown>;
  const known = new Set(['name', 'description', 'colour', 'visibility', 'ownerUnit']);
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
  if (input.colour !== undefined) {
    if (!isCollectionColour(input.colour)) {
      return 'The colour is one of the palette: rose, indigo, sand, green, cyan, wine, teal, olive or purple.';
    }
    fields.colour = input.colour;
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
    const missing = (['name', 'description', 'colour', 'ownerUnit'] as const).find((key) => fields[key] === undefined);
    if (missing) {
      return `A new Collection needs ${missing === 'ownerUnit' ? 'an Owner Unit' : `a ${missing}`}.`;
    }
  } else if (Object.keys(fields).length === 0) {
    return 'Send at least one field to change.';
  }
  return fields;
}
