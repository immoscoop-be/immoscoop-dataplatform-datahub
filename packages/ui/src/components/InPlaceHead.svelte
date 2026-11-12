<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '../foundations/fields.js';
  import type { Snippet } from 'svelte';
  import { t } from '../foundations/texts.svelte.js';
  import Button from '../primitives/Button.svelte';
  import Field from '../primitives/Field.svelte';

  /**
   * The name of an object at the top of its page, with its description under it, edited in place (InPlaceHead,
   * DEC-UX-119, DEC-UX-162), as the name and question of a query are: for whoever may change them, a click on
   * either turns both into fields, with Save and Cancel; Escape cancels too, and a name stays required. Without
   * a description, an editor sees "Add a description" in its place. For everyone else both are plain text.
   */
  let {
    name,
    description,
    canEdit,
    nameLabel,
    descriptionLabel = '',
    nameMax = 80,
    descriptionMax = 500,
    onsave,
    level = 1,
    lead,
    trail,
  }: {
    name: string;
    /** Left out for an object whose name alone is edited here, such as a Lens. */
    description?: string;
    canEdit: boolean;
    nameLabel: string;
    descriptionLabel?: string;
    nameMax?: number;
    descriptionMax?: number;
    /** Saves only what changed; answers a sentence to show when it was refused, such as a name already taken. */
    onsave: (changes: { name?: string; description?: string }) => Promise<string | undefined>;
    /** The head of the page, or of a part of it opened beside a list, such as a Permission group (DEC-UX-186). */
    level?: 1 | 2;
    /** Marks in the heading before and after the name, such as the kind and Level of a Lens; never part of what is edited. */
    lead?: Snippet;
    trail?: Snippet;
  } = $props();

  let editing: { name: string; description: string; at: 'name' | 'description' } | null = $state(null);
  let saving = $state(false);
  let problem = $state('');

  function start(at: 'name' | 'description') {
    editing = { name, description: description ?? '', at };
    problem = '';
  }

  /** The field that was clicked is ready to type in. */
  const focused = (at: 'name' | 'description') => (element: HTMLInputElement | HTMLTextAreaElement) => {
    if (editing?.at === at) element.focus();
  };

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!editing) return;
    const wanted = { name: editing.name.trim(), description: editing.description.trim() };
    if (wanted.name === '') return;
    const changes = {
      ...(wanted.name !== name ? { name: wanted.name } : {}),
      ...(description !== undefined && wanted.description !== description ? { description: wanted.description } : {}),
    };
    if (Object.keys(changes).length === 0) {
      editing = null;
      return;
    }
    saving = true;
    problem = '';
    try {
      const refused = await onsave(changes);
      if (refused) problem = refused;
      else editing = null;
    } catch (error) {
      console.error('What was edited in place could not be saved', error);
      problem = t('inPlace.failed');
    }
    saving = false;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      editing = null;
    }
  }
</script>

{#if editing}
  <form class="edit" onsubmit={save}>
    <Field label={nameLabel}><input {...NO_PASSWORD_MANAGER} type="text" bind:value={editing.name} maxlength={nameMax} required onkeydown={keydown} {@attach focused('name')} /></Field>
    {#if description !== undefined}
      <Field label={descriptionLabel}><textarea {...NO_PASSWORD_MANAGER} bind:value={editing.description} rows="2" maxlength={descriptionMax} onkeydown={keydown} {@attach focused('description')}></textarea></Field>
    {/if}
    <span class="actions">
      <Button type="submit" disabled={saving || editing.name.trim() === ''}>{t('inPlace.save')}</Button>
      <Button variant="quiet" onclick={() => (editing = null)}>{t('inPlace.cancel')}</Button>
      {#if problem}<span class="problem" role="alert">{problem}</span>{/if}
    </span>
  </form>
{:else if canEdit}
  <svelte:element this={`h${level}`} class={level === 1 ? 'page-title' : 'part-title'} class:marks={lead || trail}>{@render lead?.()}<button type="button" class="in-place" title={t('inPlace.hint')} onclick={() => start('name')}>{name}</button>{@render trail?.()}</svelte:element>
  {#if description !== undefined}
    <p class="description" class:small={level === 2}>
      {#if description}
        <button type="button" class="in-place" title={t('inPlace.hint')} onclick={() => start('description')}>{description}</button>
      {:else}
        <button type="button" class="in-place empty" onclick={() => start('description')}>{t('inPlace.addDescription')}</button>
      {/if}
    </p>
  {/if}
{:else}
  <svelte:element this={`h${level}`} class={level === 1 ? 'page-title' : 'part-title'} class:marks={lead || trail}>{@render lead?.()}{name}{@render trail?.()}</svelte:element>
  {#if description}<p class="description" class:small={level === 2}>{description}</p>{/if}
{/if}

<style>
  .marks { display: flex; align-items: center; gap: 10px; }
  .description { margin: 6px 0 0; max-width: 68ch; line-height: 1.65; color: var(--text-secondary); }
  .part-title { margin: 0; font-size: 19px; font-weight: var(--weight-medium); }
  .description.small { margin-top: 2px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .in-place { all: unset; cursor: text; border-radius: var(--radius-sm); white-space: pre-line; }
  .in-place:hover { background: var(--tint-hover); }
  .in-place:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .empty { color: var(--text-muted); font-style: italic; }
  .edit { max-width: 640px; margin-top: 6px; }
  .actions { display: flex; align-items: center; gap: 8px; }
  .problem { font-size: var(--text-small); color: var(--signal-urgent); }
</style>
