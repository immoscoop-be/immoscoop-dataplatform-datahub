<script lang="ts">
  import Icon from '../foundations/Icon.svelte';

  /**
   * A field that filters its list as the User types (Search, Filter a list). It stands out from the
   * surface it is on: a card in the panel, the tint of a sheet, or white on a tile.
   */
  let {
    value = $bindable(''),
    placeholder,
    surface = 'card',
  }: { value?: string; placeholder: string; surface?: 'card' | 'sub' | 'solid' } = $props();
</script>

<label class="search {surface}">
  <span class="glass"><Icon name="magnifying-glass-fill" /></span>
  <input type="search" bind:value {placeholder} aria-label={placeholder} />
</label>

<style>
  .search { display: flex; align-items: center; gap: 8px; border-radius: var(--radius-field); padding: 9px 12px; color: var(--text-muted); }
  .card { background: var(--card); }
  .sub { background: var(--surface-sub); }
  .solid { background: var(--surface-solid); }
  .glass { display: inline-flex; font-size: 15px; }
  input { all: unset; flex: 1; min-width: 0; font: var(--text-small) var(--font-family); color: var(--text-primary); }
  input::placeholder { color: var(--text-muted); }
</style>
