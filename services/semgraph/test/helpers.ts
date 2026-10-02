import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRegistry, REPO_ROOT, type Registry } from '../src/core/registry.ts';

/** A fixed "now": 1 October 2026 at noon in Brussels, so the reference day 30 September is yesterday. */
export const NOW = new Date('2026-10-01T10:00:00Z');

let registry: Promise<Registry> | undefined;
export function testRegistry(): Promise<Registry> {
  registry ??= loadRegistry();
  return registry;
}

export async function example(name: string, semgraph = 'movingWindowAverage'): Promise<Record<string, unknown>> {
  const loaded = (await testRegistry()).semgraphs.get(semgraph)!;
  const request = loaded.examples.get(name);
  if (request === undefined) throw new Error(`no example ${semgraph}/${name}`);
  return structuredClone(request) as Record<string, unknown>;
}

/** A fixture from test/fixtures. */
export async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, 'test', 'fixtures', name), 'utf8')) as T;
}

/** A complete daily series ending at `end`, with the given values. */
export function series(end: string, values: (number | null)[]): { day: string; value: number | null }[] {
  const last = Date.parse(`${end}T00:00:00Z`);
  return values.map((value, index) => ({
    day: new Date(last - (values.length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

/** Compares with test/golden/<name>; UPDATE_GOLDEN=1 rewrites the file instead. */
export async function assertGolden(name: string, actual: string): Promise<void> {
  const file = path.join(REPO_ROOT, 'test', 'golden', name);
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    await writeFile(file, actual);
    if (process.env.UPDATE_GOLDEN !== '1') assert.fail(`golden file ${name} did not exist and was written; check it and run again`);
    return;
  }
  assert.equal(actual, await readFile(file, 'utf8'), `output differs from test/golden/${name} (UPDATE_GOLDEN=1 to accept)`);
}
