<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { type Step, STEP_TEXTS } from '../lib/learning.js';

  /**
   * "Next", always in the same place (FR-LR-27): the name of the next step and one sentence on what it brings,
   * the button on the right; it never waits for an answer. On a page it is held to the foot of the window; in
   * the floating window it stands in its foot. You can now has none.
   */
  let { next, compact = false, ongo, children }: { next: Step | undefined; compact?: boolean; ongo: (step: Step) => void; children?: Snippet } = $props();

  const NEXT_TEXTS: Partial<Record<Step, string>> = { core: 'learning.next.core', see: 'learning.next.see', check: 'learning.next.check', can: 'learning.next.can' };
</script>

{#if next || children}
  <nav class="next" class:compact aria-label={t('learning.next')}>
    {#if next}
      <div class="next-in">
        <div class="next-text"><b>{t('learning.next.to', { step: t(STEP_TEXTS[next]) })}</b>{t(NEXT_TEXTS[next] ?? 'learning.next.can')}</div>
        <Button onclick={() => ongo(next)}>{t('learning.next')}<Icon name="arrow-right" /></Button>
      </div>
    {/if}
    {@render children?.()}
  </nav>
{/if}

<style>
  .next { position: sticky; bottom: -26px; margin: 22px 0 -26px; padding-bottom: 26px; }
  .next-in { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 18px; border-radius: var(--radius-lg); background: var(--surface-solid); outline: 1px solid var(--tint-hover); }
  .next-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.45; color: var(--text-secondary); }
  .next-text b { display: block; font-size: 14px; color: var(--text-primary); font-weight: var(--weight-medium); margin-bottom: 1px; }
  .compact { position: static; flex: 1; margin: 0; padding: 0; }
  .compact .next-in { padding: 0; background: none; outline: 0; }
</style>
