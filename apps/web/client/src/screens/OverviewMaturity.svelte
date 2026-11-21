<script lang="ts" module>
  import type { EdaView } from '@datahub/contracts/eda';

  /** The EDA of a Resource on its ladder, for a User who may explore Resources (`eda.use`, FR-ED-01, FR-ED-02). */
  export interface LadderEda {
    /** Its EDA: undefined while it is read, null when it has none. */
    view: EdaView | null | undefined;
    /** Starts it, and opens it in the section EDA; answers whether it started. */
    onstart: () => Promise<boolean>;
    /** The address of its EDA. */
    href: string;
  }
</script>

<script lang="ts">
  import MaturityLadder from '@datahub/ui/components/MaturityLadder.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { checklistOf, type StepPlace } from '../lib/journey.js';

  /**
   * The Maturity part of the Overview (DEC-UX-175, FR-MR-16): the ladder, and beside it every Level from 1 · Available
   * to 5 · Monitored. A Level passed says how it was reached, with who and when; the one it is at stands out; one still
   * to reach says what it takes and who does it, with "Publish" for its Owner. The Publication has no tile of its own:
   * who published and confirmed it stands with 3 · Confirmed, with what changed since. For a User who may explore
   * Resources, 4 · Explored offers Start the EDA at 3 · Confirmed, and while its EDA is in progress says how many needed
   * EDA-Probes are complete, with a bar, and Open its EDA (DEC-UX-320, FR-ED-02).
   */
  let {
    resource,
    onpublish,
    onpart,
    eda,
  }: {
    resource: ResourceDetail;
    onpublish: (() => void) | undefined;
    /** Goes to where an open step is done (DEC-MR-16). */
    onpart?: (place: StepPlace) => void;
    /** Its EDA, for a User with `eda.use`; without it the Levels read as before (FR-ED-01). */
    eda?: LadderEda;
  } = $props();

  let starting = $state(false);
  let startFailed = $state(false);
  async function start(): Promise<void> {
    if (!eda || starting) return;
    starting = true;
    startFailed = false;
    startFailed = !(await eda.onstart());
    starting = false;
  }
  /** The EDA in progress at 3 · Confirmed: 4 · Explored reads it, in the colour of what is under way. */
  const exploring = $derived(eda?.view && eda.view.status === 'inProgress' && resource.level === 3 ? eda.view : null);

  /** What publishing still takes: the steps required to publish, each done or open (DEC-MR-15, DEC-MR-16). */
  const checks = $derived(resource.journey && !resource.published ? checklistOf(resource.journey) : null);

  type State = 'passed' | 'at' | 'next' | 'later';
  const ICONS: Record<State, IconName> = { passed: 'check-circle-fill', at: 'seal-check-fill', next: 'circle-dashed', later: 'circle-dashed' };
  const TAGS: Record<State, string> = { passed: 'maturity.passed', at: 'maturity.at', next: 'maturity.next', later: 'maturity.later' };
  const CHANGE_KEYS = { added: 'resource.change.added', removed: 'resource.change.removed', retyped: 'resource.change.retyped' } as const;
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));

  const stateOf = (level: number): State => (level < resource.level ? 'passed' : level === resource.level ? 'at' : level === resource.level + 1 ? 'next' : 'later');
  const described = $derived(resource.fields.filter((field) => field.description.trim() !== '').length);

  /** What a Level says: how it was reached, once passed, or what it takes. */
  function textOf(level: number, reached: boolean): string {
    const publication = resource.publication;
    switch (level) {
      case 1:
        return t('maturity.1.done', { date: day(resource.registeredAt), exposure: resource.exposures[0] ?? '', project: resource.projectName ?? resource.projectId });
      case 2:
        return reached
          ? t('maturity.2.done', { count: described, total: resource.fields.length })
          : `${t('maturity.2.todo')} ${t(resource.description.trim() ? 'maturity.2.nowTable' : 'maturity.2.nowNoTable', { count: described, total: resource.fields.length })}`;
      case 3:
        return reached && publication
          ? t('maturity.3.done', { published: day(publication.publishedAt), by: publication.publishedBy, confirmed: day(publication.confirmedAt), confirmedBy: publication.confirmedBy })
          : t('maturity.3.todo');
      case 4:
        return t(reached ? 'maturity.4.done' : 'maturity.4.todo');
      default:
        return t(reached ? 'maturity.5.done' : 'maturity.5.todo');
    }
  }

  const levels = $derived([1, 2, 3, 4, 5].map((level) => ({ level, state: stateOf(level), text: textOf(level, level <= resource.level) })));
</script>

<div class="layout">
  <SubTile label={t('overview.level')}>
    <div class="ladder"><MaturityLadder level={resource.level} /></div>
    <div class="current">{levelName(resource.level)}</div>
  </SubTile>
  <ol class="levels">
    {#each levels as { level, state, text } (level)}
      {@const progress = level === 4 && exploring !== null}
      <li class="level {state}" class:progress>
        <Icon name={progress ? 'circle-half' : ICONS[state]} />
        <div class="what">
          <div class="name"><b>{levelName(level)}</b><span class="tag">{t(progress ? 'maturity.4.eda.inProgress' : TAGS[state])}</span></div>
          {#if level === 4 && eda && state === 'next' && exploring}
            <p>{t('maturity.4.eda.progress', { date: day(exploring.startedAt), name: exploring.startedBy.name, complete: exploring.needed.complete, total: exploring.needed.total })}</p>
            <div class="bar" role="img" aria-label={t('eda.setup.progress', { complete: exploring.needed.complete, total: exploring.needed.total })}>
              {#each Array.from({ length: exploring.needed.total }, (_, index) => index < exploring.needed.complete) as on, index (index)}<span class:on></span>{/each}
            </div>
            <p><a class="open" href={eda.href}><Icon name="arrow-right" /><span>{t('maturity.4.eda.open')}</span></a></p>
          {:else if level === 4 && eda && state === 'next'}
            <p>{t('maturity.4.eda.todo')}</p>
            {#if eda.view === undefined}
              <Loading inline />
            {:else if eda.view === null}
              <div class="act"><Button disabled={starting} onclick={start}><Icon name="binoculars" />{t('maturity.4.eda.start')}</Button></div>
              {#if startFailed}<p class="failed" role="alert">{t('maturity.4.eda.failed')}</p>{/if}
            {/if}
          {:else}
            <p>{text}</p>
            {#if level === 4 && eda?.view && state !== 'next' && state !== 'later'}
              <p><a class="open" href={eda.href}><Icon name="arrow-right" /><span>{t('maturity.4.eda.open')}</span></a></p>
            {/if}
          {/if}
          {#if level === 3 && resource.publication && resource.changes.length > 0}
            <p class="changed">
              <Icon name="warning-circle-fill" />
              <span>{t('overview.changed')}: {resource.changes.map((change) => t(CHANGE_KEYS[change.change], { field: change.field, old: change.old ?? '', new: change.new ?? '', date: day(change.at) })).join('; ')}</span>
            </p>
          {/if}
          {#if level === 3 && state === 'next' && checks}
            <p>{t('maturity.3.steps', { done: checks.done.length, total: checks.required.length })}</p>
            <ul class="steps">
              {#each checks.required as step (step.step)}
                <li class:open={!step.done}>
                  <Icon name={step.done ? 'check-circle-fill' : 'warning-circle-fill'} />{step.name}
                  {#if !step.done && step.place && onpart}<button type="button" class="go" onclick={() => onpart(step.place as StepPlace)}>{t('publish.goTo')}</button>{/if}
                </li>
              {/each}
            </ul>
            {#if checks.open.length > 0}<p class="claude">{t('maturity.3.claude')}</p>{/if}
          {/if}
          {#if level === 3 && state === 'next' && onpublish}
            <div class="act"><Button variant="outline" onclick={onpublish}><Icon name="globe-simple-fill" />{t('resource.publish')}</Button></div>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
</div>
<p class="beta">{t('maturity.beta')}</p>

<style>
  .layout { display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); gap: 16px; align-items: start; }
  .ladder { max-width: 240px; }
  .current { font-size: var(--text-body); font-weight: var(--weight-medium); margin-top: 6px; }
  .levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .level { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .level > :global(.icon) { font-size: 18px; margin-top: 1px; flex: none; color: var(--text-secondary); }
  .level.at { outline: 1.5px solid var(--text-primary); outline-offset: -1.5px; }
  .level.at > :global(.icon) { color: var(--text-primary); }
  .level.next > :global(.icon), .level.later > :global(.icon) { color: var(--text-muted); }
  .level.later { background: none; outline: 1px dashed var(--tint-active); outline-offset: -1px; }
  .what { flex: 1; min-width: 0; }
  .name { display: flex; align-items: baseline; gap: 8px; }
  .name b { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .tag { font-size: 10px; font-weight: var(--weight-medium); color: var(--text-muted); }
  .at .tag { color: var(--text-primary); }
  p { margin: 4px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .next p, .later p { color: var(--text-muted); }
  .changed { display: flex; align-items: flex-start; gap: 6px; color: var(--signal-warn); }
  .changed :global(.icon) { margin-top: 3px; flex: none; }
  .act { margin-top: 8px; }
  .steps { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; font-size: var(--text-small); color: var(--text-secondary); }
  .steps li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .steps li :global(.icon) { font-size: 15px; color: var(--text-secondary); }
  .steps li.open :global(.icon) { color: var(--signal-warn); }
  .go { all: unset; cursor: pointer; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .go:focus-visible { outline: 2px solid var(--text-secondary); }
  .claude { font-size: var(--text-meta); }
  .progress > :global(.icon), .progress .tag { color: var(--signal-warn); }
  .bar { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; max-width: 360px; margin-top: 8px; }
  .bar span { height: 8px; border-radius: var(--radius-mark); background: color-mix(in srgb, var(--text-muted) 22%, transparent); }
  .bar span.on { background: var(--col-teal); }
  .open { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .open:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .failed { color: var(--signal-warn); }
  .beta { margin: 12px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
