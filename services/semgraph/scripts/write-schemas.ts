// Writes the contract of every semgraph, as composed by its classes, to semgraphs/<id>/schema.json.
// The service checks at start-up (and the tests on every commit) that these files are up to date.
// Usage: npm run schemas
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../src/core/registry.ts';
import { implementations } from '../semgraphs/index.ts';

for (const [id, implementation] of Object.entries(implementations)) {
  const file = path.join(REPO_ROOT, 'semgraphs', id, 'schema.json');
  await writeFile(file, `${JSON.stringify(implementation.schema(), null, 2)}\n`);
  console.log(path.relative(REPO_ROOT, file));
}
