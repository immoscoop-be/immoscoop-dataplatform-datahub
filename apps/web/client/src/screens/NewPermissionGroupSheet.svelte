<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { PermissionGroup } from '../lib/identity.js';

  /**
   * A new Permission group (FR-PL-10): its name, a sentence of what it allows, and the group it starts as a copy of,
   * or nothing, with every Permission no. It starts without Users, who join it one by one on Users. "Duplicate" opens
   * it as a copy of the group it was pressed on.
   */
  let {
    groups,
    from = null,
    name: initialName = '',
    sentence: initialSentence = '',
    onmake,
    onclose,
  }: {
    groups: readonly PermissionGroup[];
    /** The group it starts as a copy of; null for every Permission no. */
    from?: string | null;
    name?: string;
    sentence?: string;
    /** Makes it; answers a sentence to show when it was refused. */
    onmake: (fields: { name: string; sentence: string; from: string | null }) => Promise<string | undefined>;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(initialName);
  // svelte-ignore state_referenced_locally
  let sentence = $state(initialSentence);
  // svelte-ignore state_referenced_locally
  let copy: string = $state(from ?? '');
  let making = $state(false);
  let problem = $state('');

  async function make(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    making = true;
    problem = '';
    problem = (await onmake({ name: name.trim(), sentence: sentence.trim(), from: copy || null })) ?? '';
    making = false;
  }
</script>

<Sheet title={t('groups.new')} {onclose}>
  {#snippet lead()}<span class="sign"><Icon name="shield-check-fill" /></span>{/snippet}
  <form id="new-permission-group" class="body" onsubmit={make}>
    <Field label={t('groups.new.name')}><input {...NO_PASSWORD_MANAGER} type="text" bind:value={name} maxlength="60" required /></Field>
    <Field label={t('groups.new.sentence')}><input {...NO_PASSWORD_MANAGER} type="text" bind:value={sentence} maxlength="200" /></Field>
    <div class="label">{t('groups.new.from')}</div>
    <div class="options" role="radiogroup" aria-label={t('groups.new.from')}>
      {#each groups as group (group.id)}
        <label class="option">
          <input type="radio" name="copy-of" value={group.id} bind:group={copy} />
          <span><span class="title">{group.name}</span><span class="meta line">{group.sentence}</span></span>
        </label>
      {/each}
      <label class="option">
        <input type="radio" name="copy-of" value="" bind:group={copy} />
        <span><span class="title">{t('groups.new.nothing')}</span><span class="meta line">{t('groups.new.nothing.text')}</span></span>
      </label>
    </div>
  </form>
  {#snippet foot()}
    <p class="meta note" class:problem role={problem ? 'alert' : undefined}>{problem || t('groups.new.note')}</p>
    <Button variant="quiet" onclick={onclose}>{t('admin.cancel')}</Button>
    <Button type="submit" form="new-permission-group" disabled={making || !name.trim()}>{t('groups.new.make')}</Button>
  {/snippet}
</Sheet>

<style>
  .sign { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 6px 12px; }
  .label { margin: 6px 0; font-size: var(--text-meta); color: var(--text-muted); }
  .options { display: grid; gap: 4px; }
  .option { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 12px; border-radius: var(--radius-md); cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option:has(input:checked) { background: var(--surface-sub); outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; }
  .option input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .line { display: block; }
  .note { flex: 1; margin: 0; line-height: 1.5; }
  .problem { color: var(--signal-urgent); }
</style>
