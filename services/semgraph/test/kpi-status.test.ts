import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function run(request: unknown, draw = false) {
  return runPipeline(await testRegistry(), request, { now: NOW, draw });
}
const issues = (result: Awaited<ReturnType<typeof run>>) => result.report.issues.map((issue) => [issue.level, issue.code, issue.field]);
type Row = Record<string, unknown>;

describe('kpiStatus', () => {
  it('REQ-069: wants cumulative levels, which never go down, and a path only from the day it was set', async () => {
    const request = await example('leads-since-launch', 'kpiStatus');
    const rows = request.points as Row[];
    const amounts = rows.map((row, index) => (index === 2 ? { ...row, actual: 2700 } : row));
    assert.deepEqual(issues(await run({ ...request, points: amounts })), [['inputError', 'cumulativeDecreases', '/points/2/actual']]);
    const early = rows.map((row, index) => (index === 1 ? { ...row, path: 104000 } : row));
    assert.deepEqual(issues(await run({ ...request, points: early })), [['inputError', 'pathBeforeSet', '/points/1/path']]);
  });

  it('checks the days of the KPI and keeps the periods between its start and its target', async () => {
    const request = await example('leads-since-launch', 'kpiStatus');
    const before = (await run({ ...request, target: { day: '2025-12-31', value: 130000 } })).report.issues.map((issue) => issue.code);
    assert.deepEqual(before.slice(0, 2), ['targetBeforeStart', 'pathSetOutsideKpi']);
    assert.ok(before.slice(2).every((code) => code === 'periodOutsideKpi'));
    assert.deepEqual(issues(await run({ ...request, pathSet: '2027-01-15' })), [['inputError', 'pathSetOutsideKpi', '/pathSet']]);
    assert.deepEqual(issues(await run({ ...request, points: [...(request.points as Row[]), { period: '2027-01', path: 131000 }] })), [['inputError', 'periodOutsideKpi', '/points/12/period']]);
  });

  it('refuses a gap in the real levels, a path that does not run to the target, and a level that is not final', async () => {
    const request = await example('leads-since-launch', 'kpiStatus');
    const rows = request.points as Row[];
    const gap = rows.map((row, index) => (index === 3 ? { period: row.period, path: row.path } : row));
    assert.deepEqual(issues(await run({ ...request, points: gap })), [['refusal', 'cumulativeGap', '/points']]);
    const short = rows.map((row, index) => (index === 10 ? { period: row.period } : row));
    assert.deepEqual(issues(await run({ ...request, points: short })), [['refusal', 'pathIncomplete', '/points']]);
    const running = rows.map((row, index) => (index === 8 ? { ...row, actual: 117000 } : row));
    assert.deepEqual(issues(await run({ ...request, points: running })), [['refusal', 'blockAfterReference', '/points']]);
  });

  it('says when the target is reached, or missed once its day has passed', async () => {
    const request = await example('leads-since-launch', 'kpiStatus');
    const rows = request.points as Row[];
    const reached = rows.map((row, index) => (index < 8 ? row : { ...row, actual: 131000 + index }));
    const done = await run({ ...request, asOf: '2027-01-05', points: reached }, true);
    assert.match(done.svg!, />doel bereikt</);
    const missed = rows.map((row, index) => (index < 8 ? row : { ...row, actual: 116000 + index * 100 }));
    assert.match((await run({ ...request, asOf: '2027-01-05', points: missed }, true)).svg!, />doel niet gehaald</);
  });
});
