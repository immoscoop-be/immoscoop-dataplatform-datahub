<script lang="ts">
  import { moveFocus } from '../foundations/roving.js';
  import { t } from '../foundations/texts.svelte.js';
  import CollectionIcon from '../marks/CollectionIcon.svelte';
  import Search from './Search.svelte';

  /**
   * The line icons of Phosphor, searched by name, one chosen (Icon picker, DEC-CO-19). Before anything
   * is typed, it suggests icons for the functional domains of Immoscoop. The list to search is large,
   * so it is loaded when the picker opens, never with the page; the chosen icon always stays in view.
   */
  let { value = $bindable(null) }: { value?: string | null } = $props();

  let query = $state('');
  let find: ((query: string, limit?: number) => string[]) | undefined = $state();
  $effect(() => {
    import('@datahub/contracts/collection-icons').then((icons) => (find = icons.findCollectionIcons));
  });

  const found = $derived(find ? find(query, 48) : []);
  const shown = $derived(value && !found.includes(value) && !query.trim() ? [value, ...found] : found);
  const spoken = (name: string) => name.replaceAll('-', ' ');

  function key(event: KeyboardEvent) {
    const index = moveFocus(event, '[role="radio"]');
    const next = index === undefined ? undefined : shown[index];
    if (next) {
      value = next;
    }
  }
</script>

<Search bind:value={query} placeholder={t('icon.search')} surface="solid" />
<div class="grid" role="radiogroup" aria-label={t('icon.label')} tabindex="-1" onkeydown={key}>
  {#each shown as name, index (name)}
    <button
      type="button"
      role="radio"
      aria-checked={name === value}
      aria-label={spoken(name)}
      title={spoken(name)}
      class:on={name === value}
      tabindex={name === value || (!shown.includes(value ?? '') && index === 0) ? 0 : -1}
      onclick={() => (value = name)}
    >
      <CollectionIcon {name} />
    </button>
  {/each}
</div>
{#if find && query.trim() && shown.length === 0}
  <p class="none">{t('icon.none', { query: query.trim() })}</p>
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, 36px); gap: 6px; margin-top: 8px; max-height: 220px; overflow-y: auto; padding: 2px; }
  button { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); border: 0;
    background: var(--surface-solid); color: var(--text-secondary); cursor: pointer; padding: 0; }
  button:hover { color: var(--text-primary); }
  button.on { outline: 2px solid var(--text-primary); color: var(--text-primary); }
  button :global(.collection-icon) { width: auto; height: auto; font-size: 18px; color: inherit; }
  .none { margin: 8px 0 0; font-size: var(--text-meta); color: var(--text-muted); }
</style>
