import { BASE_LOCALE, lookup, type Catalog } from './i18n.ts';
import type { Attribute, AttributeValues, SemgraphMetadata } from './semgraph.ts';

/**
 * The conformance checks of the analysis "Grafiekserver", run on every commit (tests) and at start-up:
 *   1. a semgraph only uses attributes and values from the vocabulary;
 *   2. every attribute that applies to a semgraph is filled in, with `any` written explicitly,
 *      and an attribute that does not apply is left out;
 *   3. every pair of semgraphs is disjoint in at least one attribute (`any` is never disjoint),
 *      so the choice aid can always end at exactly one semgraph;
 *   4. every askWhen refers to an existing attribute and value;
 *   5. every text key has an English base text.
 * Plus: schemas compile, examples are valid, doNotUseWhen points to a catalogue id, and every
 * available semgraph has its files and code.
 */

export interface CatalogEntry {
  id: string;
  status: 'available' | 'planned';
}

export interface SemgraphUnderCheck {
  id: string;
  metadata: SemgraphMetadata;
  /** Problems found while loading: schema that does not compile, invalid example, missing code. */
  loadProblems?: string[];
}

export interface ConformanceInput {
  vocabulary: Attribute[];
  catalog: CatalogEntry[];
  semgraphs: SemgraphUnderCheck[];
  locales: ReadonlyMap<string, Catalog>;
  /** Folders under semgraphs/, to catch a folder that is missing from the catalogue. */
  folders?: string[];
}

export function checkConformance(input: ConformanceInput): string[] {
  return [
    ...checkVocabulary(input.vocabulary),
    ...checkCatalog(input),
    ...input.semgraphs.flatMap((semgraph) => [
      ...checkMetadataShape(semgraph.metadata, semgraph.id),
      ...checkAttributes(input.vocabulary, semgraph.metadata),
      ...checkAlternatives(input.catalog, semgraph.metadata),
      ...(semgraph.loadProblems ?? []).map((problem) => `${semgraph.id}: ${problem}`),
    ]),
    ...checkDistinguishable(input.semgraphs.map((semgraph) => semgraph.metadata)),
    ...checkTexts(input),
  ];
}

/** Check 4, plus unique ids and non-empty value lists. */
export function checkVocabulary(vocabulary: Attribute[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const attribute of vocabulary) {
    if (ids.has(attribute.id)) problems.push(`vocabulary: attribute ${attribute.id} is defined twice`);
    ids.add(attribute.id);
    if (!Array.isArray(attribute.values) || attribute.values.length === 0) {
      problems.push(`vocabulary: attribute ${attribute.id} has no values`);
    }
  }
  for (const attribute of vocabulary) {
    for (const [other, value] of Object.entries(attribute.askWhen ?? {})) {
      const target = vocabulary.find((candidate) => candidate.id === other);
      if (!target) {
        problems.push(`vocabulary: askWhen of ${attribute.id} refers to unknown attribute ${other}`);
      } else if (!target.values.includes(value)) {
        problems.push(`vocabulary: askWhen of ${attribute.id} refers to unknown value ${other}=${value}`);
      }
    }
  }
  return problems;
}

/** Whether an attribute applies to a semgraph: only when every askWhen condition can hold. */
export function applies(attribute: Attribute, attributes: Record<string, AttributeValues>): boolean {
  return Object.entries(attribute.askWhen ?? {}).every(([other, value]) => {
    const values = attributes[other];
    return values === 'any' || (Array.isArray(values) && values.includes(value));
  });
}

/** Checks 1 and 2 for one semgraph. */
export function checkAttributes(vocabulary: Attribute[], metadata: SemgraphMetadata): string[] {
  const problems: string[] = [];
  const attributes = metadata.attributes ?? {};
  for (const [id, values] of Object.entries(attributes)) {
    const attribute = vocabulary.find((candidate) => candidate.id === id);
    if (!attribute) {
      problems.push(`${metadata.id}: attribute ${id} is not in the vocabulary`);
    } else if (values === 'any') {
      continue;
    } else if (!Array.isArray(values) || values.length === 0) {
      problems.push(`${metadata.id}: attribute ${id} needs a list of values or an explicit any`);
    } else {
      for (const value of values) {
        if (!attribute.values.includes(value)) {
          problems.push(`${metadata.id}: value ${value} of attribute ${id} is not in the vocabulary`);
        }
      }
    }
  }
  for (const attribute of vocabulary) {
    const filled = Object.hasOwn(attributes, attribute.id);
    const applicable = applies(attribute, attributes);
    if (applicable && !filled) {
      problems.push(`${metadata.id}: attribute ${attribute.id} applies but is missing (write any if it does not matter)`);
    } else if (!applicable && filled) {
      problems.push(`${metadata.id}: attribute ${attribute.id} does not apply (askWhen) and must be left out`);
    }
  }
  return problems;
}

/** Check 3: every pair must be disjoint in at least one attribute that both fill without any. */
export function checkDistinguishable(semgraphs: SemgraphMetadata[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < semgraphs.length; i++) {
    for (let j = i + 1; j < semgraphs.length; j++) {
      const [a, b] = [semgraphs[i]!, semgraphs[j]!];
      if (!disjointSomewhere(a.attributes, b.attributes)) {
        problems.push(
          `${a.id} and ${b.id} are not disjoint in any attribute: the vocabulary lacks an attribute, or they are the same semgraph`,
        );
      }
    }
  }
  return problems;
}

function disjointSomewhere(a: Record<string, AttributeValues>, b: Record<string, AttributeValues>): boolean {
  return Object.entries(a).some(([id, values]) => {
    const others = b[id];
    if (values === 'any' || others === undefined || others === 'any') return false;
    return values.every((value) => !others.includes(value));
  });
}

function checkMetadataShape(metadata: SemgraphMetadata, folder: string): string[] {
  const problems: string[] = [];
  const at = `${folder}/metadata.yml`;
  if (metadata.id !== folder) problems.push(`${at}: id ${metadata.id} does not match the folder ${folder}`);
  for (const key of ['title', 'answers', 'readingCard'] as const) {
    if (typeof metadata[key] !== 'string') problems.push(`${at}: ${key} must be a text key`);
  }
  if (!Array.isArray(metadata.exampleQuestions)) problems.push(`${at}: exampleQuestions must be a list`);
  if (!Array.isArray(metadata.doNotUseWhen)) problems.push(`${at}: doNotUseWhen must be a list`);
  if (typeof metadata.attributes !== 'object' || metadata.attributes === null) problems.push(`${at}: attributes missing`);
  if (!Number.isInteger(metadata.data?.minimumPoints) || metadata.data.minimumPoints < 1) {
    problems.push(`${at}: data.minimumPoints must be a positive whole number`);
  }
  for (const link of ['figma', 'learning'] as const) {
    if (!/^https:\/\//.test(metadata.links?.[link] ?? '')) problems.push(`${at}: links.${link} must be an https link`);
  }
  // REQ-102, REQ-103: a lesson is optional; when there is one, all of it.
  if (metadata.lesson !== undefined) {
    for (const key of ['title', 'whatYouSee', 'watchOut'] as const) {
      if (typeof metadata.lesson?.[key] !== 'string') problems.push(`${at}: lesson.${key} must be a text key`);
    }
  }
  return problems;
}

function checkAlternatives(catalog: CatalogEntry[], metadata: SemgraphMetadata): string[] {
  return (metadata.doNotUseWhen ?? []).flatMap(({ intent, use }) => {
    if (use === metadata.id) return [`${metadata.id}: doNotUseWhen ${intent} points to itself`];
    if (!catalog.some((entry) => entry.id === use)) {
      return [`${metadata.id}: doNotUseWhen ${intent} points to ${use}, which is not in semgraphs/catalog.yml`];
    }
    return [];
  });
}

function checkCatalog(input: ConformanceInput): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of input.catalog) {
    if (ids.has(entry.id)) problems.push(`catalog: ${entry.id} is listed twice`);
    ids.add(entry.id);
    if (entry.status !== 'available' && entry.status !== 'planned') {
      problems.push(`catalog: ${entry.id} has unknown status ${String(entry.status)}`);
    }
    if (entry.status === 'available' && !input.semgraphs.some((semgraph) => semgraph.id === entry.id)) {
      problems.push(`catalog: ${entry.id} is available but semgraphs/${entry.id} could not be loaded`);
    }
  }
  for (const folder of input.folders ?? []) {
    const entry = input.catalog.find((candidate) => candidate.id === folder);
    if (!entry) problems.push(`semgraphs/${folder} is not in semgraphs/catalog.yml`);
    else if (entry.status !== 'available') problems.push(`semgraphs/${folder} exists but is marked ${entry.status}`);
  }
  return problems;
}

/** Check 5: every text key in the vocabulary and metadata has an English base text. */
function checkTexts(input: ConformanceInput): string[] {
  const base = input.locales.get(BASE_LOCALE);
  if (!base) return [`locales/${BASE_LOCALE}.yml is missing`];
  const keys = [
    ...input.vocabulary.flatMap((attribute) => (attribute.question ? [attribute.question] : [])),
    ...input.semgraphs.flatMap(({ metadata }) => [
      metadata.title,
      metadata.answers,
      metadata.readingCard,
      ...(metadata.exampleQuestions ?? []),
      ...(metadata.lesson ? [metadata.lesson.title, metadata.lesson.whatYouSee, metadata.lesson.watchOut] : []),
    ]),
  ];
  return keys
    .filter((key) => typeof key === 'string' && lookup(base, key) === undefined)
    .map((key) => `text key ${key} has no English base text in locales/${BASE_LOCALE}.yml`);
}
