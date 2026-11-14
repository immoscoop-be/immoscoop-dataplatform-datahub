<script lang="ts">
  import type { At, Suggestion } from '@datahub/ui/components/SqlEditor.svelte';
  import { portal } from '@datahub/ui/foundations/portal.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';

  /**
   * A field named in the SQL, in a pop-out at the word (DEC-UX-221): its type, its role as partition or cluster column,
   * and its descriptions, the Business Description next to the one from dbt, as the suggestions show them (DEC-UX-115);
   * once for each Resource of the query that holds it, and each table outside Data Hub it reads (FR-SR-62). A click elsewhere, Escape, typing or scrolling closes it.
   */
  let { fields, at, onclose }: { fields: readonly Suggestion[]; at: At; onclose: () => void } = $props();

  let box: HTMLDivElement | undefined = $state();
  const WIDTH = 340;
  let place = $state({ left: 0, top: 0, below: true, arrow: 28 });

  $effect(() => {
    const height = box?.offsetHeight ?? 0;
    const middle = (at.left + at.right) / 2;
    const left = Math.min(Math.max(12, middle - 28), innerWidth - WIDTH - 12);
    const below = at.bottom + 10 + height < innerHeight;
    place = { left, top: below ? at.bottom + 10 : at.top - 10 - height, below, arrow: Math.max(14, middle - left) };
  });

  $effect(() => {
    const away = (event: Event) => {
      if (box && event.target instanceof Node && box.contains(event.target)) return;
      onclose();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key.length === 1) onclose();
    };
    // After the double-click that opened it.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', away, true);
      document.addEventListener('scroll', away, true);
      document.addEventListener('keydown', keys, true);
    });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('scroll', away, true);
      document.removeEventListener('keydown', keys, true);
    };
  });

  const role = (field: Suggestion) => (field.role?.kind === 'partition' ? t('editor.partition') : field.role?.kind === 'cluster' ? t('editor.cluster', { place: String(field.role.place) }) : null);
</script>

<div
  class="pop"
  class:above={!place.below}
  role="dialog"
  aria-label={fields[0]?.name ?? ''}
  bind:this={box}
  {@attach portal}
  style:left="{place.left}px"
  style:top="{place.top}px"
  style:width="{WIDTH}px"
  style:--arrow="{place.arrow}px"
>
  {#each fields as field (field.resource)}
    <div class="block">
      <div class="head">
        <span class="name">{field.name}</span>
        <span class="meta">{field.type ? `${field.type} · ` : ''}<span class:mono={field.outside}>{field.resource}</span></span>
        {#if role(field)}<span class="role">{role(field)}</span>{/if}
      </div>
      <!-- A table outside Data Hub has no Owner, so no Business Description to miss (FR-SR-62). -->
      {#if field.businessDescription}
        <p><OriginTag origin="owner" /><span>{field.businessDescription}</span></p>
      {:else if !field.outside}
        <p class="none">{t('field.noBusiness')}</p>
      {/if}
      <p class="dbt"><OriginTag origin="dbt" /><span>{field.description || '–'}</span></p>
    </div>
  {/each}
</div>

<style>
  .pop { position: fixed; z-index: 40; max-width: calc(100vw - 24px); padding: 10px 12px; border-radius: var(--radius-lg); background: var(--surface-solid); border: 1px solid var(--tint-active);
    box-shadow: var(--sheet-shadow); font-size: var(--text-meta); line-height: 1.5; color: var(--text-primary); --card: var(--surface-sub); }
  .pop::before { content: ''; position: absolute; left: var(--arrow); top: -7px; width: 12px; height: 12px; background: var(--surface-solid); transform: translateX(-50%) rotate(45deg);
    border-left: 1px solid var(--tint-active); border-top: 1px solid var(--tint-active); }
  .pop.above::before { top: auto; bottom: -7px; border: 0; border-right: 1px solid var(--tint-active); border-bottom: 1px solid var(--tint-active); }
  .block + .block { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--tint-hover); }
  .head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .name, .mono { font-family: var(--font-mono); }
  .meta { color: var(--text-muted); }
  .role { font-size: 10px; background: var(--tint-active); padding: 1px 7px; border-radius: var(--radius-pill); }
  p { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin: 8px 0 0; }
  .dbt { color: var(--text-secondary); }
  .none { color: var(--text-muted); }
</style>
