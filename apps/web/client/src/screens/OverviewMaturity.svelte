<script lang="ts">
  import MaturityLadder from '@datahub/ui/components/MaturityLadder.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';

  /**
   * The Maturity part of the Overview (DEC-UX-175, FR-MR-16): the ladder, and beside it every Level from 1 · Available
   * to 5 · Monitored. A Level passed says how it was reached, with who and when; the one it is at stands out; one still
   * to reach says what it takes and who does it, with "Publish" for its Owner. The Publication has no tile of its own:
   * who published and confirmed it stands with 3 · Confirmed, with what changed since.
   */
  let { resource, onpublish }: { resource: ResourceDetail; onpublish: (() => void) | undefined } = $props();

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
      <li class="level {state}">
        <Icon name={ICONS[state]} />
        <div class="what">
          <div class="name"><b>{levelName(level)}</b><span class="tag">{t(TAGS[state])}</span></div>
          <p>{text}</p>
          {#if level === 3 && resource.publication && resource.changes.length > 0}
            <p class="changed">
              <Icon name="warning-circle-fill" />
              <span>{t('overview.changed')}: {resource.changes.map((change) => t(CHANGE_KEYS[change.change], { field: change.field, old: change.old ?? '', new: change.new ?? '', date: day(change.at) })).join('; ')}</span>
            </p>
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
  .beta { margin: 12px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
