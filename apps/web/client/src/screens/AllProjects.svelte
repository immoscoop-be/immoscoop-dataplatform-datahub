<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { type ProjectItem, projectMatches, projectPath, type Projects, withWhom } from '../lib/projects.js';
  import { rowOf } from '../lib/rows.js';

  /**
   * All projects, in Query (DEC-UX-354): every Project the User is in, the ones they archived too, which are in no other
   * list. Archiving takes one out of their panel only (DEC-UX-355); here it is found again and put back. A search on a
   * name or what it is for, and In your panel, Archived and All, opening on All (DEC-UX-359); each Project with
   * how many queries, who is in it and when it changed, and at its end Archive, or Back in your panel. A whole row opens
   * its page, which makes it active, archived or not (DEC-UX-356).
   */
  let {
    list,
    projects,
    me,
    onchanged,
    onnewproject,
    go,
  }: {
    /** The Projects the User is in, the archived ones too; undefined while they come. */
    list: readonly ProjectItem[] | undefined;
    projects: Pick<Projects, 'archive' | 'unarchive'>;
    /** The ID of the User, for who else is in a Project. */
    me: string;
    /** A Project archived or put back: the panel and this list read them again. */
    onchanged: () => void;
    /** New project, for who may make queries. */
    onnewproject?: () => void;
    go: (path: string) => void;
  } = $props();

  type Shown = 'panel' | 'archived' | 'all';

  const language = $derived(currentLanguage());
  let search = $state('');
  /** Opens on All, every Project the User is in; In your panel and Archived narrow it (DEC-UX-359). */
  let shown = $state<Shown>('all');
  let busy = $state<string | null>(null);
  let problem = $state('');

  const count = (which: Shown) => (list ?? []).filter((project) => which === 'all' || (which === 'archived') === Boolean(project.archivedAt)).length;
  const listed = $derived(
    (list ?? []).filter((project) => (shown === 'all' || (shown === 'archived') === Boolean(project.archivedAt)) && projectMatches(project, search)),
  );

  function withWho(project: ProjectItem): string {
    const shape = withWhom(project.members, me);
    if (shape.kind === 'alone') return t('row.withNobody');
    if (shape.kind === 'named') return t('row.withNames', { names: shape.names.join(t('row.and')) });
    return t('row.withMany', { count: shape.count });
  }

  /** Archives a Project, or puts it back in the panel, at once and without asking (DEC-UX-354). */
  async function archive(project: ProjectItem, archived: boolean): Promise<void> {
    if (busy) return;
    busy = project.id;
    problem = '';
    try {
      if (archived) await projects.archive(project.id);
      else await projects.unarchive(project.id);
      onchanged();
    } catch (error) {
      console.error('The Project could not be archived or put back', error);
      problem = t('project.failed');
    }
    busy = null;
  }
</script>

<Breadcrumb steps={[{ label: 'Query', href: '/query' }, { label: t('projects.title') }]} />
<div class="head">
  <span class="icon large"><Icon name="folders-fill" /></span>
  <div class="what">
    <h1 class="page-title">{t('projects.title')}</h1>
    <p class="lead-text">{t('projects.lead')}</p>
  </div>
  {#if onnewproject}<Button variant="outline" onclick={onnewproject}><Icon name="plus" />{t('row.newProject')}</Button>{/if}
</div>

{#if list === undefined}
  <Loading />
{:else if list.length === 0}
  <p class="meta empty">{t('query.projects.none')}</p>
{:else}
  <div class="tools">
    <div class="find"><Search bind:value={search} placeholder={t('projects.search')} surface="solid" /></div>
    <Segmented
      options={[
        { value: 'panel', label: `${t('projects.inPanel')} ${count('panel')}` },
        { value: 'archived', label: `${t('projects.archived')} ${count('archived')}` },
        { value: 'all', label: `${t('projects.all')} ${count('all')}` },
      ]}
      value={shown}
      onchange={(value) => (shown = value)}
      label={t('projects.which')}
    />
  </div>
  {#if problem}<p class="meta problem" role="alert">{problem}</p>{/if}
  <Table label={t('projects.title')}>
    {#snippet head()}
      <tr>
        <th>Project</th>
        <th class="narrow">{t('projects.column.queries')}</th>
        <th class="narrow">{t('projects.column.who')}</th>
        <th>{t('projects.column.changed')}</th>
        <th><span class="hidden">{t('projects.column.archive')}</span></th>
      </tr>
    {/snippet}
    {#each listed as project (project.id)}
      <tr class="row" class:archived={project.archivedAt} {...rowOf(projectPath(project.id), go)}>
        <td>
          <span class="name">
            <Icon name="folders-fill" />
            <span class="clip">{project.name}
              {#if project.description || project.archivedAt}
                <span class="meta">{project.description}{#if project.description && project.archivedAt}{' '}{/if}{#if project.archivedAt}{t('projects.archivedOn', { day: day(project.archivedAt, language) })}{/if}</span>
              {/if}
            </span>
          </span>
        </td>
        <td class="narrow">{project.queries}</td>
        <td class="narrow muted">{withWho(project)}</td>
        <td class="nowrap muted">{ago(project.updatedAt, language)}</td>
        <td class="end">
          {#if project.archivedAt}
            <Button variant="outline" disabled={busy !== null} onclick={(event) => { event.stopPropagation(); void archive(project, false); }}><Icon name="arrow-bend-up-left-fill" />{t('project.unarchive')}</Button>
          {:else}
            <Button variant="outline" label={t('project.archive', { name: project.name })} title={t('project.archive.hint')} disabled={busy !== null} onclick={(event) => { event.stopPropagation(); void archive(project, true); }}><Icon name="archive" /></Button>
          {/if}
        </td>
      </tr>
    {:else}
      <tr><td colspan="5" class="muted none">{shown === 'archived' && !search ? t('projects.noneArchived') : t('query.projects.noMatch')}</td></tr>
    {/each}
    {#snippet after()}<p class="meta foot">{t('projects.foot')}</p>{/snippet}
  </Table>
{/if}

<style>
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .icon { display: inline-flex; color: var(--text-secondary); }
  .icon.large { font-size: 30px; margin-top: 4px; }
  .tools { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; flex-wrap: wrap; }
  .find { flex: 1; max-width: 420px; min-width: 220px; }
  .empty, .problem { display: block; margin: 18px 0; }
  .problem { color: var(--signal-urgent); }
  .name { display: inline-flex; align-items: flex-start; gap: 9px; font-weight: var(--weight-medium); min-width: 0; }
  .name > :global(.icon) { font-size: 17px; color: var(--text-secondary); margin-top: 2px; flex: none; }
  .clip { min-width: 0; }
  .clip .meta { display: block; font-weight: var(--weight-regular); white-space: normal; }
  .archived .name, .archived td { color: var(--text-muted); }
  .archived .name > :global(.icon) { color: var(--text-muted); }
  .muted { color: var(--text-secondary); }
  .nowrap { white-space: nowrap; }
  .end { width: 1%; white-space: nowrap; text-align: right; }
  .none { padding: 14px 4px; }
  .foot { display: block; margin: 10px 4px 0; line-height: 1.5; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 900px) { .narrow { display: none; } }
</style>
