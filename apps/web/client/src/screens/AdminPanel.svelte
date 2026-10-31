<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ADMIN_TOOLS, type AdminTool } from '../lib/sections.js';

  /**
   * The panel of Admin, the section of the Data Team (DEC-UX-130): a line on what it is for, then its tools,
   * each with the number of things in it to look at, such as the deliveries of the webhook that were refused
   * or failed. Its tools are the list in sections.ts.
   */
  let {
    current,
    environment,
    counts,
  }: {
    /** The tool whose page is open. */
    current: AdminTool | undefined;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** Per tool, how many things to look at; left out while they come. */
    counts: Partial<Record<AdminTool, number>>;
  } = $props();

  const TITLES: Record<AdminTool, string> = { webhooks: 'admin.webhooks.count' };
</script>

<p class="about">{t('admin.about', { environment })}</p>
<nav aria-label="Admin">
  {#each ADMIN_TOOLS as tool (tool.id)}
    <a class="tool" class:on={tool.id === current} href={tool.path} aria-current={tool.id === current ? 'page' : undefined}>
      <Icon name={tool.icon} /><span>{tool.name}</span>
      {#if counts[tool.id] !== undefined}<span class="count" title={t(TITLES[tool.id])}>{counts[tool.id]}</span>{/if}
    </a>
  {/each}
</nav>

<style>
  .about { margin: 10px 4px 14px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  nav { display: flex; flex-direction: column; gap: 1px; }
  .tool { box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: var(--radius-md); font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .tool:hover { background: var(--tint-hover); color: var(--text-primary); }
  .tool:focus-visible { outline: 2px solid var(--text-secondary); }
  .tool.on { background: var(--card); color: var(--text-primary); font-weight: var(--weight-medium); }
  .tool :global(.icon) { font-size: 16px; flex: none; }
  .tool span:first-of-type { flex: 1; }
  .count { font-size: var(--text-meta); color: var(--text-muted); font-weight: var(--weight-regular); }
</style>
