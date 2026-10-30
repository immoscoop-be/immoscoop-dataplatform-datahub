<script lang="ts">
  import type { LineageModel } from '@datahub/ui/components/Lineage.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import type { Catalogue, LineageNode, ResourceDetail, ResourceLineage } from '../lib/catalogue.js';

  /**
   * The Lineage of a Resource (FR-SR-54): its models up- and downstream across the dbt projects Data Hub
   * follows, read from catalogue for whoever sees the Resource (DEC-AR-06), and walked one step at a time.
   * A model that is a Resource the User sees shows its name and Level.
   */
  let { resource, catalogue }: { resource: ResourceDetail; catalogue: Catalogue } = $props();

  /** The lineage: undefined while it comes, null when it could not be read. */
  let lineage: ResourceLineage | null | undefined = $state();

  $effect(() => {
    const id = resource.id;
    lineage = undefined;
    catalogue.lineage(id).then(
      (found) => resource.id === id && (lineage = found),
      (error: unknown) => {
        console.error(`The lineage of ${resource.displayName} could not be read`, error);
        if (resource.id === id) {
          lineage = null;
        }
      },
    );
  });

  const ICONS: Record<string, IconName> = { seed: 'plant', source: 'database' };

  const graph = $derived.by(() => {
    if (!lineage) {
      return undefined;
    }
    const resources = new Map(lineage.resources.map((one) => [one.nodeId, one]));
    const models = new Map<string, LineageModel>();
    const add = (node: LineageNode) => {
      const known = resources.get(node.uniqueId);
      models.set(node.uniqueId, {
        id: node.uniqueId,
        name: node.name,
        meta: [node.layer, node.projectName ?? node.projectId].join(' · '),
        icon: known ? 'table' : (ICONS[node.resourceType] ?? 'cube'),
        ...(known ? { resource: { name: known.displayName, level: known.level } } : {}),
      });
    };
    lineage.upstream?.nodes.forEach(add);
    lineage.downstream?.nodes.forEach(add);
    // Upstream, the parents of a model are what it is built on; downstream, its children are built on it.
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const edge of lineage.upstream?.edges ?? []) {
      parents.set(edge.childId, [...(parents.get(edge.childId) ?? []), edge.parentId]);
    }
    for (const edge of lineage.downstream?.edges ?? []) {
      children.set(edge.parentId, [...(children.get(edge.parentId) ?? []), edge.childId]);
    }
    const byName = (ids: readonly string[]) => [...new Set(ids)].sort((a, b) => (models.get(a)?.name ?? a).localeCompare(models.get(b)?.name ?? b));
    return {
      center: lineage.nodeId,
      models,
      upstream: (id: string) => byName(parents.get(id) ?? []),
      downstream: (id: string) => byName(children.get(id) ?? []),
    };
  });
</script>

<p class="meta text">{t('resource.lineage.text')}</p>
{#if lineage === undefined}
  <p class="meta state">{t('resource.lineage.loading')}</p>
{:else if lineage === null}
  <p class="meta state" role="alert">{t('resource.lineage.failed')}</p>
{:else if !graph || !graph.models.has(graph.center)}
  <p class="meta state">{t('resource.lineage.unknown')}</p>
{:else}
  <!-- The canvas of the Lineage loads when its tab opens, so that the rest of the page loads without it. -->
  {#await import('@datahub/ui/components/Lineage.svelte') then { default: Lineage }}
    <Lineage
      center={graph.center}
      models={graph.models}
      upstream={graph.upstream}
      downstream={graph.downstream}
      label={t('resource.lineage.label', { name: resource.displayName })}
      backLabel={t('resource.lineage.back')}
    />
  {/await}
{/if}

<style>
  .text { display: block; margin: 0 6px 12px; line-height: 1.5; }
  .state { display: flex; justify-content: center; padding: 30px; margin: 0; }
</style>
