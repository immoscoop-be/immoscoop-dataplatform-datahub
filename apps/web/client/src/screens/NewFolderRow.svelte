<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';

  /**
   * A folder being made, as the first row of a list (DEC-UX-156): its name, selected, to type over; Enter makes
   * it, Esc stops. A name has 1 to 80 characters.
   */
  let { columns, onmake, oncancel }: { columns: number; onmake: (name: string) => Promise<boolean>; oncancel: () => void } = $props();

  let name = $state(t('folder.new'));
  /** The name is ready to type over as soon as the row is there. */
  const chosen = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };
  let problem = $state('');
  let busy = $state(false);

  async function key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      oncancel();
    } else if (event.key === 'Enter' && !busy) {
      event.preventDefault();
      const wanted = name.trim();
      if (wanted.length < 1 || wanted.length > 80) {
        problem = t('folder.problem.name');
        return;
      }
      busy = true;
      problem = (await onmake(wanted)) ? '' : t('folder.problem.failed');
      busy = false;
    }
  }
</script>

<tr class="new">
  <td colspan={columns}>
    <span class="cell">
      <span class="icon"><Icon name="folder-simple-plus-fill" /></span>
      <input class="rename" bind:value={name} aria-label={t('folder.newLabel')} maxlength="80" {@attach chosen} onkeydown={key} disabled={busy} />
      <span class="meta">{problem || t('folder.newHint')}</span>
    </span>
  </td>
</tr>

<style>
  .cell { display: flex; align-items: center; gap: 8px; }
  .icon { display: inline-flex; font-size: 17px; color: var(--text-secondary); }
  .rename { font: inherit; font-weight: var(--weight-medium); color: var(--text-primary); background: var(--surface-solid); border: 1.5px solid var(--text-muted); border-radius: var(--radius-sm); padding: 4px 8px; width: 220px; }
  .rename:focus { outline: none; border-color: var(--text-secondary); }
</style>
