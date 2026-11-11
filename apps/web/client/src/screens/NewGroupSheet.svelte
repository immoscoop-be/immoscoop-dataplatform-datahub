<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import { newManagerChoices } from '../lib/groups.js';
  import type { GroupFields, GroupSummary } from '../lib/identity.js';

  /**
   * A new Group (FR-UM-13): its name, a sentence on who is in it, and the Group that manages it, chosen from the
   * Groups the User is in, or the new Group itself, so that a User in no Group can still make their first
   * (OP-UX-71). The User is its first member, and adds colleagues once it is made.
   */
  let {
    mine,
    onmake,
    onclose,
  }: {
    /** The Groups the User is in. */
    mine: readonly GroupSummary[];
    /** Makes it; answers a sentence to show when it was refused. */
    onmake: (fields: GroupFields) => Promise<string | undefined>;
    onclose: () => void;
  } = $props();

  const choices = $derived(newManagerChoices(mine));
  let name = $state('');
  let sentence = $state('');
  // svelte-ignore state_referenced_locally
  let managedBy: string = $state(choices[0]?.id ?? 'itself');
  let making = $state(false);
  let problem = $state('');

  async function make(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    making = true;
    problem = (await onmake({ name: name.trim(), sentence: sentence.trim(), managedBy })) ?? '';
    making = false;
  }
</script>

<Sheet title={t('group.new')} {onclose}>
  {#snippet lead()}<span class="sign"><Icon name="users-three-fill" /></span>{/snippet}
  <form id="new-group" class="body" onsubmit={make}>
    <Field label={t('group.field.name')}><input type="text" bind:value={name} maxlength="80" required /></Field>
    <Field label={t('group.field.sentence')}><input type="text" bind:value={sentence} maxlength="200" /></Field>
    <div class="label">{t('group.fact.managedBy')}</div>
    <p class="meta text">{t('group.new.byText')}</p>
    <div class="options" role="radiogroup" aria-label={t('group.fact.managedBy')}>
      {#each choices as choice (choice.id)}
        <label class="option">
          <input type="radio" name="new-managed-by" value={choice.id} bind:group={managedBy} />
          {#if choice.id === 'itself'}
            <span>
              <span class="title">{name.trim() ? t('group.fact.itself', { name: name.trim() }) : t('group.new.itself')}</span>
              <span class="meta line">{t('group.new.itselfLine')}</span>
            </span>
          {:else}
            <span><span class="title">{choice.name}</span><span class="meta line">{t('group.by.lineYou', { count: choice.memberCount })}</span></span>
          {/if}
        </label>
      {/each}
    </div>
  </form>
  {#snippet foot()}
    <p class="meta note" class:problem role={problem ? 'alert' : undefined}>{problem || t('group.new.note')}</p>
    <Button variant="quiet" onclick={onclose}>{t('admin.cancel')}</Button>
    <Button type="submit" form="new-group" disabled={making || !name.trim()}>{t('group.new.make')}</Button>
  {/snippet}
</Sheet>

<style>
  .sign { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 6px 12px; }
  .label { margin: 6px 0 2px; font-size: var(--text-meta); color: var(--text-muted); }
  .text { display: block; margin: 2px 0 6px; line-height: 1.5; }
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
