<script lang="ts" generics="K extends string">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';

  /**
   * A field to write a Message or a reply (Composer, FR-CV-07): with the kind to choose when a new Message
   * starts on an object, and under it who gets a notification. What it sends is posted on its object, for
   * everyone who may see it (DEC-CV-04).
   */
  let {
    label,
    kinds,
    kind = $bindable(),
    placeholder,
    notify,
    button,
    icon = 'paper-plane-tilt-fill',
    autofocus = false,
    oncancel,
    onsend,
  }: {
    /** Above the field, such as "New Message" or "Your reply". */
    label?: string;
    /** The kinds a new Message may be, by their names; none for a reply. */
    kinds?: readonly { value: K; label: string }[];
    kind?: K;
    placeholder: string;
    /** Who gets a notification of what is sent. */
    notify: string;
    button: string;
    icon?: IconName;
    autofocus?: boolean;
    oncancel?: () => void;
    /** Sends the words; true when they were posted, which empties the field. */
    onsend: (text: string) => Promise<boolean>;
  } = $props();

  let text = $state('');
  let busy = $state(false);
  let failed = $state(false);
  let field: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (autofocus) field?.focus();
  });

  async function send(): Promise<void> {
    if (!text.trim() || busy) return;
    busy = true;
    failed = false;
    const posted = await onsend(text.trim()).catch(() => false);
    busy = false;
    if (posted) text = '';
    else failed = true;
  }
</script>

<div class="composer">
  {#if label || kinds}
    <div class="top">
      {#if label}<span class="label">{label}</span>{/if}
      {#if kinds && kind !== undefined}<Segmented options={kinds} bind:value={kind} label={label ?? ''} />{/if}
    </div>
  {/if}
  <textarea
    bind:this={field}
    bind:value={text}
    {placeholder}
    aria-label={label ?? placeholder}
    maxlength="4000"
    rows="3"
    onkeydown={(event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
      if (event.key === 'Escape' && oncancel) oncancel();
    }}
  ></textarea>
  <div class="foot">
    <p class="meta" role={failed ? 'alert' : undefined}>
      {#if failed}{t('messages.failed.post')}{:else}<Icon name="bell-simple-fill" />{notify}{/if}
    </p>
    {#if oncancel}<Button variant="quiet" onclick={oncancel}>{t('collection.cancel')}</Button>{/if}
    <Button disabled={busy || !text.trim()} onclick={send}><Icon name={icon} />{button}</Button>
  </div>
</div>

<style>
  .composer { border-radius: var(--radius-lg); padding: 14px 16px; background: var(--surface-sub); }
  .top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .label { flex: 1; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-secondary); }
  textarea { width: 100%; min-height: 64px; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .foot { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
  .meta { flex: 1; margin: 0; display: flex; align-items: center; gap: 5px; line-height: 1.4; }
  .meta :global(.icon) { flex: none; }
</style>
