import {
  appliesTo,
  bestNext,
  coverage,
  type EdaResource,
  type EdaView,
  isComplete,
  isNeeded,
  levelOf,
  neededOf,
  PROBES,
  probesFor,
  type ProbeView,
  type ResultView,
  type RunCover,
  type RunView,
} from '@datahub/contracts/eda';
import type { EdaSource } from './catalogue.js';
import type { Eda, EdaState, Reading, Run } from './edas.js';

/** How many needed EDA-Probes a Resource has and how many are complete, from the fields its EDA-Probes last ran on. */
export type NeededOf = (resource: EdaResource, runs: readonly RunCover[]) => { total: number; complete: number };

/**
 * How many needed EDA-Probes are complete (FR-ED-05, DEC-ED-21): those Data Hub cannot run yet count as needed too, so
 * that no Resource reaches 4 · Explored before its model type can be fully explored (OP-ED-09).
 */
export const NEEDED: NeededOf = neededOf;

/** What each EDA-Probe last ran on, which is what it covers (DEC-ED-17, DEC-ED-21). */
export const coversOf = (state: EdaState): RunCover[] => state.lastRuns.map((run) => ({ probe: run.probe, fields: run.fields }));

/** Whether an EDA in progress is to become Explored: every needed EDA-Probe complete, and at least one needed (FR-ED-12). */
export function explorable(eda: Pick<Eda, 'status'>, needed: { total: number; complete: number }): boolean {
  return eda.status === 'inProgress' && needed.total > 0 && needed.complete === needed.total;
}

/** A result as the tab Steps shows it, with the reading of who works on the EDA, if given (FR-ED-11). */
function resultView(run: Run, readings: readonly Reading[]): ResultView[] {
  return run.results.map((result) => {
    const yours = readings.find((reading) => reading.probe === run.probe && reading.subject === result.subject);
    return { ...result, yours: yours ? { reading: yours.reading, by: yours.by, at: yours.at.toISOString() } : null };
  });
}

/**
 * A run as the tab Steps shows it, with the rows it ran on, the whole table too (OP-ED-12). The readings given are of
 * the results of the last run on the whole table: a run on a selection is shown without them.
 */
export function runView(run: Run, readings: readonly Reading[]): RunView {
  return {
    id: run.id,
    ranAt: run.ranAt.toISOString(),
    ranBy: run.ranBy,
    bytes: run.bytes,
    fields: run.fields,
    params: run.params,
    selection: run.selection,
    results: resultView(run, run.selection.where.length === 0 ? readings : []),
  };
}

/**
 * The EDA as the tab Steps and the Maturity of its Resource show it (FR-ED-04, TR-ED-01): its status, the EDA-Probes
 * of its model type with their level, whether Data Hub runs them, added and complete, their last run with its results
 * and readings, what it covers per field and in its four places, and the best next step (DEC-ED-16).
 */
export function viewOf(source: EdaSource, collection: { id: string; name: string } | null, eda: Eda, state: EdaState, needed: NeededOf = NEEDED): EdaView {
  const resource = source.resource;
  const covers = coversOf(state);
  const probes = probesFor(resource.modelType).map((key): ProbeView => {
    const added = state.probes.find((probe) => probe.probe === key);
    const last = state.lastRuns.find((run) => run.probe === key);
    return {
      key,
      level: levelOf(key, resource.modelType) ?? 'could',
      runs: PROBES[key].runs,
      needed: isNeeded(key, resource),
      added: added !== undefined,
      complete: isComplete(key, resource, covers),
      applies: appliesTo(key, resource),
      fields: added?.fields ?? [],
      params: added?.params ?? {},
      lastRun: last ? runView(last, state.readings) : null,
    };
  });
  return {
    resource: { ...resource, collection },
    status: eda.status,
    startedBy: eda.startedBy,
    startedAt: eda.startedAt.toISOString(),
    exploredAt: eda.exploredAt?.toISOString() ?? null,
    needed: needed(resource, covers),
    probes,
    coverage: coverage(resource, covers),
    next: bestNext(resource, covers),
  };
}
