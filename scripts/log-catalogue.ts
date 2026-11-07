/**
 * Generate the table of the Log Catalogue in docs from the catalogue in the source code
 * (FR-SR-12, NFR-LOC-10).
 *
 * Usage:
 *   node scripts/log-catalogue.ts build   # rewrite the table in docs/requirements/functional/log-catalogue.md
 *   node scripts/log-catalogue.ts check   # fail when that table is not what build would write
 *
 * Both run as part of `pnpm docs:build` and `pnpm docs:check`. The page around the table is written
 * by hand; only what stands between its two markers is generated. Node built-ins only.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOG_CATALOGUE } from '../packages/contracts/src/logCatalogue.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/requirements/functional/log-catalogue.md');
const SOURCE = 'packages/contracts/src/logCatalogue.ts';
const START = `<!-- The table below is generated from ${SOURCE} by pnpm docs:build: change the catalogue there. -->`;
const END = '<!-- End of the generated table. -->';

function table(): string {
  const rows = Object.entries(LOG_CATALOGUE).map(
    ([logId, type]) => `| \`${logId}\` | ${type.text.en} | ${type.text.nl} | ${type.parameters.join(', ')} |`,
  );
  return [START, '', '| Log ID | English | Dutch | Parameters |', '| --- | --- | --- | --- |', ...rows, '', END].join('\n');
}

function main(command: string | undefined): number {
  if (command !== 'build' && command !== 'check') {
    console.log('usage: node scripts/log-catalogue.ts build|check');
    return 2;
  }
  const rel = path.relative(ROOT, OUT);
  const current = readFileSync(OUT, 'utf8');
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start < 0 || end < start) {
    console.log(`error: ${rel} lacks the markers of its generated table:\n${START}\n${END}`);
    return 1;
  }
  const text = current.slice(0, start) + table() + current.slice(end + END.length);
  const count = Object.keys(LOG_CATALOGUE).length;
  if (command === 'check') {
    if (text !== current) {
      console.log(`error: the table in ${rel} is not up to date with ${SOURCE}; run: pnpm docs:build`);
      return 1;
    }
    console.log(`ok: ${rel}, ${count} Log IDs`);
    return 0;
  }
  writeFileSync(OUT, text, 'utf8');
  console.log(`wrote the table in ${rel}: ${count} Log IDs`);
  return 0;
}

process.exitCode = main(process.argv[2]);
