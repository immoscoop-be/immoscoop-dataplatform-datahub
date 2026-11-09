<script lang="ts">
  import Button from '../primitives/Button.svelte';
  import Icon from '../foundations/Icon.svelte';

  /**
   * The bar on top while editing in place (Edit bar): what happens, Cancel and Save. Save submits the
   * form it is in; while it saves, or while the form is not complete, it is off.
   */
  let {
    text,
    cancelLabel,
    saveLabel,
    saving = false,
    oncancel,
  }: { text: string; cancelLabel: string; saveLabel: string; saving?: boolean; oncancel: () => void } = $props();
</script>

<div class="edit-bar">
  <span class="icon"><Icon name="pencil-simple-fill" /></span>
  <p>{text}</p>
  <Button variant="quiet" onclick={oncancel}>{cancelLabel}</Button>
  <Button type="submit" disabled={saving}><Icon name="check-fill" />{saveLabel}</Button>
</div>

<style>
  .edit-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 16px; margin-bottom: 10px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .icon { display: inline-flex; color: var(--text-secondary); }
  p { flex: 1; margin: 0; font-size: var(--text-small); color: var(--text-secondary); }
</style>
