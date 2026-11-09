<script lang="ts">
  /**
   * The icon of a chart of semgraph (REQ-060 of semgraph): its own picture, in currentColor, used as a mask, so that
   * it takes the colour of the text around it and nothing of semgraph runs in the page (TR-PF-34). Big, on its own
   * tile, at the head of a chart opened.
   */
  let { src, big = false }: { src: string; big?: boolean } = $props();
</script>

<span class="chart-icon" class:big aria-hidden="true"><span class="mark" style:mask-image={`url("${src}")`} style:-webkit-mask-image={`url("${src}")`}></span></span>

<style>
  .chart-icon { display: inline-flex; flex: none; color: var(--text-secondary); }
  .mark { display: block; width: 22px; height: 22px; background: currentColor;
    mask-size: contain; mask-repeat: no-repeat; mask-position: center;
    -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center; }
  .big { width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--surface-sub); align-items: center; justify-content: center; color: var(--text-secondary); }
  .big .mark { width: 30px; height: 30px; }
</style>
