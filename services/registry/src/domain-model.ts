/** A reference of an Entity or action: a relation type towards another Entity (DEC-RC-05). */
export interface Reference {
  type: string;
  target: string;
  /** As the Domain Model gives it with the reference, when it does. */
  cardinality: Cardinality | null;
}

export type Cardinality = 'one' | 'many';

export interface Entity {
  /** The names of its identifiers, such as `listingId`. */
  identifiers: string[];
  references: Reference[];
  /** Its actions, each with who performs it and its references. */
  actions: Record<string, { performedBy: string[]; references: Reference[] }>;
}

/** The Domain Model in use, as the collector of Colleciónes runs it (DEC-AR-04). */
export interface DomainModel {
  /** Its name and version, such as `immoscoop` 0.1.0. */
  domain: string;
  version: string;
  /** The release of the package it comes from, such as 0.0.70: recorded with each mapping (FR-AR-15). */
  release: string;
  entities: Record<string, Entity>;
  /** Each relation type with the cardinalities the Domain Model gives it and its inverse. */
  relationTypes: Record<string, { cardinality: Cardinality[]; inverse: string | null; description: string }>;
}

/** The collector did not answer, or not with a Domain Model: the step that needs it says so (EC-AR-05). */
export class DomainModelUnavailable extends Error {}

type Json = Record<string, unknown>;

/** The public address of the collector of Colleciónes (DEC-AR-04). */
export const COLLECTOR_URL = 'https://colleciones-eventos.immoscoop.be';

/**
 * Reads the Domain Model from the collector, every time it is needed: Data Hub keeps no copy that could
 * fall behind (DEC-AR-05).
 */
export function createDomainModelSource(baseUrl: string = COLLECTOR_URL, request: typeof fetch = fetch): () => Promise<DomainModel> {
  return async () => {
    let response: Response;
    try {
      response = await request(new URL('/domain-model', baseUrl), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new DomainModelUnavailable('The collector of Colleciónes did not answer', { cause: error });
    }
    if (!response.ok) {
      throw new DomainModelUnavailable(`The collector of Colleciónes answered ${response.status} for the Domain Model`);
    }
    try {
      return parseDomainModel(await response.json());
    } catch (error) {
      throw new DomainModelUnavailable('The collector of Colleciónes did not answer with a Domain Model', { cause: error });
    }
  };
}

/**
 * The parts of the runtime contract Data Hub uses: its version and release, its Entities with their
 * identifiers, references and actions, and its relation types (FR-AR-15). The contract may come as it
 * is, or wrapped in `model` or `contract`.
 */
export function parseDomainModel(input: unknown): DomainModel {
  const wrapped = object(input);
  const model = isObject(wrapped.entities) ? wrapped : isObject(object(wrapped.model).entities) ? object(wrapped.model) : object(wrapped.contract);
  if (!isObject(model.entities)) {
    throw new Error('No Entities in the Domain Model');
  }
  const meta = object(model.meta);
  const release = object(meta.release);
  const references = (value: unknown): Reference[] =>
    (Array.isArray(value) ? value : []).filter(isObject).flatMap((reference) => {
      const type = string(reference.type);
      const target = string(reference.target);
      const cardinality = reference.cardinality === 'one' || reference.cardinality === 'many' ? reference.cardinality : null;
      return type && target ? [{ type, target, cardinality }] : [];
    });
  const entities: Record<string, Entity> = {};
  for (const [name, entity] of Object.entries(model.entities)) {
    if (!isObject(entity)) {
      continue;
    }
    const actions: Entity['actions'] = {};
    for (const [action, details] of Object.entries(object(entity.actions))) {
      const performedBy = Array.isArray(object(details).performedBy) ? (object(details).performedBy as unknown[]).filter((actor): actor is string => typeof actor === 'string') : [];
      actions[action] = { performedBy, references: references(object(details).references) };
    }
    entities[name] = { identifiers: Object.keys(object(entity.identifiers)), references: references(entity.references), actions };
  }
  const relationTypes: DomainModel['relationTypes'] = {};
  for (const [name, type] of Object.entries(object(object(model.vocabulary).relationTypes))) {
    const cardinality = (Array.isArray(object(type).cardinality) ? (object(type).cardinality as unknown[]) : []).filter(
      (value): value is Cardinality => value === 'one' || value === 'many',
    );
    relationTypes[name] = { cardinality, inverse: string(object(type).inverse), description: string(object(type).description) ?? '' };
  }
  return {
    domain: string(meta.domain) ?? '',
    version: string(meta.version) ?? '',
    release: string(release.version) ?? string(release.tag)?.replace(/^v/, '') ?? string(meta.version) ?? '',
    entities,
    relationTypes,
  };
}

/** A relation type as the step that adds a Resource offers it. */
export interface OfferedType {
  name: string;
  /** One or many per subject; both while the Domain Model gives the type both. */
  cardinality: Cardinality | 'either';
  description: string;
}

/**
 * The relation types a field can map to: those the Domain Model uses in its references. The inverses,
 * such as `basisFor`, count from the other side, so they are left out (DEC-RC-05); of a pair it does
 * not use, the one it names first stays.
 */
export function offeredTypes(model: DomainModel): OfferedType[] {
  const used = new Set(
    Object.values(model.entities).flatMap((entity) => [
      ...entity.references.map((reference) => reference.type),
      ...Object.values(entity.actions).flatMap((action) => action.references.map((reference) => reference.type)),
    ]),
  );
  const order = Object.keys(model.relationTypes);
  const inverseSide = (name: string, inverse: string | null) =>
    inverse !== null && inverse in model.relationTypes && (used.has(inverse) || order.indexOf(inverse) < order.indexOf(name));
  return Object.entries(model.relationTypes)
    .filter(([name, type]) => used.has(name) || !inverseSide(name, type.inverse))
    .map(([name, type]) => ({
      name,
      cardinality: type.cardinality.length === 1 ? type.cardinality[0]! : 'either',
      description: type.description,
    }));
}

/** Every identity an `is` or a relation can point at: `entity.identifier`, and an event as `entity.action`. */
export function identitiesOf(model: DomainModel): string[] {
  return Object.entries(model.entities).flatMap(([name, entity]) => [
    ...entity.identifiers.map((identifier) => `${name}.${identifier}`),
    ...Object.keys(entity.actions).map((action) => `${name}.${action}`),
  ]);
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown): Json {
  return isObject(value) ? value : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
