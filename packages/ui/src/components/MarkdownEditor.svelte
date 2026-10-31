<script lang="ts">
  import { tick } from 'svelte';
  import type { IconName } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';
  import IconButton from '../primitives/IconButton.svelte';
  import Segmented from '../primitives/Segmented.svelte';
  import MarkdownText from './MarkdownText.svelte';

  /**
   * A text in Markdown being written (Markdown editor, DEC-UX-158): buttons for a heading, bold, italic, a
   * list and a link, each around what is selected; Write and Preview, which shows it as the page will; and
   * under it what Markdown it takes, with a note of where it is shown.
   */
  let {
    id,
    value = $bindable(),
    label,
    note,
    maxlength,
  }: {
    id: string;
    value: string;
    label: string;
    /** Where the text is shown, after what Markdown it takes. */
    note?: string;
    maxlength?: number;
  } = $props();

  let view: 'write' | 'preview' = $state('write');
  let area: HTMLTextAreaElement | undefined = $state();

  /** Puts `before` and `after` around the selection, or around `empty` when nothing is selected, and selects it. */
  async function wrap(before: string, after: string, empty: string) {
    if (!area) return;
    const [start, end] = [area.selectionStart, area.selectionEnd];
    const chosen = value.slice(start, end) || empty;
    value = `${value.slice(0, start)}${before}${chosen}${after}${value.slice(end)}`;
    await select(start + before.length, start + before.length + chosen.length);
  }

  /** Starts every line of the selection with `mark`, or takes it away when each starts with it already. */
  async function lines(mark: string) {
    if (!area) return;
    const from = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
    const next = value.indexOf('\n', Math.max(area.selectionEnd, area.selectionStart));
    const to = next === -1 ? value.length : next;
    const chosen = value.slice(from, to).split('\n');
    const marked = chosen.every((line) => line.startsWith(mark));
    const changed = chosen.map((line) => (marked ? line.slice(mark.length) : `${mark}${line.replace(/^(#{1,6}|[-*+]|\d+[.)])\s+/, '')}`)).join('\n');
    value = `${value.slice(0, from)}${changed}${value.slice(to)}`;
    await select(from, from + changed.length);
  }

  async function link() {
    if (!area) return;
    const [start, end] = [area.selectionStart, area.selectionEnd];
    const text = value.slice(start, end) || t('markdown.linkText');
    const address = 'https://';
    value = `${value.slice(0, start)}[${text}](${address})${value.slice(end)}`;
    const at = start + text.length + 3;
    await select(at, at + address.length);
  }

  async function select(start: number, end: number) {
    await tick();
    area?.focus();
    area?.setSelectionRange(start, end);
  }

  const BUTTONS: readonly { icon: IconName; key: string; act: () => Promise<void> }[] = [
    { icon: 'text-h', key: 'markdown.heading', act: () => lines('### ') },
    { icon: 'text-b', key: 'markdown.bold', act: () => wrap('**', '**', t('markdown.boldText')) },
    { icon: 'text-italic', key: 'markdown.italic', act: () => wrap('_', '_', t('markdown.italicText')) },
    { icon: 'list-bullets', key: 'markdown.list', act: () => lines('- ') },
    { icon: 'link', key: 'markdown.link', act: link },
  ];
</script>

<div class="editor">
  <div class="bar" role="toolbar" aria-label={t('markdown.toolbar', { label })}>
    {#each BUTTONS as button (button.key)}
      <IconButton icon={button.icon} label={t(button.key)} disabled={view === 'preview'} onclick={() => button.act()} />
    {/each}
    <span class="grow"></span>
    <Segmented
      options={[
        { value: 'write', label: t('markdown.write') },
        { value: 'preview', label: t('markdown.preview') },
      ]}
      bind:value={view}
      label={t('markdown.view')}
      surface="sub"
    />
  </div>
  {#if view === 'write'}
    <textarea {id} bind:this={area} bind:value rows="9" {maxlength} aria-label={label} spellcheck="true"></textarea>
  {:else}
    <div class="preview">
      {#if value.trim()}<MarkdownText source={value} />{:else}<p class="empty">{t('markdown.nothing')}</p>{/if}
    </div>
  {/if}
</div>
<p class="help">
  {t('markdown.help')} <code>### {t('markdown.headingText')}</code>, <code>**{t('markdown.boldText')}**</code>, <code>_{t('markdown.italicText')}_</code>, <code>- {t('markdown.listText')}</code>,
  <code>[{t('markdown.linkText')}]({t('markdown.address')})</code>.{#if note}&nbsp;{note}{/if}
</p>

<style>
  .editor { border-radius: var(--radius-field); background: var(--surface-solid); outline: 1px solid var(--tint-active); overflow: hidden; }
  .editor:focus-within { outline: 1.5px solid var(--text-muted); }
  .bar { display: flex; align-items: center; gap: 2px; padding: 4px 6px; border-bottom: 1px solid var(--tint-hover); }
  .bar :global(.icon-button) { width: 28px; height: 28px; font-size: 15px; }
  .grow { flex: 1; }
  .editor textarea { display: block; width: 100%; box-sizing: border-box; border: 0; resize: vertical; min-height: 170px; padding: 10px 12px; font: var(--text-small) var(--font-mono); line-height: 1.6; background: none; color: var(--text-primary); }
  .editor textarea:focus { outline: none; }
  .preview { min-height: 170px; padding: 10px 12px; box-sizing: border-box; }
  .empty { margin: 0; font-size: var(--text-small); color: var(--text-muted); }
  .help { margin: 6px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.6; }
  .help code { font-family: var(--font-mono); }
</style>
