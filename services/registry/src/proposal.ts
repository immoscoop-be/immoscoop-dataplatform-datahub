import type { PartitionUnit } from './database.js';
import { type DomainModel, DomainModelUnavailable } from './domain-model.js';
import type { NodeDetail, Reading } from './reading.js';

/** Where a proposed value comes from, as the step that adds a Resource names it (FR-CO-33, FR-CO-34). */
export type Origin = 'dbt' | 'test' | 'domainModel' | 'name';

export type MappingKind = 'is' | 'relation' | 'performedBy';

/** A mapping proposed for a field: `is` an identity, a relation type towards one, or who performs the event. */
export interface ProposedMapping {
  field: string;
  kind: MappingKind;
  /** The relation type, for a relation. */
  relationType: string | null;
  /** `entity.identifier`, or `entity.action` for the ID of an event (DEC-RC-06). */
  identity: string;
  origin: Origin;
}

/**
 * What Data Hub proposes for a Resource when the Data Team adds it (FR-CO-33, FR-CO-34, FR-AR-17):
 * how it is stored, its grain and model type, and a mapping for every field it can say something
 * about. Each is a suggestion the Data Admin confirms or changes (DEC-RC-09).
 */
export interface Proposal {
  nodeId: string;
  /** The model it is built on: itself, or the Colleciónes model beneath it (FR-AR-16). */
  builtOn: { name: string; entity: string | null; action: string | null; colleciones: boolean };
  /** From the dbt config of the table beneath the view, through the lineage (DEC-SR-34). */
  storage: {
    partition: { field: string; unit: PartitionUnit | null } | null;
    clusterBy: string[];
    requirePartitionFilter: boolean;
    /** The name of the model it was read from; null when no model in its lineage is partitioned or clustered. */
    from: string | null;
  };
  grain: { fields: string[]; origin: Origin } | null;
  modelType: { value: 'event' | 'state'; origin: Origin } | null;
  mappings: ProposedMapping[];
  /** The release of the Domain Model the proposal was made with; null when the collector did not answer (EC-AR-05). */
  domainModel: { release: string } | null;
}

/** How far up the lineage to look for the model beneath a view. */
const DEPTH = 10;

type Json = Record<string, unknown>;

export function createProposals(reading: Reading, domainModel: () => Promise<DomainModel>) {
  /** The nearest Node up the lineage, the Node itself first, that fits. */
  async function nearest(node: NodeDetail, fits: (candidate: NodeDetail) => boolean): Promise<NodeDetail | undefined> {
    if (fits(node)) {
      return node;
    }
    const lineage = await reading.lineage(node.uniqueId, 'upstream', DEPTH);
    for (const step of lineage?.nodes ?? []) {
      if (step.distance === 0 || !['model', 'seed', 'snapshot'].includes(step.resourceType)) {
        continue;
      }
      const candidate = await reading.node(step.uniqueId);
      if (candidate && fits(candidate)) {
        return candidate;
      }
    }
    return undefined;
  }

  return {
    /** The proposal for a Node of a Current Version; undefined when there is no such Node. */
    async proposal(uniqueId: string): Promise<Proposal | undefined> {
      const node = await reading.node(uniqueId);
      if (!node) {
        return undefined;
      }
      let model: DomainModel | null = null;
      try {
        model = await domainModel();
      } catch (error) {
        if (!(error instanceof DomainModelUnavailable)) {
          throw error;
        }
      }
      const stored = await nearest(node, (candidate) => candidate.partitionField !== null || candidate.clusterBy.length > 0);
      const colleciones = await nearest(node, (candidate) => candidate.entity !== null);
      return propose(node, { stored, colleciones }, model);
    },
  };
}

export type Proposals = ReturnType<typeof createProposals>;

/**
 * The proposal from what registry knows: the Node, the model beneath it that is partitioned or
 * clustered, the Colleciónes model it is built on, and the Domain Model when the collector answered.
 * A column of a model beneath counts only when the Node has a field of the same name.
 */
export function propose(node: NodeDetail, beneath: { stored?: NodeDetail; colleciones?: NodeDetail }, model: DomainModel | null): Proposal {
  const fields = new Map(node.columns.map((column) => [column.name.toLowerCase(), column.name]));
  const own = (name: string | null | undefined) => (name ? fields.get(name.toLowerCase()) : undefined);
  const { stored, colleciones } = beneath;

  // How it is stored: only what the Node passes through by name promises anything (OP-SR-12).
  const partitionField = own(stored?.partitionField);
  const clusterBy = (stored?.clusterBy ?? []).flatMap((name) => own(name) ?? []);
  const storage: Proposal['storage'] = {
    partition: partitionField ? { field: partitionField, unit: stored?.partitionUnit ?? null } : null,
    clusterBy,
    requirePartitionFilter: Boolean(partitionField && stored?.requirePartitionFilter),
    from: partitionField || clusterBy.length > 0 ? (stored?.name ?? null) : null,
  };

  const entity = colleciones?.entity ?? null;
  const action = colleciones?.action ?? null;
  const known = entity ? model?.entities[entity] : undefined;

  // The grain: a `unique` test on a field of the Node itself, else what the Colleciónes model declares.
  const unique = node.tests.find((test) => test.name === 'unique' && own(test.columnName));
  const declared = String(object(object(colleciones?.meta).model).grain ?? '').toLowerCase();
  const identifier = known?.identifiers.map(own).find(Boolean) ?? own(entity ? `${entity}Id` : null);
  const grainField = declared === 'event' ? own('eventId') : ['state', 'currentstate', 'identifier'].includes(declared) ? identifier : undefined;
  const grain: Proposal['grain'] = unique
    ? { fields: [own(unique.columnName)!], origin: 'test' }
    : grainField
      ? { fields: [grainField], origin: 'domainModel' }
      : null;

  // The model type, from the strategy of the Colleciónes model: an event or a state (DEC-RC-10).
  const strategy = (colleciones?.strategy ?? '').toLowerCase();
  const modelType: Proposal['modelType'] = strategy.includes('event')
    ? { value: 'event', origin: 'domainModel' }
    : strategy.includes('state')
      ? { value: 'state', origin: 'domainModel' }
      : null;

  const mappings = new Map<string, ProposedMapping>();
  const add = (mapping: ProposedMapping) => {
    if (!mappings.has(mapping.field)) {
      mappings.set(mapping.field, mapping);
    }
  };

  // 1. What the manifest says per column, on the Node or on the same column of the model beneath (DEC-AR-07).
  const metaOf = new Map<string, Json>();
  for (const column of [...(colleciones?.columns ?? []), ...node.columns]) {
    const domain = object(column.meta.domain);
    if (Object.keys(domain).length > 0) {
      metaOf.set(column.name.toLowerCase(), domain);
    }
  }
  for (const [name, domain] of metaOf) {
    const field = own(name);
    const mapping = field ? fromMeta(field, domain) : undefined;
    if (mapping) {
      add(mapping);
    }
  }

  if (model) {
    // 2. What the Domain Model says about the Entity and action the Colleciónes model is built on.
    if (entity && known) {
      const eventId = own('eventId');
      if (action && eventId && known.actions[action]) {
        add({ field: eventId, kind: 'is', relationType: null, identity: `${entity}.${action}`, origin: 'domainModel' });
      }
      for (const name of known.identifiers) {
        const field = own(name);
        if (field) {
          add({ field, kind: 'is', relationType: null, identity: `${entity}.${name}`, origin: 'domainModel' });
        }
      }
      const doing = action ? known.actions[action] : undefined;
      for (const reference of [...(doing?.references ?? []), ...known.references]) {
        for (const name of identifiersOf(model, reference.target)) {
          const field = own(name);
          if (field) {
            add({ field, kind: 'relation', relationType: reference.type, identity: `${reference.target}.${name}`, origin: 'domainModel' });
          }
        }
      }
      // Who performs the event: one actor per event (DEC-RC-14).
      const actor = (doing?.performedBy ?? [])
        .flatMap((performer) => identifiersOf(model, performer).map((name) => ({ performer, name, field: own(name) })))
        .find((candidate) => candidate.field && !mappings.has(candidate.field));
      if (actor?.field) {
        add({ field: actor.field, kind: 'performedBy', relationType: null, identity: `${actor.performer}.${actor.name}`, origin: 'domainModel' });
      }
    }
    // 3. Any other field named as an identifier of an Entity: `is` that identity (FR-AR-17).
    for (const field of fields.values()) {
      const owners = Object.entries(model.entities).filter(([, candidate]) => candidate.identifiers.includes(field));
      const owner = owners.find(([name]) => `${name}Id` === field) ?? (owners.length === 1 ? owners[0] : undefined);
      if (owner) {
        add({ field, kind: 'is', relationType: null, identity: `${owner[0]}.${field}`, origin: 'name' });
      }
    }
  }

  return {
    nodeId: node.uniqueId,
    builtOn: colleciones
      ? { name: colleciones.name, entity, action, colleciones: true }
      : { name: node.name, entity: null, action: null, colleciones: false },
    storage,
    grain,
    modelType,
    mappings: node.columns.flatMap((column) => mappings.get(column.name) ?? []),
    domainModel: model && { release: model.release },
  };
}

/** The identifiers of an Entity, the one named after it first, such as `listingId` for `listing`. */
function identifiersOf(model: DomainModel, entity: string): string[] {
  const identifiers = model.entities[entity]?.identifiers ?? [];
  return [...identifiers].sort((a, b) => Number(b === `${entity}Id`) - Number(a === `${entity}Id`));
}

/**
 * A mapping from `meta.domain` of a column, as the generator of Colleciónes writes it (DEC-AR-07):
 * `maps: is` with the Entity and its identifier, or with the action for the ID of an event; `maps:
 * relation` with the relation type and the Entity and identifier it points at. A generic column holds
 * several and maps to nothing.
 */
function fromMeta(field: string, domain: Json): ProposedMapping | undefined {
  const maps = text(domain.maps);
  const entity = text(domain.entity) ?? text(object(domain.entity).name);
  const target = text(domain.identifier) ?? text(domain.action);
  if (!entity || !target) {
    return undefined;
  }
  if (maps === 'is') {
    return { field, kind: 'is', relationType: null, identity: `${entity}.${target}`, origin: 'domainModel' };
  }
  const type = text(domain.type) ?? text(domain.relationType);
  if (maps === 'relation' && type) {
    return { field, kind: 'relation', relationType: type, identity: `${entity}.${target}`, origin: 'domainModel' };
  }
  return undefined;
}

function object(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
