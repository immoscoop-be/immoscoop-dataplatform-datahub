<script lang="ts">
  import Icon from '../foundations/Icon.svelte';

  /** An icon button next to what it copies, such as a Key (Copy). */
  let { text, label }: { text: string; label: string } = $props();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // A browser that refuses the clipboard leaves the text to be selected by hand.
    }
  }
</script>

<button type="button" class="copy" aria-label={label} title={label} onclick={copy}><Icon name="copy-fill" /></button>

<style>
  .copy { width: 22px; height: 22px; border-radius: var(--radius-sm); border: 0; background: none; display: inline-flex; align-items: center; justify-content: center;
    color: var(--text-secondary); cursor: pointer; font-size: 13px; vertical-align: middle; }
  .copy:hover { background: var(--surface-float-hover); }
</style>
