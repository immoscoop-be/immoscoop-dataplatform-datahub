<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { type ProjectItem, withWhom } from '../lib/projects.js';

  /**
   * The sheet of the Project button of a query, and of New project (DEC-UX-318): to add the query to a Project, or move
   * it to another, a list of the Projects the User is in, the one it is in left out, and New project with its name; the
   * query goes to the end of the row of the one chosen, which is then active, as a query is in one Project at most
   * (OP-UX-93). Without a query, it makes a new Project with its name and what it is for, and its details open.
   */
  let {
    mode,
    query,
    projects,
    current,
    me,
    onput,
    onclose,
  }: {
    mode: 'add' | 'move' | 'new';
    /** The query it is about; none for New project. */
    query: { id: string; name: string } | null;
    projects: readonly ProjectItem[];
    /** The Project the query is in now, left out of the list. */
    current: { id: string; name: string } | null;
    /** The ID of the User. */
    me: string;
    /** Puts the query in a Project, or makes one with its name. */
    onput: (target: { to: string } | { name: string; description?: string }) => Promise<void>;
    onclose: () => void;
  } = $props();

  const others = $derived(projects.filter((one) => one.id !== current?.id));
  let to = $state<string>('new');
  let name = $state('');
  let description = $state('');
  let busy = $state(false);
  let failed = $state(false);
  // The first other Project is chosen to start with; with none, New project.
  $effect(() => {
    to = mode === 'new' ? 'new' : (others[0]?.id ?? 'new');
  });

  const ready = $derived(!busy && (to !== 'new' || name.trim().length > 0));

  function who(members: ProjectItem['members']): string {
    const shape = withWhom(members, me);
    if (shape.kind === 'alone') return t('row.withNobody');
    if (shape.kind === 'named') return t('row.withNames', { names: shape.names.join(t('row.and')) });
    return t('row.withMany', { count: shape.count });
  }

  async function go(): Promise<void> {
    if (!ready) return;
    busy = true;
    failed = false;
    try {
      await onput(to === 'new' ? { name: name.trim(), description: description.trim() } : { to });
      onclose();
    } catch (error) {
      console.error('The query could not be put in the project', error);
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<Sheet
  title={mode === 'new' ? t('row.newProject') : t(mode === 'move' ? 'project.sheet.move' : 'project.sheet.add', { name: query?.name ?? '' })}
  {onclose}
>
  {#snippet lead()}<span class="lead"><Icon name="folders-fill" /></span>{/snippet}
  <div class="list" role="radiogroup" aria-label={t('project.sheet.which')}>
    {#if mode !== 'new'}
      {#each others as one (one.id)}
        <label class="opt">
          <input type="radio" name="project-to" value={one.id} bind:group={to} />
          <span class="icon"><Icon name="folders-fill" /></span>
          <span class="grow"><span class="title">{one.name}</span><span class="meta">{t('row.queries', { count: one.queries })} · {who(one.members)}</span></span>
        </label>
      {/each}
      <label class="opt">
        <input type="radio" name="project-to" value="new" bind:group={to} />
        <span class="icon"><Icon name="plus" /></span>
        <span class="grow"><span class="title">{t('row.newProject')}</span></span>
      </label>
    {/if}
    {#if to === 'new'}
      <div class="fields" class:indent={mode !== 'new'}>
        <label class="field"><span>{t('row.new.name.label')}</span><input {...NO_PASSWORD_MANAGER} bind:value={name} maxlength="80" placeholder={t('row.new.name.placeholder')} data-autofocus /></label>
        {#if mode === 'new'}
          <label class="field"><span>{t('row.new.what')}</span><textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="500" bind:value={description} placeholder={t('row.new.what.placeholder')}></textarea></label>
        {/if}
      </div>
    {/if}
  </div>
  {#snippet foot()}
    <p class="meta foot-text" role={failed ? 'alert' : undefined}>
      {failed ? t('row.failed') : mode === 'new' ? t('row.new.foot') : mode === 'move' ? t('project.sheet.move.foot', { from: current?.name ?? '' }) : t('project.sheet.add.foot')}
    </p>
    <Button variant="quiet" onclick={onclose}>{t('row.cancel')}</Button>
    <Button disabled={!ready} onclick={go}>{mode === 'new' || to === 'new' ? t('row.new.go') : t(mode === 'move' ? 'project.sheet.moveGo' : 'project.sheet.addGo')}</Button>
  {/snippet}
</Sheet>

<style>
  .lead { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .list { display: grid; gap: 2px; }
  .opt { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; }
  .opt:hover { background: var(--tint-hover); }
  .opt input { accent-color: var(--text-primary); margin: 0; flex: none; }
  .icon { display: inline-flex; color: var(--text-secondary); flex: none; }
  .grow { flex: 1; min-width: 0; display: grid; }
  .title { font-size: var(--text-small); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .fields { display: grid; gap: 10px; padding: 6px 10px; }
  .fields.indent { padding-left: 36px; }
  .field { display: grid; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); }
  .field input, .field textarea { font: inherit; font-size: var(--text-small); padding: 7px 10px; border-radius: var(--radius-field); border: 1px solid var(--tint-active); background: var(--surface-sub); color: var(--text-primary); }
  .field textarea { resize: vertical; }
  .foot-text { flex: 1; margin: 0; line-height: 1.45; }
</style>
