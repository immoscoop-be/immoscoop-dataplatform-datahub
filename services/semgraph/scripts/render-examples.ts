// Renders every example request to out/<semgraph>-<example>.svg (or .json for a refusal),
// so the charts can be compared with Figma. Usage: npm run render:examples
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, loadRegistry } from '../src/core/registry.ts';
import { runPipeline } from '../src/core/pipeline.ts';

const out = path.join(REPO_ROOT, 'out');
await mkdir(out, { recursive: true });
const registry = await loadRegistry();
for (const [id, semgraph] of registry.semgraphs) {
  for (const [name, example] of semgraph.examples) {
    const result = await runPipeline(registry, example);
    const file = path.join(out, `${id}-${name}.${result.svg ? 'svg' : 'json'}`);
    await writeFile(file, result.svg ?? `${JSON.stringify(result.report, null, 2)}\n`);
    const codes = result.report.issues.map((issue) => issue.code).join(', ') || '-';
    console.log(`${path.relative(REPO_ROOT, file)}  ${result.report.outcome}  ${codes}`);
    for (const warning of result.warnings) console.warn(`  ${warning}`);
  }
}
