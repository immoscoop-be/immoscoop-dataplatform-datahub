<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { DeletedLens } from '../lib/query.js';
  import { collectionPath } from '../lib/routes.js';
  import MessagesButton from './MessagesButton.svelte';

  /**
   * The address of a deleted Lens, for whoever saw it (lens-deleted, DEC-UX-185, FR-LE-18): its name, that it was deleted,
   * by whom, when and why; that it no longer runs, also not in Excel; and that its runs and the Messages on it are kept,
   * with the way to its Collection and to those Messages. Nothing runs here.
   */
  let {
    lens,
    collection,
    messages,
  }: {
    lens: DeletedLens;
    collection: { id: string; name: string } | undefined;
    messages?: { count: number | null; href: string } | undefined;
  } = $props();

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = $derived(new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(lens.deleted.at)));
  const why = $derived(lens.deleted.reason ? `: ${lens.deleted.reason.replace(/([^.!?])$/, '$1.')}` : '.');
</script>

<Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, collection ? { label: collection.name, href: collectionPath(collection.id) } : { label: '' }]} />
<h1 class="page-title"><KindIcon kind="lens" />{lens.name}</h1>
<div class="gone">
  <Callout icon="trash-fill">
    <b>{t('lens.deleted.title')}</b>
    {t('lens.deleted.text', { by: lens.deleted.byName, date: day, why })}
  </Callout>
</div>
<div class="ways">
  {#if collection}<Button variant="outline" href={collectionPath(collection.id)}><Icon name="stack-fill" />{collection.name}</Button>{/if}
  {#if messages}<MessagesButton href={messages.href} count={messages.count} />{/if}
</div>

<style>
  .page-title { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; color: var(--text-secondary); }
  .gone { margin-top: 16px; }
  .gone b { font-weight: var(--weight-medium); }
  .ways { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
</style>
