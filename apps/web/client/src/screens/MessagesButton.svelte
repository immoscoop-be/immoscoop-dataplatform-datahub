<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';

  /** "Messages" in the head of a Collection, a Resource or a Lens, with their number: it opens the slide-in (FR-CV-07). */
  let { href, count }: { href: string; count: number | null } = $props();
</script>

<Button variant="outline" {href} title={t('messages.button.hint')}><Icon name="chat-circle-text-fill" />{t('messages.button')}{#if count}<Chip variant="count">{count}</Chip>{/if}</Button>
