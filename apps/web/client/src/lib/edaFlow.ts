import { EDA_STEPS, PROBE_KEYS, PROBES, type EdaView, type ProbeBlock, type ProbeKey, type ProbeView } from '@datahub/contracts/eda';
import type { FlowStep } from '@datahub/ui/containers/FlowBox.svelte';
import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
import { overallReading, PROBE_ABOUT, PROBE_TEXTS, READING_LOOK, STEP_TEXTS, stillMissing } from './eda.js';
import { askOf, cardSentence, saidText } from './edaWords.js';

/**
 * The guide of an EDA in the Flow Box (DEC-UX-327, FR-ED-14): the flow Set up its EDA, one step per needed EDA-Probe in
 * the order of the EDA-Steps and grouped under their names, read from the EDA each time it changes (TR-ED-09). A step
 * is done once its EDA-Probe is complete, open with what it misses, or coming while Data Hub does not run it, and still
 * counted (DEC-ED-27). The step to do now is the best next step of the EDA, as its page proposes.
 */

/** How each EDA-Probe Data Hub runs is done, on its detail. */
const HOW: Readonly<Partial<Record<ProbeKey, string>>> = {
  grainHolds: 'eda.flow.how.grainHolds',
  nullsPerKeyField: 'eda.flow.how.nullsPerKeyField',
  volumeOverTime: 'eda.flow.how.volumeOverTime',
  distributionOfNumbers: 'eda.flow.how.distributionOfNumbers',
  distributionOfCategories: 'eda.flow.how.distributionOfCategories',
  dateRange: 'eda.flow.how.dateRange',
  disguisedNulls: 'eda.flow.how.disguisedNulls',
};

/** The Learning Card of an EDA-Probe, where one is written. */
export const PROBE_CARDS: Readonly<Partial<Record<ProbeKey, string>>> = { grainHolds: '2.3.5' };

/** What a needed EDA-Probe that cannot run here misses, in a few words, and how that is done. */
const BLOCKED: Readonly<Record<ProbeBlock, { said: string; how: string }>> = {
  noGrain: { said: 'eda.flow.block.noGrain', how: 'eda.block.noGrain' },
  noRoleDate: { said: 'eda.flow.block.noRoleDate', how: 'eda.block.noRoleDate' },
  nothing: { said: 'eda.flow.block.nothing', how: 'eda.block.nothing' },
};

export interface EdaFlowOf {
  steps: FlowStep[];
  /** The step to do now: the best next step of the EDA, while it is open. */
  now: ProbeKey | undefined;
  /** How far it is, in words. */
  progress: string;
  /** What is left, under the steps. */
  foot: string | undefined;
}

/** The place of an EDA-Probe in the guide: its EDA-Step first, then the order of the table of DEC-ED-11. */
const orderOf = (probe: Pick<ProbeView, 'key'>) => EDA_STEPS.indexOf(PROBES[probe.key].step) * PROBE_KEYS.length + PROBE_KEYS.indexOf(probe.key);

/** What a step of an open EDA-Probe misses (DEC-UX-327): not added yet, not run yet, or set on part of what it needs. */
function misses(probe: ProbeView): string {
  const block = probe.applies.block;
  if (block) return t(BLOCKED[block].said);
  if (!probe.added) return t('eda.flow.notAdded');
  const missing = stillMissing(probe);
  if (!probe.lastRun || missing.length === 0) return t('eda.flow.notRun');
  const total = probe.applies.needs.length;
  const values = { set: total - missing.length, total, fields: missing.join(', ') };
  return t(PROBES[probe.key].place === 'column' ? 'eda.flow.part.keyFields' : 'eda.flow.part.fields', values);
}

/**
 * The steps of the guide of an EDA, read from it (DEC-UX-306): each with its number, its name and its EDA-Step; done with
 * Data Hub's reading and its result in a few words; open with what it misses; or coming. Unfolded, What, Why and How,
 * its Learning Card where one is written, and Open the EDA-Probe, except on its own detail, which is open on the page.
 */
export function edaFlowOf(view: EdaView, options: { here?: ProbeKey | null; cardTitle?: (card: string) => string | undefined } = {}): EdaFlowOf {
  const language = currentLanguage();
  const grain = view.resource.fields.filter((field) => field.grain).map((field) => field.name).join(', ');
  const needed = view.probes.filter((probe) => probe.needed).sort((a, b) => orderOf(a) - orderOf(b));
  const steps = needed.map((probe, index): FlowStep => {
    const done = probe.complete;
    const coming = !probe.runs && !done;
    const about = PROBE_ABOUT[probe.key];
    const reading = done ? overallReading(probe.lastRun?.results ?? []) : null;
    const block = probe.applies.block;
    const how = HOW[probe.key];
    const cardNumber = PROBE_CARDS[probe.key];
    const cardTitle = cardNumber ? options.cardTitle?.(cardNumber) : undefined;
    const here = options.here === probe.key;
    return {
      id: probe.key,
      name: t(PROBE_TEXTS[probe.key]),
      group: t(STEP_TEXTS[PROBES[probe.key].step].name),
      number: index + 1,
      done,
      coming,
      warn: !done && !coming,
      said: done ? saidText(cardSentence(probe, view, language)) || t('eda.flow.done') : coming ? t('eda.flow.coming') : misses(probe),
      ...(reading ? { tag: { text: t(READING_LOOK[reading].text), tone: READING_LOOK[reading].tone } } : {}),
      what: about && !coming ? t(about.does, { grain }) : saidText([askOf(probe.key, view.resource)]),
      ...(about && !coming ? { why: t(about.why) } : {}),
      ...(coming
        ? { how: t('eda.detail.coming.text') }
        : block
          ? { how: t(BLOCKED[block].how) }
          : how
            ? { how: t(how, { date: probe.applies.fields[0] ?? '' }) }
            : {}),
      ...(cardNumber && cardTitle ? { card: { number: cardNumber, title: cardTitle } } : {}),
      ...(probe.runs && !here ? { go: t('eda.flow.go') } : {}),
      here,
    };
  });
  const done = steps.filter((step) => step.done).length;
  const open = steps.length - done;
  const coming = steps.filter((step) => step.coming).length;
  const next = view.next;
  const now = next !== null && steps.some((step) => step.id === next && !step.done) ? next : undefined;
  return {
    steps,
    now,
    progress: t('eda.setup.progress', { complete: done, total: steps.length }),
    foot: open === 0 ? undefined : coming > 0 ? t('eda.flow.foot.coming', { count: open, coming }) : t('eda.flow.foot', { count: open }),
  };
}
