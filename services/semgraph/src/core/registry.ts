import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { implementations as defaultImplementations } from '../../semgraphs/index.ts';
import { checkConformance, type CatalogEntry } from './conformance.ts';
import type { Catalog } from './i18n.ts';
import { createAjv, type ValidateFunction } from './schema.ts';
import type { AnySemgraphImplementation, Attribute, SemgraphMetadata } from './semgraph.ts';
import type { Tokens } from './tokens.ts';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export interface LoadedSemgraph {
  id: string;
  metadata: SemgraphMetadata;
  schema: object;
  validate: ValidateFunction;
  /** Example requests from semgraphs/<id>/examples, by file name without .json. */
  examples: ReadonlyMap<string, unknown>;
  implementation: AnySemgraphImplementation;
}

export interface Registry {
  version: string;
  vocabulary: Attribute[];
  catalog: CatalogEntry[];
  semgraphs: ReadonlyMap<string, LoadedSemgraph>;
  locales: ReadonlyMap<string, Catalog>;
  tokens: Tokens;
}

export class ConformanceError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`The semgraph definitions do not pass the conformance checks:\n- ${problems.join('\n- ')}`);
    this.name = 'ConformanceError';
    this.problems = problems;
  }
}

export interface LoadOptions {
  root?: string;
  implementations?: Readonly<Record<string, AnySemgraphImplementation>>;
}

/** Loads vocabulary, catalogue, semgraphs, locales and tokens, and refuses to continue if they do not conform. */
export async function loadRegistry(options: LoadOptions = {}): Promise<Registry> {
  const root = options.root ?? REPO_ROOT;
  const implementations = options.implementations ?? defaultImplementations;
  const file = (...parts: string[]) => path.join(root, ...parts);

  const vocabulary = (await readYaml(file('vocabulary', 'attributes.yml'))) as Attribute[];
  const catalog = (await readYaml(file('semgraphs', 'catalog.yml'))) as CatalogEntry[];
  const locales = new Map<string, Catalog>();
  for (const name of (await readdir(file('locales'))).filter((entry) => entry.endsWith('.yml')).sort()) {
    locales.set(name.slice(0, -'.yml'.length), (await readYaml(file('locales', name))) as Catalog);
  }
  const tokens = JSON.parse(await readFile(file('tokens', 'ptditt-grafiektaal-tokens.json'), 'utf8')) as Tokens;
  const { version } = JSON.parse(await readFile(file('package.json'), 'utf8')) as { version: string };

  const ajv = createAjv();
  const semgraphs = new Map<string, LoadedSemgraph>();
  const underCheck = [];
  const folders = (await readdir(file('semgraphs'), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const entry of catalog.filter((candidate) => candidate.status === 'available')) {
    const folder = file('semgraphs', entry.id);
    if (!existsSync(path.join(folder, 'metadata.yml'))) continue;
    const problems: string[] = [];
    const metadata = (await readYaml(path.join(folder, 'metadata.yml'))) as SemgraphMetadata;
    const implementation = implementations[entry.id];
    if (!implementation) problems.push('no code registered in semgraphs/index.ts');
    // The contract comes from the classes; schema.json is its written form and must match it.
    const schema = implementation?.schema();
    let validate: ValidateFunction | undefined;
    if (schema) {
      try {
        validate = ajv.compile(schema);
      } catch (error) {
        problems.push(`the schema does not compile: ${(error as Error).message}`);
      }
      const written = path.join(folder, 'schema.json');
      if (!existsSync(written)) problems.push('schema.json is missing: run npm run schemas');
      else if (JSON.stringify(JSON.parse(await readFile(written, 'utf8'))) !== JSON.stringify(schema)) {
        problems.push('schema.json is out of date: run npm run schemas');
      }
    }
    const examples = new Map<string, unknown>();
    const examplesFolder = path.join(folder, 'examples');
    if (existsSync(examplesFolder)) {
      for (const name of (await readdir(examplesFolder)).filter((entry) => entry.endsWith('.json')).sort()) {
        const example = JSON.parse(await readFile(path.join(examplesFolder, name), 'utf8')) as unknown;
        if (validate && !validate(example)) {
          problems.push(`example ${name} does not match schema.json: ${ajv.errorsText(validate.errors)}`);
        }
        examples.set(name.slice(0, -'.json'.length), example);
      }
    }
    underCheck.push({ id: entry.id, metadata, loadProblems: problems });
    if (validate && implementation && schema) {
      semgraphs.set(entry.id, { id: entry.id, metadata, schema, validate, examples, implementation });
    }
  }

  const problems = checkConformance({ vocabulary, catalog, semgraphs: underCheck, locales, folders });
  if (problems.length > 0) throw new ConformanceError(problems);
  return { version, vocabulary, catalog, semgraphs, locales, tokens };
}

async function readYaml(file: string): Promise<unknown> {
  return parseYaml(await readFile(file, 'utf8'));
}
